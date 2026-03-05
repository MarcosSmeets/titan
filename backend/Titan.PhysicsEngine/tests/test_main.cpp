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
#include "orbital/OrbitalMechanics.h"
#include "integrators/RK4Integrator.h"
#include "integrators/EulerIntegrator.h"
#include "integrators/RK45Integrator.h"
#include "simulation/LaunchVehicle3D.h"
#include "simulation/Stage.h"
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

    // Magnitude
    ASSERT_NEAR(a.Magnitude(), std::sqrt(14.0), 1e-10, "Magnitude");
    ASSERT_NEAR(math::Vector3().Magnitude(), 0.0, 1e-10, "Zero magnitude");

    // MagnitudeSquared
    ASSERT_NEAR(a.MagnitudeSquared(), 14.0, 1e-10, "MagnitudeSquared");

    // Normalized
    auto n = a.Normalized();
    ASSERT_NEAR(n.Magnitude(), 1.0, 1e-10, "Normalized magnitude");

    // Dot product
    ASSERT_NEAR(math::Vector3::Dot(a, b), 32.0, 1e-10, "Dot product");

    // Cross product
    auto cross = math::Vector3::Cross(a, b);
    ASSERT_NEAR(cross.x, -3.0, 1e-10, "Cross x");
    ASSERT_NEAR(cross.y, 6.0, 1e-10, "Cross y");
    ASSERT_NEAR(cross.z, -3.0, 1e-10, "Cross z");

    // Operators
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

    // Compound operators
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
// Orbital Elements 3D Tests
// ============================================================
void testOrbitalElements3D()
{
    std::cout << "[OrbitalElements3D]\n";

    const double mu = 3.986e14;
    const double R = 6371000.0;

    // Circular orbit at 200km altitude
    double r = R + 200000.0;
    double v_circ = std::sqrt(mu / r);

    // Orbit in XY plane (equatorial)
    math::Vector3 pos(r, 0.0, 0.0);
    math::Vector3 vel(0.0, v_circ, 0.0);

    auto elements = orbital::OrbitalMechanics::ComputeOrbitalElements(pos, vel, mu);

    ASSERT_NEAR(elements.eccentricity, 0.0, 1e-5, "Circular orbit e~0");
    ASSERT_NEAR(elements.semiMajorAxis, r, 1000.0, "Semi-major axis = r");
    ASSERT_NEAR(elements.apoapsis, r, 2000.0, "Apoapsis = r");
    ASSERT_NEAR(elements.periapsis, r, 2000.0, "Periapsis = r");
    ASSERT_NEAR(elements.inclination, 0.0, 1e-5, "Equatorial orbit i=0");

    // Polar orbit (orbit in XZ plane)
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

    // Test: simple harmonic oscillator x'' = -x
    // Exact: x(t) = cos(t), v(t) = -sin(t)
    integrators::State state{1.0, 0.0, 0.0, 0.0, 0.0, 0.0}; // x=1, vx=0

    double dt = 0.001;
    double t = 0.0;

    for (int i = 0; i < 1000; i++)
    {
        auto result = rk4.Step(state, dt,
                               [](const integrators::State &s) -> integrators::Derivative
                               {
                                   return {s.vx, 0.0, 0.0, -s.x, 0.0, 0.0};
                               });
        state = result.state;
        t += dt;
    }

    // At t=1.0: x=cos(1)≈0.5403, vx=-sin(1)≈-0.8415
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

    // Same harmonic oscillator
    integrators::State state{1.0, 0.0, 0.0, 0.0, 0.0, 0.0};

    // Single large step — the adaptive integrator should handle this
    auto result = rk45.Step(state, 1.0,
                            [](const integrators::State &s) -> integrators::Derivative
                            {
                                return {s.vx, 0.0, 0.0, -s.x, 0.0, 0.0};
                            });

    state = result.state;
    ASSERT_NEAR(state.x, std::cos(1.0), 1e-6, "RK45 harmonic x at t=1");
    ASSERT_NEAR(state.vx, -std::sin(1.0), 1e-6, "RK45 harmonic vx at t=1");

    // Test dt_used
    ASSERT_NEAR(result.dt_used, 1.0, 1e-10, "RK45 dt_used = requested dt");
}

// ============================================================
// Falcon 9 Integration Test
// ============================================================
void testFalcon9Simulation()
{
    std::cout << "[Falcon9 Integration]\n";

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

    // Falcon 9 stage 1 (simplified)
    rocket.AddStage(simulation::Stage(
        22200.0,   // dry mass
        395700.0,  // fuel mass
        2770.0,    // burn rate
        2770.0,    // exhaust velocity
        10.75,     // reference area
        0.5));     // Cd

    // Falcon 9 stage 2 (simplified)
    rocket.AddStage(simulation::Stage(
        3900.0,    // dry mass
        92670.0,   // fuel mass
        287.0,     // burn rate
        3413.0,    // exhaust velocity
        10.75,     // reference area
        0.3));     // Cd

    double dt = 0.1;
    double maxAltitude = 0.0;
    double maxVelocity = 0.0;

    for (double t = 0.0; t < 600.0; t += dt)
    {
        rocket.Update(dt);

        auto pos = rocket.GetPosition();
        auto vel = rocket.GetVelocity();

        if (std::isnan(pos.x))
            break;

        double r = pos.Magnitude();
        double altitude = r - earthRadius;
        double velocity = vel.Magnitude();

        if (altitude > maxAltitude)
            maxAltitude = altitude;
        if (velocity > maxVelocity)
            maxVelocity = velocity;
    }

    // Falcon 9 should reach significant altitude and velocity
    ASSERT_TRUE(maxAltitude > 100000.0, "F9 max altitude > 100 km");
    ASSERT_TRUE(maxVelocity > 2000.0, "F9 max velocity > 2000 m/s");

    std::cout << "  Max altitude: " << maxAltitude / 1000.0 << " km\n";
    std::cout << "  Max velocity: " << maxVelocity << " m/s\n";
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
    testOrbitalElements3D();
    testRK4();
    testRK45();
    testFalcon9Simulation();

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
