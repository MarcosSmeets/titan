#include <iostream>
#include <cmath>
#include <cassert>
#include <string>
#include <functional>
#include <memory>
#include <fstream>

#include "math/Vector3.h"
#include "math/Vector2.h"
#include "math/Quaternion.h"
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
#include "gnc/PIDController.h"
#include "gnc/PointingMode.h"
#include "guidance/OrbitalCircularizationGuidance.h"
#include "export/DataExporter.h"

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
// Quaternion Tests
// ============================================================
void testQuaternion()
{
    std::cout << "[Quaternion]\n";

    // Identity
    math::Quaternion id;
    ASSERT_NEAR(id.w, 1.0, 1e-10, "Identity w");
    ASSERT_NEAR(id.Norm(), 1.0, 1e-10, "Identity norm");

    // Normalize
    math::Quaternion q(2.0, 0.0, 0.0, 0.0);
    auto qn = q.Normalized();
    ASSERT_NEAR(qn.Norm(), 1.0, 1e-10, "Normalized norm");
    ASSERT_NEAR(qn.w, 1.0, 1e-10, "Normalized w");

    // Hamilton product: identity * q = q
    math::Quaternion q1 = math::Quaternion::FromAxisAngle(math::Vector3(0, 0, 1), M_PI / 2.0);
    auto prod = math::Quaternion::Identity() * q1;
    ASSERT_NEAR(prod.w, q1.w, 1e-10, "Identity product w");
    ASSERT_NEAR(prod.x, q1.x, 1e-10, "Identity product x");
    ASSERT_NEAR(prod.y, q1.y, 1e-10, "Identity product y");
    ASSERT_NEAR(prod.z, q1.z, 1e-10, "Identity product z");

    // Conjugate: q * q* = identity (for unit quaternion)
    auto conj = q1.Conjugate();
    auto ident = q1 * conj;
    ASSERT_NEAR(ident.w, 1.0, 1e-10, "q*q_conj w");
    ASSERT_NEAR(ident.x, 0.0, 1e-10, "q*q_conj x");
    ASSERT_NEAR(ident.y, 0.0, 1e-10, "q*q_conj y");
    ASSERT_NEAR(ident.z, 0.0, 1e-10, "q*q_conj z");

    // Rotate vector: 90 degrees about Z should rotate X -> Y
    auto rotZ90 = math::Quaternion::FromAxisAngle(math::Vector3(0, 0, 1), M_PI / 2.0);
    auto rotated = rotZ90.RotateVector(math::Vector3(1, 0, 0));
    ASSERT_NEAR(rotated.x, 0.0, 1e-10, "RotZ90 x->0");
    ASSERT_NEAR(rotated.y, 1.0, 1e-10, "RotZ90 y->1");
    ASSERT_NEAR(rotated.z, 0.0, 1e-10, "RotZ90 z->0");

    // 180 degrees about Z: X -> -X
    auto rotZ180 = math::Quaternion::FromAxisAngle(math::Vector3(0, 0, 1), M_PI);
    auto rot180 = rotZ180.RotateVector(math::Vector3(1, 0, 0));
    ASSERT_NEAR(rot180.x, -1.0, 1e-10, "RotZ180 x->-1");
    ASSERT_NEAR(rot180.y, 0.0, 1e-10, "RotZ180 y->0");

    // Euler round-trip
    double r_in = 0.3, p_in = 0.2, y_in = 0.5;
    auto qEuler = math::Quaternion::FromEuler(r_in, p_in, y_in);
    double r_out, p_out, y_out;
    qEuler.ToEuler(r_out, p_out, y_out);
    ASSERT_NEAR(r_out, r_in, 1e-10, "Euler round-trip roll");
    ASSERT_NEAR(p_out, p_in, 1e-10, "Euler round-trip pitch");
    ASSERT_NEAR(y_out, y_in, 1e-10, "Euler round-trip yaw");

    // Kinematic derivative: for constant rotation about Z at omega_z
    math::Quaternion qIdentity;
    double omega_z = 1.0;
    auto qdot = qIdentity.KinematicDerivative(math::Vector3(0, 0, omega_z));
    ASSERT_NEAR(qdot.w, 0.0, 1e-10, "Kinematic deriv w");
    ASSERT_NEAR(qdot.z, 0.5, 1e-10, "Kinematic deriv z = omega_z/2");

    // FromAxisAngle + magnitude
    auto q90 = math::Quaternion::FromAxisAngle(math::Vector3(1, 0, 0), M_PI / 2.0);
    ASSERT_NEAR(q90.Norm(), 1.0, 1e-10, "FromAxisAngle norm");
    ASSERT_NEAR(q90.w, std::cos(M_PI / 4.0), 1e-10, "FromAxisAngle w");
    ASSERT_NEAR(q90.x, std::sin(M_PI / 4.0), 1e-10, "FromAxisAngle x");
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

    ASSERT_NEAR(atmo.GetTemperature(0.0), 288.15, 0.1, "Sea level temperature");
    ASSERT_NEAR(atmo.GetPressure(0.0), 101325.0, 1.0, "Sea level pressure");
    ASSERT_NEAR(atmo.GetDensity(0.0), 1.225, 0.01, "Sea level density");

    ASSERT_NEAR(atmo.GetTemperature(11000.0), 216.65, 0.1, "Tropopause temperature");
    ASSERT_NEAR(atmo.GetPressure(11000.0), 22632.0, 100.0, "Tropopause pressure");

    double rho100km = atmo.GetDensity(100000.0);
    ASSERT_TRUE(rho100km < 1e-5, "Density very low at 100km (US Std)");

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

    physics::J2Gravity j2Grav(earth);
    auto j2Force = j2Grav.ComputeForce(state, 0.0);
    ASSERT_TRUE(j2Force.x < 0.0, "J2 gravity force points inward");

    double pmMag = force.Magnitude();
    double j2Mag = j2Force.Magnitude();
    ASSERT_TRUE(std::abs(pmMag - j2Mag) > 0.01, "J2 differs from point mass");

    environment::Atmosphere atmo;
    physics::AtmosphericDrag drag(10.0, 0.5, atmo, earth.radius);

    simulation::SimState lowState(
        math::Vector3(earth.radius + 100.0, 0.0, 0.0),
        math::Vector3(0.0, 100.0, 0.0),
        1000.0);

    auto dragForce = drag.ComputeForce(lowState, 0.0);
    ASSERT_TRUE(dragForce.y < 0.0, "Drag opposes velocity");

    simulation::SimState highState(
        math::Vector3(earth.radius + 500000.0, 0.0, 0.0),
        math::Vector3(0.0, 7000.0, 0.0),
        1000.0);
    auto highDrag = drag.ComputeForce(highState, 0.0);
    ASSERT_TRUE(highDrag.Magnitude() < 1e-10, "No drag in space");

    auto machCd = physics::AtmosphericDrag::DefaultMachCd(0.5);
    ASSERT_NEAR(machCd(0.5), 0.5, 0.01, "Subsonic Cd");
    ASSERT_TRUE(machCd(1.0) > 0.5, "Transonic Cd > subsonic");
    ASSERT_TRUE(machCd(3.0) > 0.5, "Supersonic Cd > subsonic");

    // ComputeTorque default returns zero
    auto torque = pmGrav.ComputeTorque(state, 0.0);
    ASSERT_NEAR(torque.Magnitude(), 0.0, 1e-15, "Default ComputeTorque returns zero");
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

    // Test Quat value
    auto qv = telemetry::TelemetryValue::Quat(1.0, 0.0, 0.0, 0.0);
    ASSERT_NEAR(qv.w, 1.0, 1e-10, "Quat w field");
    ASSERT_NEAR(qv.x, 0.0, 1e-10, "Quat x field");
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

    // Composite inertia
    auto inertia = v.GetInertia();
    ASSERT_TRUE(inertia.x > 0.0, "Vehicle has Ixx > 0");
    ASSERT_TRUE(inertia.y > 0.0, "Vehicle has Iyy > 0");
    ASSERT_TRUE(inertia.z > 0.0, "Vehicle has Izz > 0");

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

    gnc::IdealNavigator nav;
    simulation::SimState state(
        math::Vector3(6571000.0, 0.0, 0.0),
        math::Vector3(0.0, 7784.0, 0.0),
        1000.0);

    auto estimate = nav.EstimateState(state, 0.0);
    ASSERT_NEAR(estimate.position.x, state.position.x, 1e-10, "Ideal navigator position");
    ASSERT_NEAR(estimate.velocity.y, state.velocity.y, 1e-10, "Ideal navigator velocity");

    gnc::ReactionWheel wheel(math::Vector3(0.0, 0.0, 1.0), 0.1);
    auto torque = wheel.ComputeTorque(1.0, state);
    ASSERT_NEAR(torque.z, 0.1, 1e-10, "Reaction wheel torque");
    auto force = wheel.ComputeForce(1.0, state);
    ASSERT_NEAR(force.Magnitude(), 0.0, 1e-10, "Reaction wheel no force");

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

    math::Vector3 posP(r, 0.0, 0.0);
    math::Vector3 velP(0.0, 0.0, v_circ);

    auto elemP = orbital::OrbitalMechanics::ComputeOrbitalElements(posP, velP, mu);
    ASSERT_NEAR(elemP.eccentricity, 0.0, 1e-5, "Polar circular e~0");
    ASSERT_NEAR(elemP.inclination, M_PI / 2.0, 1e-5, "Polar orbit i=90deg");

    math::Vector3 posE(r, 0.0, 0.0);
    math::Vector3 velE(0.0, v_circ * 1.2, 0.0);

    auto elemE = orbital::OrbitalMechanics::ComputeOrbitalElements(posE, velE, mu);
    ASSERT_TRUE(elemE.eccentricity > 0.05, "Elliptical orbit e > 0");
    ASSERT_TRUE(elemE.apoapsis > r, "Apoapsis > r for elliptical");

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
// RK4 Vector Integrator Test
// ============================================================
void testRK4Vector()
{
    std::cout << "[RK4VectorIntegrator]\n";

    integrators::RK4Integrator rk4;

    // Same harmonic oscillator but using StepVector with a 4-element state
    integrators::StateVector state = {1.0, 0.0, 0.0, 0.0};
    double dt = 0.001;

    for (int i = 0; i < 1000; i++)
    {
        auto result = rk4.StepVector(state, dt,
                                     [](const integrators::StateVector &s) -> integrators::DerivativeVector
                                     {
                                         return {s[1], -s[0], s[3], -s[2]};
                                     });
        state = result.state;
    }

    ASSERT_NEAR(state[0], std::cos(1.0), 1e-8, "RK4 vector harmonic x at t=1");
    ASSERT_NEAR(state[1], -std::sin(1.0), 1e-8, "RK4 vector harmonic vx at t=1");
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
// RK45 Vector Integrator Test
// ============================================================
void testRK45Vector()
{
    std::cout << "[RK45VectorIntegrator]\n";

    integrators::RK45Integrator rk45(1e-10, 1e-8, 1e-6, 1.0);

    integrators::StateVector state = {1.0, 0.0};

    auto result = rk45.StepVector(state, 1.0,
                                  [](const integrators::StateVector &s) -> integrators::DerivativeVector
                                  {
                                      return {s[1], -s[0]};
                                  });

    ASSERT_NEAR(result.state[0], std::cos(1.0), 1e-6, "RK45 vector harmonic x at t=1");
    ASSERT_NEAR(result.state[1], -std::sin(1.0), 1e-6, "RK45 vector harmonic vx at t=1");
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

    double maxAltitude = 0.0;
    double maxVelocity = 0.0;

    for (int i = 0; i < 6000; i++)
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
// Legacy LaunchVehicle3D Test
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
// 6DOF Torque-Free Rotation Test
// ============================================================
void test6DOFTorqueFree()
{
    std::cout << "[6DOF Torque-Free Rotation]\n";

    auto body = environment::CelestialBody::Earth();
    auto integrator = std::make_unique<integrators::RK4Integrator>();
    auto guidance = std::make_unique<guidance::OrbitalCircularizationGuidance>(
        200000.0, body.radius);

    simulation::Simulation sim(body, std::move(integrator), std::move(guidance));
    sim.AddForce(std::make_unique<physics::PointMassGravity>(body));

    auto vehicle = std::make_unique<vehicle::Vehicle>();
    simulation::Stage stage(2000.0, 0.0, 0.0, 0.0, 5.0, 0.3);
    stage.SetInertia(1000.0, 1000.0, 500.0);
    vehicle->AddStage(stage);
    sim.SetVehicle(std::move(vehicle));

    // Start in orbit with initial spin
    double r = body.radius + 400000.0;
    double v_circ = std::sqrt(body.mu / r);
    simulation::SimState initState;
    initState.position = math::Vector3(r, 0.0, 0.0);
    initState.velocity = math::Vector3(0.0, v_circ, 0.0);
    initState.angularVelocity = math::Vector3(0.0, 0.0, 0.1); // spin about Z
    initState.mass = 2000.0;
    sim.SetInitialState(initState);

    // Enable 6DOF by adding a reaction wheel (but don't command it)
    sim.AddReactionWheel(math::Vector3(0, 0, 1), 0.0, 0.0, 0.001);

    simulation::CompletionCriteria criteria;
    criteria.enabled = false;
    sim.SetCompletionCriteria(criteria);

    // Integrate for 10 seconds
    for (int i = 0; i < 100; i++)
    {
        auto result = sim.Step(0.1);
        if (result.status != simulation::SimStatus::Running)
            break;
    }

    const auto &state = sim.GetState();

    // Angular momentum should be conserved (torque-free)
    // For symmetric body spinning about Z: L_z = Izz * omega_z = 500 * 0.1 = 50
    double Lz = 500.0 * state.angularVelocity.z;
    ASSERT_NEAR(Lz, 50.0, 0.5, "Angular momentum conserved");

    // Quaternion should stay normalized
    ASSERT_NEAR(state.attitude.Norm(), 1.0, 1e-8, "Quaternion stays normalized");

    // Spin rate should be approximately preserved
    ASSERT_NEAR(state.angularVelocity.z, 0.1, 0.01, "Spin rate preserved");

    std::cout << "  omega_z: " << state.angularVelocity.z << " rad/s\n";
    std::cout << "  quat norm: " << state.attitude.Norm() << "\n";
}

// ============================================================
// PID Controller Test
// ============================================================
void testPIDController()
{
    std::cout << "[PID Controller]\n";

    gnc::PIDGains gains;
    gains.Kp = 10.0;
    gains.Ki = 0.1;
    gains.Kd = 5.0;
    gains.maxIntegral = 50.0;

    gnc::PIDAttitudeController controller(gains);

    // Current state: rotated 10 degrees about Z
    simulation::SimState current;
    current.attitude = math::Quaternion::FromAxisAngle(math::Vector3(0, 0, 1), 0.175);

    // Desired: identity
    simulation::SimState desired;
    desired.attitude = math::Quaternion::Identity();

    auto cmd = controller.Compute(current, desired, 0.01);

    // Should produce torque about Z to correct the error
    ASSERT_TRUE(cmd.torqueCommand.Magnitude() > 0.0, "PID produces non-zero torque");
    ASSERT_TRUE(std::abs(cmd.torqueCommand.z) > std::abs(cmd.torqueCommand.x),
                "PID torque primarily about Z axis");

    std::cout << "  Torque: (" << cmd.torqueCommand.x << ", "
              << cmd.torqueCommand.y << ", " << cmd.torqueCommand.z << ")\n";
}

// ============================================================
// 6DOF PID Convergence Test
// ============================================================
void test6DOFPIDConvergence()
{
    std::cout << "[6DOF PID Convergence]\n";

    auto body = environment::CelestialBody::Earth();
    auto integrator = std::make_unique<integrators::RK4Integrator>();
    auto guidance = std::make_unique<guidance::OrbitalCircularizationGuidance>(
        200000.0, body.radius);

    simulation::Simulation sim(body, std::move(integrator), std::move(guidance));
    sim.AddForce(std::make_unique<physics::PointMassGravity>(body));

    auto vehicle = std::make_unique<vehicle::Vehicle>();
    simulation::Stage stage(2000.0, 0.0, 0.0, 0.0, 5.0, 0.3);
    stage.SetInertia(100.0, 100.0, 50.0);
    vehicle->AddStage(stage);
    sim.SetVehicle(std::move(vehicle));

    double r = body.radius + 400000.0;
    double v_circ = std::sqrt(body.mu / r);
    simulation::SimState initState;
    initState.position = math::Vector3(r, 0.0, 0.0);
    initState.velocity = math::Vector3(0.0, v_circ, 0.0);
    // Start tilted 30 degrees
    initState.attitude = math::Quaternion::FromAxisAngle(math::Vector3(0, 0, 1), 0.524);
    initState.mass = 2000.0;
    sim.SetInitialState(initState);

    // Set up PID controller pointing to identity
    gnc::PIDGains gains;
    gains.Kp = 2.0;
    gains.Ki = 0.01;
    gains.Kd = 10.0;
    gains.maxIntegral = 10.0;
    sim.SetController(std::make_unique<gnc::PIDAttitudeController>(gains));
    sim.SetPointingMode(std::make_unique<gnc::InertialHold>());

    // Add reaction wheels on all 3 axes with ample capacity
    sim.AddReactionWheel(math::Vector3(1, 0, 0), 10.0, 100.0, 0.5);
    sim.AddReactionWheel(math::Vector3(0, 1, 0), 10.0, 100.0, 0.5);
    sim.AddReactionWheel(math::Vector3(0, 0, 1), 10.0, 100.0, 0.5);

    simulation::CompletionCriteria criteria;
    criteria.enabled = false;
    sim.SetCompletionCriteria(criteria);

    // Run for 60 seconds
    for (int i = 0; i < 600; i++)
    {
        auto result = sim.Step(0.1);
        if (result.status != simulation::SimStatus::Running)
            break;
    }

    const auto &state = sim.GetState();

    // Check attitude error - should have converged toward identity
    auto qErr = state.attitude.ErrorTo(math::Quaternion::Identity());
    double errMag = 2.0 * std::sqrt(qErr.x * qErr.x + qErr.y * qErr.y + qErr.z * qErr.z);

    ASSERT_TRUE(errMag < 0.2, "PID converges to target (error < 0.2 rad)");
    ASSERT_NEAR(state.attitude.Norm(), 1.0, 1e-8, "Quaternion normalized after PID");

    std::cout << "  Final attitude error: " << errMag << " rad\n";
    std::cout << "  Final omega: (" << state.angularVelocity.x << ", "
              << state.angularVelocity.y << ", " << state.angularVelocity.z << ")\n";
}

// ============================================================
// Reaction Wheel Saturation Test
// ============================================================
void testReactionWheelSaturation()
{
    std::cout << "[Reaction Wheel Saturation]\n";

    auto body = environment::CelestialBody::Earth();
    auto integrator = std::make_unique<integrators::RK4Integrator>();
    auto guidance = std::make_unique<guidance::OrbitalCircularizationGuidance>(
        200000.0, body.radius);

    simulation::Simulation sim(body, std::move(integrator), std::move(guidance));
    sim.AddForce(std::make_unique<physics::PointMassGravity>(body));

    auto vehicle = std::make_unique<vehicle::Vehicle>();
    simulation::Stage stage(2000.0, 0.0, 0.0, 0.0, 5.0, 0.3);
    stage.SetInertia(100.0, 100.0, 50.0);
    vehicle->AddStage(stage);
    sim.SetVehicle(std::move(vehicle));

    double r = body.radius + 400000.0;
    double v_circ = std::sqrt(body.mu / r);
    simulation::SimState initState;
    initState.position = math::Vector3(r, 0.0, 0.0);
    initState.velocity = math::Vector3(0.0, v_circ, 0.0);
    initState.attitude = math::Quaternion::FromAxisAngle(math::Vector3(0, 0, 1), 1.0); // large offset
    initState.mass = 2000.0;
    sim.SetInitialState(initState);

    gnc::PIDGains gains;
    gains.Kp = 20.0;
    gains.Ki = 0.0;
    gains.Kd = 0.0;
    sim.SetController(std::make_unique<gnc::PIDAttitudeController>(gains));
    sim.SetPointingMode(std::make_unique<gnc::InertialHold>());

    // Small reaction wheel with low max momentum (will saturate quickly)
    sim.AddReactionWheel(math::Vector3(0, 0, 1), 1.0, 0.5, 0.01);

    auto telBus = std::make_shared<telemetry::TelemetryBus>();
    sim.SetTelemetryBus(telBus);

    simulation::CompletionCriteria criteria;
    criteria.enabled = false;
    sim.SetCompletionCriteria(criteria);

    for (int i = 0; i < 200; i++)
        sim.Step(0.1);

    // Wheel should have telemetry
    bool hasWheelSpeed = false;
    for (const auto &rec : telBus->GetRecords())
    {
        if (rec.channel == "gnc.wheelSpeed.0")
        {
            hasWheelSpeed = true;
            break;
        }
    }
    ASSERT_TRUE(hasWheelSpeed, "Wheel speed telemetry published");
    ASSERT_TRUE(telBus->GetRecords().size() > 0, "Telemetry generated with RW");
}

// ============================================================
// Pointing Mode Tests
// ============================================================
void testPointingModes()
{
    std::cout << "[Pointing Modes]\n";

    simulation::SimState state;
    state.position = math::Vector3(6771000.0, 0.0, 0.0);
    state.velocity = math::Vector3(0.0, 7700.0, 0.0);

    // Inertial hold returns fixed quaternion
    auto target = math::Quaternion::FromAxisAngle(math::Vector3(1, 0, 0), 0.5);
    gnc::InertialHold hold(target);
    auto desired = hold.ComputeDesiredAttitude(state, 0.0);
    ASSERT_NEAR(desired.w, target.w, 1e-10, "InertialHold returns target w");
    ASSERT_NEAR(desired.x, target.x, 1e-10, "InertialHold returns target x");

    // Nadir pointing should produce a valid unit quaternion
    gnc::NadirPointing nadir;
    auto nadirAtt = nadir.ComputeDesiredAttitude(state, 0.0);
    ASSERT_NEAR(nadirAtt.Norm(), 1.0, 1e-8, "Nadir quaternion is unit");

    // Sun pointing should produce a valid unit quaternion
    gnc::SunPointing sun;
    auto sunAtt = sun.ComputeDesiredAttitude(state, 0.0);
    ASSERT_NEAR(sunAtt.Norm(), 1.0, 1e-8, "Sun quaternion is unit");
}

// ============================================================
// Stage Inertia Test
// ============================================================
void testStageInertia()
{
    std::cout << "[Stage Inertia]\n";

    simulation::Stage stage(1000.0, 5000.0, 100.0, 3000.0, 10.0, 0.5);

    // Default: cylinder approximation
    double Ixx, Iyy, Izz;
    stage.GetInertia(Ixx, Iyy, Izz);
    ASSERT_TRUE(Ixx > 0.0, "Default Ixx > 0");
    ASSERT_TRUE(Iyy > 0.0, "Default Iyy > 0");
    ASSERT_TRUE(Izz > 0.0, "Default Izz > 0");
    ASSERT_NEAR(Ixx, Iyy, 1e-5, "Cylinder Ixx == Iyy");

    // Set explicit inertia
    stage.SetInertia(500.0, 600.0, 200.0);
    stage.GetInertia(Ixx, Iyy, Izz);
    ASSERT_NEAR(Ixx, 500.0, 1e-10, "Explicit Ixx");
    ASSERT_NEAR(Iyy, 600.0, 1e-10, "Explicit Iyy");
    ASSERT_NEAR(Izz, 200.0, 1e-10, "Explicit Izz");
}

// ============================================================
// Data Export Test
// ============================================================
void testDataExport()
{
    std::cout << "[Data Export]\n";

    telemetry::TelemetryBus bus;
    bus.Publish("nav.altitude", 0.0, telemetry::TelemetryValue::Scalar(0.0));
    bus.Publish("nav.speed", 0.0, telemetry::TelemetryValue::Scalar(464.1));
    bus.Publish("nav.altitude", 0.05, telemetry::TelemetryValue::Scalar(0.8));
    bus.Publish("nav.speed", 0.05, telemetry::TelemetryValue::Scalar(425.9));

    // CSV export
    auto csv = data::DataExporter::ToCSV(bus);
    ASSERT_TRUE(csv.find("time") != std::string::npos, "CSV has header");
    ASSERT_TRUE(csv.find("nav.altitude") != std::string::npos, "CSV has altitude column");
    ASSERT_TRUE(csv.find("nav.speed") != std::string::npos, "CSV has speed column");

    // JSON export
    auto json = data::DataExporter::ToJSON(bus);
    ASSERT_TRUE(json.find("\"metadata\"") != std::string::npos, "JSON has metadata");
    ASSERT_TRUE(json.find("\"data\"") != std::string::npos, "JSON has data");
    ASSERT_TRUE(json.find("nav.altitude") != std::string::npos, "JSON has altitude");

    // File export
    std::string csvFile = "/tmp/titan_test_export.csv";
    std::string jsonFile = "/tmp/titan_test_export.json";
    bool csvOk = data::DataExporter::ExportCSV(bus, csvFile);
    bool jsonOk = data::DataExporter::ExportJSON(bus, jsonFile);
    ASSERT_TRUE(csvOk, "CSV file export succeeded");
    ASSERT_TRUE(jsonOk, "JSON file export succeeded");

    // Verify files exist and have content
    std::ifstream csvIn(csvFile);
    ASSERT_TRUE(csvIn.good(), "CSV file readable");
    std::string csvContent((std::istreambuf_iterator<char>(csvIn)),
                           std::istreambuf_iterator<char>());
    ASSERT_TRUE(csvContent.size() > 10, "CSV file has content");

    std::ifstream jsonIn(jsonFile);
    ASSERT_TRUE(jsonIn.good(), "JSON file readable");
    std::string jsonContent((std::istreambuf_iterator<char>(jsonIn)),
                            std::istreambuf_iterator<char>());
    ASSERT_TRUE(jsonContent.size() > 10, "JSON file has content");

    // Filtered export
    auto filteredCsv = data::DataExporter::ToCSV(bus, {"nav.altitude"});
    ASSERT_TRUE(filteredCsv.find("nav.altitude") != std::string::npos, "Filtered has altitude");
    ASSERT_TRUE(filteredCsv.find("nav.speed") == std::string::npos, "Filtered excludes speed");

    std::cout << "  CSV size: " << csv.size() << " bytes\n";
    std::cout << "  JSON size: " << json.size() << " bytes\n";
}

// ============================================================
// Enhanced Telemetry Test
// ============================================================
void testEnhancedTelemetry()
{
    std::cout << "[Enhanced Telemetry]\n";

    auto body = environment::CelestialBody::Earth();
    auto integrator = std::make_unique<integrators::RK4Integrator>();
    auto guidance = std::make_unique<guidance::OrbitalCircularizationGuidance>(
        200000.0, body.radius);

    simulation::Simulation sim(body, std::move(integrator), std::move(guidance));
    sim.AddForce(std::make_unique<physics::PointMassGravity>(body));
    sim.SetAtmosphere(std::make_unique<environment::USStandardAtmosphere>());

    auto vehicle = std::make_unique<vehicle::Vehicle>();
    vehicle->AddStage(simulation::Stage(10000.0, 120000.0, 1500.0, 2800.0, 10.0, 0.5));
    sim.SetVehicle(std::move(vehicle));
    sim.SetMaxG(4.0);

    auto telBus = std::make_shared<telemetry::TelemetryBus>();
    sim.SetTelemetryBus(telBus);

    simulation::CompletionCriteria criteria;
    criteria.enabled = false;
    sim.SetCompletionCriteria(criteria);

    // Run a few steps
    for (int i = 0; i < 10; i++)
        sim.Step(0.1);

    // Check for new telemetry channels
    bool hasVertVel = false, hasAccel = false, hasDynPress = false;
    bool hasMach = false, hasAttQuat = false, hasEuler = false;
    bool hasDrag = false;

    for (const auto &rec : telBus->GetRecords())
    {
        if (rec.channel == "nav.verticalVelocity") hasVertVel = true;
        if (rec.channel == "nav.acceleration") hasAccel = true;
        if (rec.channel == "aero.dynamicPressure") hasDynPress = true;
        if (rec.channel == "aero.mach") hasMach = true;
        if (rec.channel == "att.quaternion") hasAttQuat = true;
        if (rec.channel == "att.euler") hasEuler = true;
        if (rec.channel == "vehicle.drag") hasDrag = true;
    }

    ASSERT_TRUE(hasVertVel, "Has nav.verticalVelocity channel");
    ASSERT_TRUE(hasAccel, "Has nav.acceleration channel");
    ASSERT_TRUE(hasDynPress, "Has aero.dynamicPressure channel");
    ASSERT_TRUE(hasMach, "Has aero.mach channel");
    ASSERT_TRUE(hasAttQuat, "Has att.quaternion channel");
    ASSERT_TRUE(hasEuler, "Has att.euler channel");
    ASSERT_TRUE(hasDrag, "Has vehicle.drag channel");

    std::cout << "  Total telemetry records: " << telBus->GetRecords().size() << "\n";
}

// ============================================================
// Main
// ============================================================
int main()
{
    std::cout << "=== Titan Physics Engine Test Suite ===\n\n";

    testVector3();
    testQuaternion();
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
    testRK4Vector();
    testRK45();
    testRK45Vector();
    testNewSimulation();
    testLegacyVehicle3D();
    test6DOFTorqueFree();
    testPIDController();
    test6DOFPIDConvergence();
    testReactionWheelSaturation();
    testPointingModes();
    testStageInertia();
    testDataExport();
    testEnhancedTelemetry();

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
