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
        m_state.position = titan::math::Vector3(body.radius + 1.0, 0.0, 0.0);

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

    void Simulation::SetController(std::unique_ptr<titan::gnc::Controller> controller)
    {
        m_controller = std::move(controller);
    }

    void Simulation::SetNavigator(std::unique_ptr<titan::gnc::Navigator> navigator)
    {
        m_navigator = std::move(navigator);
    }

    void Simulation::SetPointingMode(std::unique_ptr<titan::gnc::PointingMode> mode)
    {
        m_pointingMode = std::move(mode);
    }

    void Simulation::AddReactionWheel(titan::math::Vector3 axis, double maxTorque,
                                       double maxMomentum, double wheelInertia)
    {
        m_reactionWheels.push_back({axis.Normalized(), maxTorque, maxMomentum,
                                    wheelInertia, 0.0});
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

    titan::math::Vector3 Simulation::ComputeTotalTorque(
        const SimState &state, double time) const
    {
        titan::math::Vector3 totalTorque;

        for (const auto &force : m_forces)
        {
            totalTorque += force->ComputeTorque(state, time);
        }

        return totalTorque;
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

        // Compute GNC control torque
        m_controlTorque = titan::math::Vector3();
        if (m_pointingMode && m_controller)
        {
            auto desiredAtt = m_pointingMode->ComputeDesiredAttitude(m_state, m_state.time);
            SimState desiredState = m_state;
            desiredState.attitude = desiredAtt;
            desiredState.angularVelocity = titan::math::Vector3();

            SimState navState = m_state;
            if (m_navigator)
                navState = m_navigator->EstimateState(m_state, m_state.time);

            auto commands = m_controller->Compute(navState, desiredState, dt);
            m_controlTorque = commands.torqueCommand;
        }

        // Distribute control torque to reaction wheels
        titan::math::Vector3 rwTorque;
        if (!m_reactionWheels.empty() && m_controlTorque.Magnitude() > 1e-15)
        {
            for (auto &rw : m_reactionWheels)
            {
                // Desired spacecraft torque component along this wheel axis
                double desiredTorque = titan::math::Vector3::Dot(m_controlTorque, rw.axis);
                desiredTorque = std::clamp(desiredTorque, -rw.maxTorque, rw.maxTorque);

                // Wheel motor torque is opposite to spacecraft torque
                double wheelTorque = -desiredTorque;

                // Integrate wheel speed
                if (rw.wheelInertia > 0.0)
                {
                    double dOmega = wheelTorque / rw.wheelInertia * dt;
                    rw.wheelSpeed += dOmega;

                    // Clamp momentum
                    double momentum = rw.wheelInertia * rw.wheelSpeed;
                    if (std::abs(momentum) > rw.maxMomentum && rw.maxMomentum > 0.0)
                    {
                        double sign = (rw.wheelSpeed > 0.0) ? 1.0 : -1.0;
                        rw.wheelSpeed = sign * rw.maxMomentum / rw.wheelInertia;
                        desiredTorque = 0.0; // saturated
                    }
                }

                // Apply desired torque to spacecraft
                rwTorque += rw.axis * desiredTorque;
            }
        }

        // Check if we have inertia set (6DOF mode)
        bool has6DOF = false;
        titan::math::Vector3 inertia;
        if (m_vehicle)
        {
            inertia = m_vehicle->GetInertia();
            has6DOF = (inertia.x > 0.0 && inertia.y > 0.0 && inertia.z > 0.0);
        }

        // Always use 6DOF if we have reaction wheels or controller
        if (!m_reactionWheels.empty() || m_controller)
            has6DOF = true;

        if (has6DOF && inertia.Magnitude() < 1e-10 && m_vehicle)
            inertia = m_vehicle->GetInertia();

        SimState currentState = m_state;
        double mu = m_body.mu;

        if (has6DOF)
        {
            // 13-component state: [px,py,pz, vx,vy,vz, qw,qx,qy,qz, wx,wy,wz]
            titan::integrators::StateVector intState = {
                m_state.position.x, m_state.position.y, m_state.position.z,
                m_state.velocity.x, m_state.velocity.y, m_state.velocity.z,
                m_state.attitude.w, m_state.attitude.x, m_state.attitude.y, m_state.attitude.z,
                m_state.angularVelocity.x, m_state.angularVelocity.y, m_state.angularVelocity.z};

            double Ixx = inertia.x, Iyy = inertia.y, Izz = inertia.z;
            titan::math::Vector3 ctrlTorque = rwTorque;

            auto derivativeFunc =
                [this, &currentState, Ixx, Iyy, Izz, ctrlTorque](
                    const titan::integrators::StateVector &s)
                -> titan::integrators::DerivativeVector
            {
                SimState evalState;
                evalState.position = titan::math::Vector3(s[0], s[1], s[2]);
                evalState.velocity = titan::math::Vector3(s[3], s[4], s[5]);
                evalState.attitude = titan::math::Quaternion(s[6], s[7], s[8], s[9]);
                evalState.angularVelocity = titan::math::Vector3(s[10], s[11], s[12]);
                evalState.mass = currentState.mass;
                evalState.time = currentState.time;

                titan::math::Vector3 accel = ComputeTotalAcceleration(
                    evalState, currentState.time);

                // Add guidance thrust
                titan::math::Vector3 thrustAccel;
                if (m_guidance && m_vehicle && m_vehicle->HasFuel())
                {
                    titan::integrators::State guidanceState{s[0], s[1], s[2], s[3], s[4], s[5]};
                    titan::math::Vector3 thrustDir =
                        m_guidance->ComputeThrustDirection(guidanceState, m_body.mu)
                            .Normalized();

                    double thrustMag = m_vehicle->GetThrust();
                    if (thrustMag > 0.0 && currentState.mass > 0.0)
                        thrustAccel = thrustDir * (thrustMag / currentState.mass);
                }

                titan::math::Vector3 totalAccel = accel + thrustAccel;

                // Quaternion kinematic derivative: dq/dt = 0.5 * q * (0, omega)
                titan::math::Vector3 omega(s[10], s[11], s[12]);
                auto qDot = evalState.attitude.KinematicDerivative(omega);

                // Torques
                titan::math::Vector3 externalTorque = ComputeTotalTorque(evalState, currentState.time);
                titan::math::Vector3 totalTorque = externalTorque + ctrlTorque;

                // Euler's rotation equations
                double wx = s[10], wy = s[11], wz = s[12];
                double ax = (Ixx > 1e-15) ? (totalTorque.x - (Iyy - Izz) * wy * wz) / Ixx : 0.0;
                double ay = (Iyy > 1e-15) ? (totalTorque.y - (Izz - Ixx) * wz * wx) / Iyy : 0.0;
                double az = (Izz > 1e-15) ? (totalTorque.z - (Ixx - Iyy) * wx * wy) / Izz : 0.0;

                return {s[3], s[4], s[5],
                        totalAccel.x, totalAccel.y, totalAccel.z,
                        qDot.w, qDot.x, qDot.y, qDot.z,
                        ax, ay, az};
            };

            auto intResult = m_integrator->StepVector(intState, dt, derivativeFunc);
            double dt_actual = intResult.dt_used;
            const auto &ns = intResult.state;

            m_state.position = titan::math::Vector3(ns[0], ns[1], ns[2]);
            m_state.velocity = titan::math::Vector3(ns[3], ns[4], ns[5]);
            m_state.attitude = titan::math::Quaternion(ns[6], ns[7], ns[8], ns[9]).Normalized();
            m_state.angularVelocity = titan::math::Vector3(ns[10], ns[11], ns[12]);
            m_state.time += dt_actual;

            result.dt_actual = dt_actual;
        }
        else
        {
            // Legacy 3DOF path (backward compatible)
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

            m_state.position = titan::math::Vector3(
                intResult.state.x, intResult.state.y, intResult.state.z);
            m_state.velocity = titan::math::Vector3(
                intResult.state.vx, intResult.state.vy, intResult.state.vz);
            m_state.time += dt_actual;

            result.dt_actual = dt_actual;
        }

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

        double speed = m_state.velocity.Magnitude();
        m_telemetryBus->Publish("nav.speed", t,
                                titan::telemetry::TelemetryValue::Scalar(speed));

        // Vertical velocity
        auto rHat = m_state.position.Normalized();
        double vVert = titan::math::Vector3::Dot(m_state.velocity, rHat);
        m_telemetryBus->Publish("nav.verticalVelocity", t,
                                titan::telemetry::TelemetryValue::Scalar(vVert));

        // Total acceleration magnitude
        auto accel = ComputeTotalAcceleration(m_state, t);
        m_telemetryBus->Publish("nav.acceleration", t,
                                titan::telemetry::TelemetryValue::Scalar(accel.Magnitude()));

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

        // Attitude telemetry
        m_telemetryBus->Publish("att.quaternion", t,
                                titan::telemetry::TelemetryValue::Quat(
                                    m_state.attitude.w, m_state.attitude.x,
                                    m_state.attitude.y, m_state.attitude.z));

        m_telemetryBus->Publish("att.angularVelocity", t,
                                titan::telemetry::TelemetryValue::Vec3(
                                    m_state.angularVelocity.x,
                                    m_state.angularVelocity.y,
                                    m_state.angularVelocity.z));

        double roll, pitch, yaw;
        m_state.attitude.ToEuler(roll, pitch, yaw);
        m_telemetryBus->Publish("att.euler", t,
                                titan::telemetry::TelemetryValue::Vec3(roll, pitch, yaw));

        // Attitude error (if controller active)
        if (m_pointingMode)
        {
            auto desired = m_pointingMode->ComputeDesiredAttitude(m_state, t);
            auto qErr = m_state.attitude.ErrorTo(desired);
            double errMag = 2.0 * std::sqrt(qErr.x * qErr.x + qErr.y * qErr.y + qErr.z * qErr.z);
            m_telemetryBus->Publish("att.error", t,
                                    titan::telemetry::TelemetryValue::Scalar(errMag));
        }

        // Aero telemetry
        if (m_atmosphere)
        {
            double density = m_atmosphere->GetDensity(altitude);
            double q = 0.5 * density * speed * speed;
            m_telemetryBus->Publish("aero.dynamicPressure", t,
                                    titan::telemetry::TelemetryValue::Scalar(q));

            double temp = m_atmosphere->GetTemperature(altitude);
            if (temp > 0.0)
            {
                double gamma = 1.4;
                double R_air = 287.058;
                double soundSpeed = std::sqrt(gamma * R_air * temp);
                double mach = (soundSpeed > 0.0) ? speed / soundSpeed : 0.0;
                m_telemetryBus->Publish("aero.mach", t,
                                        titan::telemetry::TelemetryValue::Scalar(mach));
            }
        }

        // Vehicle telemetry
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

            // Drag force magnitude
            if (m_atmosphere)
            {
                double density = m_atmosphere->GetDensity(altitude);
                double dragForce = 0.5 * density * speed * speed *
                                   m_vehicle->GetDragCoefficient() *
                                   m_vehicle->GetReferenceArea();
                m_telemetryBus->Publish("vehicle.drag", t,
                                        titan::telemetry::TelemetryValue::Scalar(dragForce));
            }
        }

        // Reaction wheel telemetry
        for (size_t i = 0; i < m_reactionWheels.size(); i++)
        {
            const auto &rw = m_reactionWheels[i];
            std::string idx = std::to_string(i);
            m_telemetryBus->Publish("gnc.wheelSpeed." + idx, t,
                                    titan::telemetry::TelemetryValue::Scalar(rw.wheelSpeed));
            double momentum = rw.wheelInertia * rw.wheelSpeed;
            m_telemetryBus->Publish("gnc.wheelMomentum." + idx, t,
                                    titan::telemetry::TelemetryValue::Scalar(momentum));
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
