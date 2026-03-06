#include "simulation/Simulation.h"
#include <cmath>

namespace titan::simulation
{
    Simulation::Simulation(
        const titan::environment::CelestialBody &body,
        std::unique_ptr<titan::integrators::Integrator> integrator,
        std::unique_ptr<titan::guidance::Guidance> guidance)
        : m_status(SimStatus::Running),
          m_body(body),
          m_integrator(std::move(integrator)),
          m_guidance(std::move(guidance)),
          m_maxG(4.0),
          m_maxDynamicPressure(0.0),
          m_maxQReported(false)
    {
        // Default initial position: on surface
        m_state.position = titan::math::Vector3(body.radius + 1.0, 0.0, 0.0);

        // Earth rotation gives free velocity
        if (body.rotationRate > 0.0)
        {
            double surfaceVelocity = body.rotationRate * body.radius;
            m_state.velocity = titan::math::Vector3(0.0, surfaceVelocity, 0.0);
        }

        m_state.time = 0.0;
    }

    void Simulation::AddForce(std::unique_ptr<titan::physics::ForceModel> force)
    {
        m_forces.push_back(std::move(force));
    }

    void Simulation::SetVehicle(std::unique_ptr<titan::vehicle::Vehicle> vehicle)
    {
        m_vehicle = std::move(vehicle);
        if (m_vehicle)
            m_state.mass = m_vehicle->GetTotalMass();
    }

    void Simulation::SetEventBus(std::shared_ptr<titan::events::EventBus> bus)
    {
        m_eventBus = std::move(bus);
    }

    void Simulation::SetTelemetryBus(std::shared_ptr<titan::telemetry::TelemetryBus> telemetry)
    {
        m_telemetryBus = std::move(telemetry);
    }

    void Simulation::SetFlightSequencer(
        std::unique_ptr<titan::events::FlightSequencer> sequencer)
    {
        m_sequencer = std::move(sequencer);
    }

    void Simulation::SetAtmosphere(
        std::unique_ptr<titan::environment::Atmosphere> atmosphere)
    {
        m_atmosphere = std::move(atmosphere);
    }

    void Simulation::SetCompletionCriteria(const CompletionCriteria &criteria)
    {
        m_completionCriteria = criteria;
    }

    void Simulation::SetMaxG(double maxG)
    {
        m_maxG = maxG;
    }

    void Simulation::SetInitialState(const SimState &state)
    {
        m_state = state;
    }

    titan::math::Vector3 Simulation::ComputeTotalAcceleration(
        const SimState &state, double time) const
    {
        titan::math::Vector3 totalAccel;

        for (const auto &force : m_forces)
        {
            totalAccel += force->ComputeAcceleration(state, time);
        }

        return totalAccel;
    }

    StepResult Simulation::Step(double dt)
    {
        StepResult result;
        result.status = SimStatus::Running;

        if (m_status != SimStatus::Running)
        {
            result.status = m_status;
            result.dt_actual = 0.0;
            result.state = m_state;
            return result;
        }

        // Impact detection
        double r = m_state.position.Magnitude();
        if (r <= m_body.radius - 1.0)
        {
            m_status = SimStatus::Impact;
            if (m_eventBus)
            {
                titan::events::SimEvent event(
                    m_state.time, titan::events::EventType::Impact,
                    "Vehicle impacted surface");
                m_eventBus->Emit(event);
            }
            result.status = SimStatus::Impact;
            result.dt_actual = 0.0;
            result.state = m_state;
            return result;
        }

        double totalMass = m_vehicle ? m_vehicle->GetTotalMass() : m_state.mass;
        if (totalMass <= 0.0)
        {
            result.status = SimStatus::Error;
            result.dt_actual = 0.0;
            result.state = m_state;
            return result;
        }

        m_state.mass = totalMass;

        // Acceleration limiting and thrust management
        if (m_vehicle && m_vehicle->HasFuel())
        {
            double thrust = m_vehicle->GetThrust();
            double accel = thrust / totalMass;

            if (accel / g0 > m_maxG)
            {
                double limitedThrust = m_maxG * g0 * totalMass;
                double maxThrust = m_vehicle->GetMaxThrust();
                if (maxThrust > 0.0)
                    m_vehicle->SetThrottle(limitedThrust / maxThrust);
            }

            m_vehicle->Burn(dt);
        }

        // Integrate using the derivative function
        double mu = m_body.mu;
        SimState currentState = m_state;

        // Convert SimState -> integrators::State for the integrator
        titan::integrators::State intState{
            m_state.position.x, m_state.position.y, m_state.position.z,
            m_state.velocity.x, m_state.velocity.y, m_state.velocity.z};

        auto derivativeFunc =
            [this, &currentState](const titan::integrators::State &s)
            -> titan::integrators::Derivative
        {
            SimState evalState;
            evalState.position = titan::math::Vector3(s.x, s.y, s.z);
            evalState.velocity = titan::math::Vector3(s.vx, s.vy, s.vz);
            evalState.mass = currentState.mass;
            evalState.time = currentState.time;

            titan::math::Vector3 accel = ComputeTotalAcceleration(
                evalState, currentState.time);

            // Add guidance thrust (computed from external forces)
            titan::math::Vector3 thrustAccel;
            if (m_guidance && m_vehicle && m_vehicle->HasFuel())
            {
                titan::integrators::State guidanceState = s;
                titan::math::Vector3 thrustDir =
                    m_guidance->ComputeThrustDirection(guidanceState, m_body.mu)
                        .Normalized();

                double thrustMag = m_vehicle->GetThrust();
                if (thrustMag > 0.0 && currentState.mass > 0.0)
                    thrustAccel = thrustDir * (thrustMag / currentState.mass);
            }

            titan::math::Vector3 totalAccel = accel + thrustAccel;

            return {s.vx, s.vy, s.vz,
                    totalAccel.x, totalAccel.y, totalAccel.z};
        };

        auto intResult = m_integrator->Step(intState, dt, derivativeFunc);
        double dt_actual = intResult.dt_used;

        // Update state from integrator result
        m_state.position = titan::math::Vector3(
            intResult.state.x, intResult.state.y, intResult.state.z);
        m_state.velocity = titan::math::Vector3(
            intResult.state.vx, intResult.state.vy, intResult.state.vz);
        m_state.time += dt_actual;
        m_state.mass = m_vehicle ? m_vehicle->GetTotalMass() : m_state.mass;

        // Stage separation
        if (m_vehicle && m_vehicle->ShouldSeparateStage())
        {
            m_vehicle->SeparateStage(m_state.time, m_eventBus.get());
        }

        // Max-Q detection
        if (m_atmosphere && !m_maxQReported)
        {
            double altitude = m_state.position.Magnitude() - m_body.radius;
            double density = m_atmosphere->GetDensity(altitude);
            double speed = m_state.velocity.Magnitude();
            double q = 0.5 * density * speed * speed;

            if (q > m_maxDynamicPressure)
            {
                m_maxDynamicPressure = q;
            }
            else if (q < m_maxDynamicPressure * 0.95 && m_maxDynamicPressure > 1000.0)
            {
                m_maxQReported = true;
                if (m_eventBus)
                {
                    titan::events::SimEvent event(
                        m_state.time, titan::events::EventType::MaxQ,
                        "Maximum dynamic pressure");
                    event.WithData("maxQ_Pa", m_maxDynamicPressure);
                    m_eventBus->Emit(event);
                }
            }
        }

        // Flight sequencer
        if (m_sequencer)
            m_sequencer->Update(m_state.time, m_state);

        // Scheduled events
        if (m_eventBus)
            m_eventBus->ProcessScheduledEvents(m_state.time);

        // Telemetry
        PublishTelemetry();

        // Completion check
        CheckCompletion();

        result.status = m_status;
        result.dt_actual = dt_actual;
        result.state = m_state;
        return result;
    }

    void Simulation::PublishTelemetry()
    {
        if (!m_telemetryBus)
            return;

        double t = m_state.time;

        m_telemetryBus->Publish("nav.position", t,
                                titan::telemetry::TelemetryValue::Vec3(
                                    m_state.position.x, m_state.position.y,
                                    m_state.position.z));

        m_telemetryBus->Publish("nav.velocity", t,
                                titan::telemetry::TelemetryValue::Vec3(
                                    m_state.velocity.x, m_state.velocity.y,
                                    m_state.velocity.z));

        double altitude = m_state.position.Magnitude() - m_body.radius;
        m_telemetryBus->Publish("nav.altitude", t,
                                titan::telemetry::TelemetryValue::Scalar(altitude));

        m_telemetryBus->Publish("nav.speed", t,
                                titan::telemetry::TelemetryValue::Scalar(
                                    m_state.velocity.Magnitude()));

        // Orbital elements
        auto elements = titan::orbital::OrbitalMechanics::ComputeOrbitalElements(
            m_state.position, m_state.velocity, m_body.mu);

        m_telemetryBus->Publish("orbit.apoapsis", t,
                                titan::telemetry::TelemetryValue::Scalar(
                                    elements.apoapsis - m_body.radius));
        m_telemetryBus->Publish("orbit.periapsis", t,
                                titan::telemetry::TelemetryValue::Scalar(
                                    elements.periapsis - m_body.radius));
        m_telemetryBus->Publish("orbit.eccentricity", t,
                                titan::telemetry::TelemetryValue::Scalar(
                                    elements.eccentricity));
        m_telemetryBus->Publish("orbit.inclination", t,
                                titan::telemetry::TelemetryValue::Scalar(
                                    elements.inclination));

        if (m_vehicle)
        {
            m_telemetryBus->Publish("vehicle.mass", t,
                                    titan::telemetry::TelemetryValue::Scalar(
                                        m_vehicle->GetTotalMass()));
            m_telemetryBus->Publish("vehicle.thrust", t,
                                    titan::telemetry::TelemetryValue::Scalar(
                                        m_vehicle->GetThrust()));
            m_telemetryBus->Publish("vehicle.stageIndex", t,
                                    titan::telemetry::TelemetryValue::Scalar(
                                        static_cast<double>(m_vehicle->GetCurrentStageIndex())));
        }
    }

    void Simulation::CheckCompletion()
    {
        if (!m_completionCriteria.enabled)
            return;

        auto elements = titan::orbital::OrbitalMechanics::ComputeOrbitalElements(
            m_state.position, m_state.velocity, m_body.mu);

        double periapsis = elements.periapsis - m_body.radius;

        if (periapsis > m_completionCriteria.minPeriapsis &&
            elements.eccentricity < m_completionCriteria.maxEccentricity)
        {
            m_status = SimStatus::Completed;
            if (m_eventBus)
            {
                titan::events::SimEvent event(
                    m_state.time, titan::events::EventType::OrbitInsertion,
                    "Orbit insertion achieved");
                event.WithData("periapsis", periapsis);
                event.WithData("apoapsis", elements.apoapsis - m_body.radius);
                event.WithData("eccentricity", elements.eccentricity);
                m_eventBus->Emit(event);
            }
        }
    }
}
