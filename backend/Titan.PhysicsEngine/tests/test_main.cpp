#include <iostream>
#include <cmath>
#include <cassert>
#include <string>
#include <functional>
#include <memory>

#include "math/Vector3.h"
#include "math/Vector2.h"
#include "physics/GravityModel.h"
#include "physics/AtmosphereModel.h"
#include "physics/PointMassGravity.h"
#include "physics/J2Gravity.h"
#include "physics/AtmosphericDrag.h"
#include "physics/ForceModel.h"
#include "orbital/OrbitalMechanics.h"
#include "integrators/RK4Integrator.h"
#include "integrators/EulerIntegrator.h"
#include "integrators/RK45Integrator.h"
#include "simulation/LaunchVehicle3D.h"
#include "simulation/Simulation.h"
#include "simulation/SimState.h"
#include "simulation/Stage.h"
#include "vehicle/Vehicle.h"
#include "environment/CelestialBody.h"
#include "environment/Atmosphere.h"
#include "environment/USStandardAtmosphere.h"
#include "events/EventBus.h"
#include "events/SimEvent.h"
#include "events/FlightSequencer.h"
#include "telemetry/TelemetryBus.h"
#include "gnc/Navigator.h"
#include "gnc/Controller.h"
#include "gnc/Actuator.h"
#include "guidance/OrbitalCircularizationGuidance.h"

using namespace titan;

static int testsPassed = 0;
static int testsFailed = 0;

#define ASSERT_NEAR(actual, expected, tol, msg)                                    \
    do                                                                             \
    {                                                                              \
        double _a = (actual), _e = (expected), _t = (tol);                         \
        if (std::abs(_a - _e) <= _t)                                               \
        {                                                                          \
            testsPassed++;                                                          \
        }                                                                          \
        else                                                                       \
        {                                                                          \
            testsFailed++;                                                          \
            std::cout << "  FAIL: " << msg << " | expected=" << _e                 \
                      << " actual=" << _a << " tol=" << _t << "\n";                \
        }                                                                          \
    } while (0)

#define ASSERT_TRUE(cond, msg)                                    \
    do                                                            \
    {                                                             \
        if (cond)                                                 \
        {                                                         \
            testsPassed++;                                        \
        }                                                         \
        else                                                      \
        {                                                         \
            testsFailed++;                                        \
            std::cout << "  FAIL: " << msg << "\n";               \
        }                                                         \
    } while (0)

// ============================================================
// Vector3 Tests
// ============================================================
void testVector3()
{
    std::cout << "[Vector3]\n";

    math::Vector3 a(1.0, 2.0, 3.0);
    math::Vector3 b(4.0, 5.0, 6.0);

    ASSERT_NEAR(a.Magnitude(), std::sqrt(14.0), 1e-10, "Magnitude");
    ASSERT_NEAR(math::Vector3().Magnitude(), 0.0, 1e-10, "Zero magnitude");
    ASSERT_NEAR(a.MagnitudeSquared(), 14.0, 1e-10, "MagnitudeSquared");

    auto n = a.Normalized();
    ASSERT_NEAR(n.Magnitude(), 1.0, 1e-10, "Normalized magnitude");

    ASSERT_NEAR(math::Vector3::Dot(a, b), 32.0, 1e-10, "Dot product");

    auto cross = math::Vector3::Cross(a, b);
    ASSERT_NEAR(cross.x, -3.0, 1e-10, "Cross x");
    ASSERT_NEAR(cross.y, 6.0, 1e-10, "Cross y");
    ASSERT_NEAR(cross.z, -3.0, 1e-10, "Cross z");

    auto sum = a + b;
    ASSERT_NEAR(sum.x, 5.0, 1e-10, "Add x");

    auto diff = a - b;
    ASSERT_NEAR(diff.x, -3.0, 1e-10, "Sub x");

    auto neg = -a;
    ASSERT_NEAR(neg.x, -1.0, 1e-10, "Negate x");

    auto scaled = a * 2.0;
    ASSERT_NEAR(scaled.x, 2.0, 1e-10, "Scale x");

    auto leftScaled = 3.0 * a;
    ASSERT_NEAR(leftScaled.x, 3.0, 1e-10, "Left scale x");

    auto divided = a / 2.0;
    ASSERT_NEAR(divided.x, 0.5, 1e-10, "Divide x");

    math::Vector3 c(1.0, 1.0, 1.0);
    c += a;
    ASSERT_NEAR(c.x, 2.0, 1e-10, "+= x");
    c -= a;
    ASSERT_NEAR(c.x, 1.0, 1e-10, "-= x");
    c *= 5.0;
    ASSERT_NEAR(c.x, 5.0, 1e-10, "*= x");
    c /= 5.0;
    ASSERT_NEAR(c.x, 1.0, 1e-10, "/= x");
}

// ============================================================
// Gravity Model Tests
// ============================================================
void testGravity()
{
    std::cout << "[GravityModel]\n";

    double gSurface = physics::GravityModel::ComputeGravity(0.0);
    ASSERT_NEAR(gSurface, 9.82, 0.05, "Surface gravity ~9.82 m/s^2");

    double gHigh = physics::GravityModel::ComputeGravity(200000.0);
    ASSERT_TRUE(gHigh < gSurface, "Gravity decreases with altitude");
    ASSERT_NEAR(gHigh, 9.21, 0.05, "Gravity at 200km");
}

// ============================================================
// Atmosphere Model Tests
// ============================================================
void testAtmosphere()
{
    std::cout << "[AtmosphereModel]\n";

    double rhoSurface = physics::AtmosphereModel::GetDensity(0.0);
    ASSERT_NEAR(rhoSurface, 1.225, 0.001, "Sea level density");

    double rhoHigh = physics::AtmosphereModel::GetDensity(100000.0);
    ASSERT_TRUE(rhoHigh < 1e-5, "Density very low at 100km");

    double rhoSpace = physics::AtmosphereModel::GetDensity(400000.0);
    ASSERT_TRUE(rhoSpace < 1e-15, "Near-zero density in orbit");
}

// ============================================================
// US Standard Atmosphere Tests
// ============================================================
void testUSStandardAtmosphere()
{
    std::cout << "[USStandardAtmosphere]\n";

    environment::USStandardAtmosphere atmo;

    // Sea level
    ASSERT_NEAR(atmo.GetTemperature(0.0), 288.15, 0.1, "Sea level temperature");
    ASSERT_NEAR(atmo.GetPressure(0.0), 101325.0, 1.0, "Sea level pressure");
    ASSERT_NEAR(atmo.GetDensity(0.0), 1.225, 0.01, "Sea level density");

    // Tropopause (11 km)
    ASSERT_NEAR(atmo.GetTemperature(11000.0), 216.65, 0.1, "Tropopause temperature");
    ASSERT_NEAR(atmo.GetPressure(11000.0), 22632.0, 100.0, "Tropopause pressure");

    // High altitude — very low density
    double rho100km = atmo.GetDensity(100000.0);
    ASSERT_TRUE(rho100km < 1e-5, "Density very low at 100km (US Std)");

    // Temperature should be positive everywhere
    ASSERT_TRUE(atmo.GetTemperature(50000.0) > 0.0, "Positive temperature at 50km");
    ASSERT_TRUE(atmo.GetTemperature(80000.0) > 0.0, "Positive temperature at 80km");
}

// ============================================================
// CelestialBody Tests
// ============================================================
void testCelestialBody()
{
    std::cout << "[CelestialBody]\n";

    auto earth = environment::CelestialBody::Earth();
    ASSERT_NEAR(earth.radius, 6371000.0, 1.0, "Earth radius");
    ASSERT_TRUE(earth.mu > 3.98e14, "Earth mu");
    ASSERT_TRUE(earth.J2 > 1e-3, "Earth J2");
    ASSERT_TRUE(earth.rotationRate > 7e-5, "Earth rotation rate");

    auto moon = environment::CelestialBody::Moon();
    ASSERT_TRUE(moon.radius < earth.radius, "Moon smaller than Earth");
    ASSERT_NEAR(moon.surfaceDensity, 0.0, 1e-10, "Moon no atmosphere");

    auto mars = environment::CelestialBody::Mars();
    ASSERT_TRUE(mars.surfaceDensity > 0.0, "Mars has atmosphere");
    ASSERT_TRUE(mars.surfaceDensity < earth.surfaceDensity, "Mars thinner atmosphere");
}

// ============================================================
// ForceModel Tests
// ============================================================
void testForceModels()
{
    std::cout << "[ForceModels]\n";

    auto earth = environment::CelestialBody::Earth();

    // Point mass gravity
    physics::PointMassGravity pmGrav(earth);
    simulation::SimState state(
        math::Vector3(earth.radius + 200000.0, 0.0, 0.0),
        math::Vector3(0.0, 7784.0, 0.0),
        1000.0);

    auto force = pmGrav.ComputeForce(state, 0.0);
    ASSERT_TRUE(force.x < 0.0, "Gravity force points inward");
    ASSERT_NEAR(force.y, 0.0, 1e-5, "No tangential gravity");

    double accelMag = pmGrav.ComputeAcceleration(state, 0.0).Magnitude();
    ASSERT_NEAR(accelMag, 9.21, 0.1, "Gravity acceleration at 200km");

    // J2 gravity
    physics::J2Gravity j2Grav(earth);
    auto j2Force = j2Grav.ComputeForce(state, 0.0);
    ASSERT_TRUE(j2Force.x < 0.0, "J2 gravity force points inward");

    // J2 should differ from point mass (slightly)
    double pmMag = force.Magnitude();
    double j2Mag = j2Force.Magnitude();
    ASSERT_TRUE(std::abs(pmMag - j2Mag) > 0.01, "J2 differs from point mass");

    // Atmospheric drag
    environment::Atmosphere atmo;
    physics::AtmosphericDrag drag(10.0, 0.5, atmo, earth.radius);

    simulation::SimState lowState(
        math::Vector3(earth.radius + 100.0, 0.0, 0.0),
        math::Vector3(0.0, 100.0, 0.0),
        1000.0);

    auto dragForce = drag.ComputeForce(lowState, 0.0);
    ASSERT_TRUE(dragForce.y < 0.0, "Drag opposes velocity");

    // No drag in vacuum
    simulation::SimState highState(
        math::Vector3(earth.radius + 500000.0, 0.0, 0.0),
        math::Vector3(0.0, 7000.0, 0.0),
        1000.0);
    auto highDrag = drag.ComputeForce(highState, 0.0);
    ASSERT_TRUE(highDrag.Magnitude() < 1e-10, "No drag in space");

    // Mach-dependent Cd
    auto machCd = physics::AtmosphericDrag::DefaultMachCd(0.5);
    ASSERT_NEAR(machCd(0.5), 0.5, 0.01, "Subsonic Cd");
    ASSERT_TRUE(machCd(1.0) > 0.5, "Transonic Cd > subsonic");
    ASSERT_TRUE(machCd(3.0) > 0.5, "Supersonic Cd > subsonic");
}

// ============================================================
// Event System Tests
// ============================================================
void testEventSystem()
{
    std::cout << "[EventSystem]\n";

    events::EventBus bus;

    int stageCount = 0;
    int totalCount = 0;

    bus.Subscribe(events::EventType::StageSeparation,
                  [&](const events::SimEvent &)
                  { stageCount++; });

    bus.SubscribeAll([&](const events::SimEvent &)
                     { totalCount++; });

    bus.Emit(events::SimEvent(10.0, events::EventType::StageSeparation, "Stage 0 separated"));
    bus.Emit(events::SimEvent(20.0, events::EventType::MaxQ, "Max Q"));

    ASSERT_TRUE(stageCount == 1, "Stage separation handler fired once");
    ASSERT_TRUE(totalCount == 2, "Global handler fired twice");
    ASSERT_TRUE(bus.GetEventLog().size() == 2, "Event log has 2 entries");

    // Scheduled events
    bus.ScheduleEvent(50.0, events::SimEvent(0.0, events::EventType::FairingJettison, "Fairing jettison"));
    bus.ProcessScheduledEvents(49.0);
    ASSERT_TRUE(totalCount == 2, "Scheduled event not yet fired");
    bus.ProcessScheduledEvents(51.0);
    ASSERT_TRUE(totalCount == 3, "Scheduled event fired");
}

// ============================================================
// Flight Sequencer Tests
// ============================================================
void testFlightSequencer()
{
    std::cout << "[FlightSequencer]\n";

    auto bus = std::make_shared<events::EventBus>();
    events::FlightSequencer seq(bus);

    int eventCount = 0;
    bus->SubscribeAll([&](const events::SimEvent &)
                      { eventCount++; });

    seq.AddTimedEvent(10.0, events::SimEvent(0.0, events::EventType::StageIgnition, "Stage 1 ignition"));

    seq.AddConditionalEvent(
        [](const simulation::SimState &state)
        { return state.position.Magnitude() > 6500000.0; },
        events::SimEvent(0.0, events::EventType::FairingJettison, "Fairing jettison at altitude"));

    simulation::SimState state;
    state.position = math::Vector3(6400000.0, 0.0, 0.0);

    seq.Update(5.0, state);
    ASSERT_TRUE(eventCount == 0, "No events before trigger");

    seq.Update(10.0, state);
    ASSERT_TRUE(eventCount == 1, "Timed event fired");

    state.position = math::Vector3(6600000.0, 0.0, 0.0);
    seq.Update(15.0, state);
    ASSERT_TRUE(eventCount == 2, "Conditional event fired");

    // Don't re-fire
    seq.Update(20.0, state);
    ASSERT_TRUE(eventCount == 2, "Events don't re-fire");
}

// ============================================================
// Telemetry Bus Tests
// ============================================================
void testTelemetryBus()
{
    std::cout << "[TelemetryBus]\n";

    telemetry::TelemetryBus bus;

    double lastAltitude = -1.0;
    bus.Subscribe("nav.altitude", [&](const std::string &, double, const telemetry::TelemetryValue &v)
                  { lastAltitude = v.scalar; });

    bus.Publish("nav.altitude", 1.0, telemetry::TelemetryValue::Scalar(100000.0));
    ASSERT_NEAR(lastAltitude, 100000.0, 0.1, "Altitude subscriber received value");

    bus.Publish("nav.velocity", 1.0, telemetry::TelemetryValue::Scalar(7800.0));
    ASSERT_TRUE(bus.GetRecords().size() == 2, "Two records published");
}

// ============================================================
// Vehicle Tests
// ============================================================
void testVehicle()
{
    std::cout << "[Vehicle]\n";

    vehicle::Vehicle v;
    v.AddStage(simulation::Stage(10000.0, 100000.0, 1000.0, 3000.0, 10.0, 0.5));
    v.AddStage(simulation::Stage(2000.0, 20000.0, 300.0, 3400.0, 5.0, 0.3));

    ASSERT_NEAR(v.GetTotalMass(), 132000.0, 1.0, "Total mass = sum of all stages");
    ASSERT_TRUE(v.GetThrust() > 0.0, "Has thrust");
    ASSERT_TRUE(v.GetCurrentStageIndex() == 0, "Starts at stage 0");
    ASSERT_TRUE(!v.IsExhausted(), "Not exhausted");

    // Burn through first stage
    for (int i = 0; i < 200; i++)
        v.Burn(1.0);

    ASSERT_TRUE(v.ShouldSeparateStage(), "Should separate after burnout");

    auto bus = std::make_shared<events::EventBus>();
    bool separated = v.SeparateStage(200.0, bus.get());
    ASSERT_TRUE(separated, "Stage separation successful");
    ASSERT_TRUE(v.GetCurrentStageIndex() == 1, "Now on stage 1");
    ASSERT_TRUE(bus->GetEventLog().size() == 1, "Separation event emitted");
}

// ============================================================
// GNC Interface Tests
// ============================================================
void testGNCInterfaces()
{
    std::cout << "[GNC Interfaces]\n";

    // IdealNavigator
    gnc::IdealNavigator nav;
    simulation::SimState state(
        math::Vector3(6571000.0, 0.0, 0.0),
        math::Vector3(0.0, 7784.0, 0.0),
        1000.0);

    auto estimate = nav.EstimateState(state, 0.0);
    ASSERT_NEAR(estimate.position.x, state.position.x, 1e-10, "Ideal navigator position");
    ASSERT_NEAR(estimate.velocity.y, state.velocity.y, 1e-10, "Ideal navigator velocity");

    // ReactionWheel
    gnc::ReactionWheel wheel(math::Vector3(0.0, 0.0, 1.0), 0.1);
    auto torque = wheel.ComputeTorque(1.0, state);
    ASSERT_NEAR(torque.z, 0.1, 1e-10, "Reaction wheel torque");
    auto force = wheel.ComputeForce(1.0, state);
    ASSERT_NEAR(force.Magnitude(), 0.0, 1e-10, "Reaction wheel no force");

    // Thruster
    gnc::Thruster thruster(
        math::Vector3(1.0, 0.0, 0.0),
        math::Vector3(0.0, 1.0, 0.0),
        100.0);
    auto tForce = thruster.ComputeForce(1.0, state);
    ASSERT_NEAR(tForce.x, 100.0, 1e-10, "Thruster force");
    auto tTorque = thruster.ComputeTorque(1.0, state);
    ASSERT_TRUE(tTorque.Magnitude() > 0.0, "Thruster produces torque from offset");
}

// ============================================================
// Orbital Elements 3D Tests
// ============================================================
void testOrbitalElements3D()
{
    std::cout << "[OrbitalElements3D]\n";

    const double mu = 3.986e14;
    const double R = 6371000.0;

    double r = R + 200000.0;
    double v_circ = std::sqrt(mu / r);

    math::Vector3 pos(r, 0.0, 0.0);
    math::Vector3 vel(0.0, v_circ, 0.0);

    auto elements = orbital::OrbitalMechanics::ComputeOrbitalElements(pos, vel, mu);

    ASSERT_NEAR(elements.eccentricity, 0.0, 1e-5, "Circular orbit e~0");
    ASSERT_NEAR(elements.semiMajorAxis, r, 1000.0, "Semi-major axis = r");
    ASSERT_NEAR(elements.apoapsis, r, 2000.0, "Apoapsis = r");
    ASSERT_NEAR(elements.periapsis, r, 2000.0, "Periapsis = r");
    ASSERT_NEAR(elements.inclination, 0.0, 1e-5, "Equatorial orbit i=0");

    // Polar orbit
    math::Vector3 posP(r, 0.0, 0.0);
    math::Vector3 velP(0.0, 0.0, v_circ);

    auto elemP = orbital::OrbitalMechanics::ComputeOrbitalElements(posP, velP, mu);
    ASSERT_NEAR(elemP.eccentricity, 0.0, 1e-5, "Polar circular e~0");
    ASSERT_NEAR(elemP.inclination, M_PI / 2.0, 1e-5, "Polar orbit i=90deg");

    // Elliptical orbit
    math::Vector3 posE(r, 0.0, 0.0);
    math::Vector3 velE(0.0, v_circ * 1.2, 0.0);

    auto elemE = orbital::OrbitalMechanics::ComputeOrbitalElements(posE, velE, mu);
    ASSERT_TRUE(elemE.eccentricity > 0.05, "Elliptical orbit e > 0");
    ASSERT_TRUE(elemE.apoapsis > r, "Apoapsis > r for elliptical");

    // 2D backward compatibility
    math::Vector2 pos2(r, 0.0);
    math::Vector2 vel2(0.0, v_circ);

    auto elem2D = orbital::OrbitalMechanics::ComputeOrbitalElements(pos2, vel2, mu);
    ASSERT_NEAR(elem2D.eccentricity, 0.0, 1e-5, "2D circular e~0");
    ASSERT_NEAR(elem2D.semiMajorAxis, r, 1000.0, "2D semi-major axis");
}

// ============================================================
// RK4 Integrator Test
// ============================================================
void testRK4()
{
    std::cout << "[RK4Integrator]\n";

    integrators::RK4Integrator rk4;

    integrators::State state{1.0, 0.0, 0.0, 0.0, 0.0, 0.0};
    double dt = 0.001;

    for (int i = 0; i < 1000; i++)
    {
        auto result = rk4.Step(state, dt,
                               [](const integrators::State &s) -> integrators::Derivative
                               {
                                   return {s.vx, 0.0, 0.0, -s.x, 0.0, 0.0};
                               });
        state = result.state;
    }

    ASSERT_NEAR(state.x, std::cos(1.0), 1e-8, "RK4 harmonic x at t=1");
    ASSERT_NEAR(state.vx, -std::sin(1.0), 1e-8, "RK4 harmonic vx at t=1");
}

// ============================================================
// RK45 Integrator Test
// ============================================================
void testRK45()
{
    std::cout << "[RK45Integrator]\n";

    integrators::RK45Integrator rk45(1e-10, 1e-8, 1e-6, 1.0);

    integrators::State state{1.0, 0.0, 0.0, 0.0, 0.0, 0.0};

    auto result = rk45.Step(state, 1.0,
                            [](const integrators::State &s) -> integrators::Derivative
                            {
                                return {s.vx, 0.0, 0.0, -s.x, 0.0, 0.0};
                            });

    state = result.state;
    ASSERT_NEAR(state.x, std::cos(1.0), 1e-6, "RK45 harmonic x at t=1");
    ASSERT_NEAR(state.vx, -std::sin(1.0), 1e-6, "RK45 harmonic vx at t=1");
    ASSERT_NEAR(result.dt_used, 1.0, 1e-10, "RK45 dt_used = requested dt");
}

// ============================================================
// New Simulation Class Integration Test
// ============================================================
void testNewSimulation()
{
    std::cout << "[New Simulation]\n";

    auto body = environment::CelestialBody::Earth();

    auto integrator = std::make_unique<integrators::RK4Integrator>();
    auto guidance = std::make_unique<guidance::OrbitalCircularizationGuidance>(
        200000.0, body.radius);

    simulation::Simulation sim(body, std::move(integrator), std::move(guidance));

    sim.AddForce(std::make_unique<physics::PointMassGravity>(body));

    auto atmosphere = std::make_unique<environment::Atmosphere>();
    auto atmosphereRef = environment::Atmosphere();
    sim.SetAtmosphere(std::move(atmosphere));

    sim.AddForce(std::make_unique<physics::AtmosphericDrag>(
        10.0, 0.5, atmosphereRef, body.radius));

    auto vehicle = std::make_unique<vehicle::Vehicle>();
    vehicle->AddStage(simulation::Stage(
        10000.0, 120000.0, 1500.0, 2800.0, 10.0, 0.5));
    vehicle->AddStage(simulation::Stage(
        2000.0, 20000.0, 300.0, 3400.0, 5.0, 0.3));

    sim.SetVehicle(std::move(vehicle));
    sim.SetMaxG(4.0);

    auto eventBus = std::make_shared<events::EventBus>();
    sim.SetEventBus(eventBus);

    auto telBus = std::make_shared<telemetry::TelemetryBus>();
    sim.SetTelemetryBus(telBus);

    // Run for a bit
    double maxAltitude = 0.0;
    double maxVelocity = 0.0;

    for (int i = 0; i < 6000; i++) // 600s at 0.1s steps
    {
        auto result = sim.Step(0.1);

        if (result.status == simulation::SimStatus::Impact ||
            result.status == simulation::SimStatus::Error)
            break;

        double alt = result.state.position.Magnitude() - body.radius;
        double vel = result.state.velocity.Magnitude();

        if (alt > maxAltitude)
            maxAltitude = alt;
        if (vel > maxVelocity)
            maxVelocity = vel;

        if (result.status == simulation::SimStatus::Completed)
            break;
    }

    ASSERT_TRUE(maxAltitude > 100000.0, "New sim max altitude > 100 km");
    ASSERT_TRUE(maxVelocity > 2000.0, "New sim max velocity > 2000 m/s");
    ASSERT_TRUE(telBus->GetRecords().size() > 0, "Telemetry records generated");

    std::cout << "  Max altitude: " << maxAltitude / 1000.0 << " km\n";
    std::cout << "  Max velocity: " << maxVelocity << " m/s\n";
    std::cout << "  Telemetry records: " << telBus->GetRecords().size() << "\n";
    std::cout << "  Events: " << eventBus->GetEventLog().size() << "\n";
}

// ============================================================
// Legacy LaunchVehicle3D Test (no std::exit / std::cout)
// ============================================================
void testLegacyVehicle3D()
{
    std::cout << "[Legacy LaunchVehicle3D]\n";

    const double earthRadius = 6371000.0;
    const double mu = 3.986e14;

    auto integrator = std::make_unique<integrators::RK4Integrator>();
    auto guidance = std::make_unique<guidance::OrbitalCircularizationGuidance>(
        200000.0, earthRadius);

    simulation::LaunchVehicle3D rocket(
        earthRadius, mu,
        std::move(integrator),
        std::move(guidance));

    rocket.SetMaxG(4.0);

    rocket.AddStage(simulation::Stage(
        22200.0, 395700.0, 2770.0, 2770.0, 10.75, 0.5));

    rocket.AddStage(simulation::Stage(
        3900.0, 92670.0, 287.0, 3413.0, 10.75, 0.3));

    double maxAltitude = 0.0;

    for (double t = 0.0; t < 300.0; t += 0.1)
    {
        rocket.Update(0.1);

        if (rocket.HasImpacted())
            break;

        auto pos = rocket.GetPosition();
        if (std::isnan(pos.x))
            break;

        double altitude = pos.Magnitude() - earthRadius;
        if (altitude > maxAltitude)
            maxAltitude = altitude;
    }

    ASSERT_TRUE(maxAltitude > 50000.0, "Legacy 3D max altitude > 50 km");
    ASSERT_TRUE(!rocket.HasImpacted(), "Legacy 3D no impact in 300s");
    ASSERT_TRUE(rocket.GetStageIndex() >= 0, "Stage index valid");

    std::cout << "  Max altitude: " << maxAltitude / 1000.0 << " km\n";
    std::cout << "  Stage index: " << rocket.GetStageIndex() << "\n";
}

// ============================================================
// Main
// ============================================================
int main()
{
    std::cout << "=== Titan Physics Engine Test Suite ===\n\n";

    testVector3();
    testGravity();
    testAtmosphere();
    testUSStandardAtmosphere();
    testCelestialBody();
    testForceModels();
    testEventSystem();
    testFlightSequencer();
    testTelemetryBus();
    testVehicle();
    testGNCInterfaces();
    testOrbitalElements3D();
    testRK4();
    testRK45();
    testNewSimulation();
    testLegacyVehicle3D();

    std::cout << "\n=== Results ===\n";
    std::cout << "Passed: " << testsPassed << "\n";
    std::cout << "Failed: " << testsFailed << "\n";

    if (testsFailed > 0)
    {
        std::cout << "\nSOME TESTS FAILED\n";
        return 1;
    }

    std::cout << "\nALL TESTS PASSED\n";
    return 0;
}
