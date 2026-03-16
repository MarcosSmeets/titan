#include <iostream>
#include <cmath>
#include <cassert>
#include <string>

#include "propulsion/Engine.h"
#include "aero/AeroModel.h"
#include "guidance/PEGGuidance.h"
#include "orbital/Maneuvers.h"
#include "landing/BoosterRecovery.h"
#include "thermal/AeroHeating.h"
#include "math/Vector3.h"
#include "environment/CelestialBody.h"

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
// Engine Model Tests
// ============================================================
void testEngineModel()
{
    std::cout << "[Engine Model]\n";

    // Test Merlin 1D preset
    auto config = propulsion::Engine::Merlin1D();
    propulsion::Engine engine(config);

    ASSERT_TRUE(engine.IsOff(), "Engine starts off");
    ASSERT_NEAR(engine.GetThrust(), 0.0, 1e-10, "Zero thrust when off");

    // Ignite
    engine.Ignite();
    ASSERT_TRUE(engine.GetState() == propulsion::EngineState::Starting,
                "Engine starting after ignite");

    // Create propellant
    propulsion::PropellantState prop;
    prop.oxidizerMass = 200000.0; // 200 tonnes LOX
    prop.fuelMass = 80000.0;     // 80 tonnes RP-1
    prop.mixtureRatio = 2.36;

    // Run through startup transient
    for (int i = 0; i < 100; i++)
    {
        engine.SetThrottle(1.0);
        engine.Update(0.05, 101325.0, prop); // sea level
    }

    ASSERT_TRUE(engine.IsRunning(), "Engine running after startup");
    ASSERT_TRUE(engine.GetThrust() > 800000.0, "Merlin produces >800kN at SL");
    ASSERT_TRUE(engine.GetThrust() < config.thrustVacuum * config.engineCount,
                "SL thrust < vacuum thrust");

    std::cout << "  Merlin SL thrust: " << engine.GetThrust() / 1000.0 << " kN\n";

    // Test vacuum conditions
    engine.Update(0.05, 0.0, prop); // vacuum
    double vacThrust = engine.GetThrust();
    ASSERT_NEAR(vacThrust, config.thrustVacuum, config.thrustVacuum * 0.01,
                "Vacuum thrust matches spec");

    std::cout << "  Merlin Vac thrust: " << vacThrust / 1000.0 << " kN\n";

    // Test deep throttle
    engine.SetThrottle(0.4);
    engine.Update(0.05, 0.0, prop);
    ASSERT_NEAR(engine.GetThrottle(), 0.4, 0.01, "Throttle at 40%");
    ASSERT_NEAR(engine.GetThrust(), vacThrust * 0.4, vacThrust * 0.02,
                "Thrust at 40% throttle");

    // Test throttle below minimum clamps
    engine.SetThrottle(0.1); // below 40% min
    ASSERT_NEAR(engine.GetThrottle(), 0.4, 0.01,
                "Throttle clamped to minimum");

    // Test mass flow tracking
    double massBefore = prop.TotalMass();
    engine.SetThrottle(1.0);
    engine.Update(1.0, 0.0, prop); // 1 second burn
    double massAfter = prop.TotalMass();
    double consumed = massBefore - massAfter;
    ASSERT_TRUE(consumed > 200.0, "Propellant consumed during burn");
    ASSERT_TRUE(consumed < 400.0, "Reasonable mass flow rate");

    std::cout << "  Mass flow: " << consumed << " kg/s\n";

    // Test mixture ratio consumption (fresh propellant for clean measurement)
    propulsion::PropellantState propClean;
    propClean.oxidizerMass = 100000.0;
    propClean.fuelMass = 42372.88; // exactly 100000/2.36
    propClean.mixtureRatio = 2.36;
    double oxBefore = propClean.oxidizerMass;
    double fuelBefore = propClean.fuelMass;
    propClean.Burn(274.0, 10.0);
    double oxConsumed = oxBefore - propClean.oxidizerMass;
    double fuelConsumed = fuelBefore - propClean.fuelMass;
    double actualRatio = oxConsumed / fuelConsumed;
    ASSERT_NEAR(actualRatio, 2.36, 0.01,
                "O/F ratio maintained");

    // Test shutdown
    engine.Shutdown();
    for (int i = 0; i < 50; i++)
        engine.Update(0.05, 0.0, prop);

    ASSERT_TRUE(engine.IsOff(), "Engine off after shutdown");
    ASSERT_NEAR(engine.GetThrust(), 0.0, 1e-6, "Zero thrust after shutdown");
}

// ============================================================
// Engine Presets Tests
// ============================================================
void testEnginePresets()
{
    std::cout << "[Engine Presets]\n";

    auto merlin = propulsion::Engine::Merlin1D();
    ASSERT_NEAR(merlin.thrustVacuum, 981000.0, 1.0, "Merlin thrust");
    ASSERT_NEAR(merlin.ispVacuum, 311.0, 0.1, "Merlin Isp vac");
    ASSERT_NEAR(merlin.minThrottle, 0.40, 0.01, "Merlin min throttle");

    auto raptor = propulsion::Engine::Raptor2();
    ASSERT_NEAR(raptor.thrustVacuum, 2550000.0, 1.0, "Raptor thrust");
    ASSERT_NEAR(raptor.ispVacuum, 350.0, 0.1, "Raptor Isp vac");
    ASSERT_NEAR(raptor.minThrottle, 0.20, 0.01, "Raptor min throttle");

    auto rs25 = propulsion::Engine::RS25();
    ASSERT_NEAR(rs25.ispVacuum, 452.0, 0.1, "RS-25 Isp vac");
    ASSERT_TRUE(rs25.ispVacuum > raptor.ispVacuum, "RS-25 higher Isp than Raptor");

    auto rd180 = propulsion::Engine::RD180();
    ASSERT_TRUE(rd180.thrustVacuum > 4000000.0, "RD-180 >4MN thrust");
}

// ============================================================
// Aero Model Tests
// ============================================================
void testAeroModel()
{
    std::cout << "[Aero Model]\n";

    auto model = aero::AeroModel::Falcon9FirstStage();

    // Zero alpha, subsonic
    auto c1 = model.GetCoefficients(0.5, 0.0);
    ASSERT_TRUE(c1.Cd > 0.2 && c1.Cd < 0.5, "Subsonic Cd in range");
    ASSERT_NEAR(c1.Cl, 0.0, 0.01, "Zero lift at zero alpha");

    // Transonic peak
    auto c2 = model.GetCoefficients(1.0, 0.0);
    ASSERT_TRUE(c2.Cd > c1.Cd, "Transonic Cd > subsonic Cd");

    // Supersonic decay
    auto c3 = model.GetCoefficients(3.0, 0.0);
    ASSERT_TRUE(c3.Cd < c2.Cd, "Supersonic Cd < transonic peak");

    // Angle of attack increases drag
    auto c4 = model.GetCoefficients(1.0, 10.0 * M_PI / 180.0);
    ASSERT_TRUE(c4.Cd > c2.Cd, "Alpha increases drag");
    ASSERT_TRUE(c4.Cl > 0.1, "Positive lift at positive alpha");

    // Negative alpha gives negative lift
    auto c5 = model.GetCoefficients(1.0, -5.0 * M_PI / 180.0);
    ASSERT_TRUE(c5.Cl < 0.0, "Negative lift at negative alpha");

    // Force computation
    double q = 50000.0; // 50 kPa dynamic pressure
    double drag, lift, moment;
    model.ComputeForces(1.0, 5.0 * M_PI / 180.0, q, drag, lift, moment);
    ASSERT_TRUE(drag > 100000.0, "Significant drag at MaxQ");
    ASSERT_TRUE(lift > 0.0, "Positive lift");

    std::cout << "  Cd(M=0.5, a=0): " << c1.Cd << "\n";
    std::cout << "  Cd(M=1.0, a=0): " << c2.Cd << "\n";
    std::cout << "  Cd(M=3.0, a=0): " << c3.Cd << "\n";
    std::cout << "  Drag at MaxQ: " << drag / 1000.0 << " kN\n";
}

// ============================================================
// AeroTable Interpolation Tests
// ============================================================
void testAeroTableInterpolation()
{
    std::cout << "[AeroTable Interpolation]\n";

    std::vector<double> mach = {0.0, 1.0, 2.0};
    std::vector<double> alpha = {0.0, 0.1745}; // 0 and 10 deg

    std::vector<std::vector<double>> data = {
        {0.3, 0.5, 0.4},  // alpha=0
        {0.5, 0.8, 0.6},  // alpha=10deg
    };

    aero::AeroTable table(mach, alpha, data);

    // Exact corners
    ASSERT_NEAR(table.Lookup(0.0, 0.0), 0.3, 1e-10, "Corner (0,0)");
    ASSERT_NEAR(table.Lookup(2.0, 0.1745), 0.6, 1e-10, "Corner (2,10)");

    // Midpoint interpolation
    double mid = table.Lookup(1.0, 0.08725); // midpoint alpha
    ASSERT_NEAR(mid, 0.65, 0.01, "Midpoint interpolation");

    // Clamping beyond bounds
    ASSERT_NEAR(table.Lookup(5.0, 0.0), 0.4, 1e-10, "Mach clamped high");
    ASSERT_NEAR(table.Lookup(-1.0, 0.0), 0.3, 1e-10, "Mach clamped low");
}

// ============================================================
// PEG Guidance Tests
// ============================================================
void testPEGGuidance()
{
    std::cout << "[PEG Guidance]\n";

    double bodyRadius = 6371000.0;
    double mu = 3.986e14;

    guidance::PoweredExplicitGuidance::TargetOrbit target;
    target.periapsis = 200000.0;
    target.apoapsis = 200000.0;

    guidance::PoweredExplicitGuidance peg(target, bodyRadius, mu);
    peg.SetEngineParameters(3100.0, 20.0);

    // At pad: should be vertical
    integrators::State padState{bodyRadius + 100.0, 0.0, 0.0, 0.0, 100.0, 0.0};
    double padPitch = peg.ComputePitchAngle(padState, mu);
    ASSERT_NEAR(padPitch, M_PI_2, 0.01, "PEG vertical at pad");

    // At altitude with horizontal velocity: should pitch over
    integrators::State flyState{bodyRadius + 100000.0, 0.0, 0.0, 1000.0, 5000.0, 0.0};
    double flyPitch = peg.ComputePitchAngle(flyState, mu);
    ASSERT_TRUE(flyPitch < M_PI_2, "PEG pitches over at altitude");
    ASSERT_TRUE(flyPitch > -0.2, "PEG pitch in reasonable range");

    ASSERT_TRUE(peg.GetTargetSpeed() > 7000.0, "Target speed is orbital velocity");
    ASSERT_TRUE(peg.GetTimeToGo() > 0.0, "Positive time-to-go");

    std::cout << "  Target speed: " << peg.GetTargetSpeed() << " m/s\n";
    std::cout << "  Time to go: " << peg.GetTimeToGo() << " s\n";
}

// ============================================================
// Hohmann Transfer Tests
// ============================================================
void testHohmannTransfer()
{
    std::cout << "[Hohmann Transfer]\n";

    double mu = 3.986e14;
    double R = 6371000.0;

    // LEO to GEO
    double r1 = R + 200000.0;    // 200 km LEO
    double r2 = R + 35786000.0;  // GEO

    auto result = orbital::Maneuvers::Hohmann(r1, r2, mu);

    ASSERT_TRUE(result.valid, "Hohmann transfer valid");
    ASSERT_TRUE(result.maneuvers.size() == 2, "Two burns");

    // Known LEO-GEO dv ≈ 3.94 km/s total
    ASSERT_NEAR(result.totalDeltaV, 3935.0, 50.0, "LEO-GEO dv ~3.94 km/s");

    // Transfer time ≈ 5.25 hours
    ASSERT_NEAR(result.transferTime, 18924.0, 200.0, "Transfer time ~5.25h");

    // Burn 1 should be larger
    ASSERT_TRUE(result.maneuvers[0].deltaV > result.maneuvers[1].deltaV,
                "First burn larger for LEO->GEO");

    std::cout << "  Burn 1 dv: " << result.maneuvers[0].deltaV << " m/s\n";
    std::cout << "  Burn 2 dv: " << result.maneuvers[1].deltaV << " m/s\n";
    std::cout << "  Total dv: " << result.totalDeltaV << " m/s\n";
    std::cout << "  Transfer time: " << result.transferTime / 3600.0 << " hours\n";

    // LEO circular orbit raise (200km to 400km)
    double r_low = R + 200000.0;
    double r_high = R + 400000.0;
    auto small = orbital::Maneuvers::Hohmann(r_low, r_high, mu);
    ASSERT_TRUE(small.valid, "Small Hohmann valid");
    ASSERT_NEAR(small.totalDeltaV, 113.0, 10.0, "200->400km dv ~113 m/s");
}

// ============================================================
// Bi-Elliptic Transfer Tests
// ============================================================
void testBiEllipticTransfer()
{
    std::cout << "[Bi-Elliptic Transfer]\n";

    double mu = 3.986e14;
    double R = 6371000.0;

    double r1 = R + 200000.0;
    double r2 = R + 200000.0 * 50; // Very high orbit

    // For large r2/r1 ratios, bi-elliptic can be more efficient
    double r_inter = R + 200000.0 * 100; // even higher intermediate

    auto bielliptic = orbital::Maneuvers::BiElliptic(r1, r2, r_inter, mu);
    auto hohmann = orbital::Maneuvers::Hohmann(r1, r2, mu);

    ASSERT_TRUE(bielliptic.valid, "Bi-elliptic valid");
    ASSERT_TRUE(bielliptic.maneuvers.size() == 3, "Three burns");
    ASSERT_TRUE(bielliptic.transferTime > hohmann.transferTime,
                "Bi-elliptic takes longer");

    std::cout << "  Hohmann dv: " << hohmann.totalDeltaV << " m/s\n";
    std::cout << "  Bi-elliptic dv: " << bielliptic.totalDeltaV << " m/s\n";
}

// ============================================================
// Plane Change Tests
// ============================================================
void testPlaneChange()
{
    std::cout << "[Plane Change]\n";

    double mu = 3.986e14;
    double R = 6371000.0;

    // LEO at 200km
    double r = R + 200000.0;
    double v = std::sqrt(mu / r); // ~7784 m/s

    // 28.5 degree plane change (KSC latitude to equatorial)
    auto result = orbital::Maneuvers::PlaneChange(v, 28.5 * M_PI / 180.0);
    ASSERT_NEAR(result.deltaV, 3812.0, 50.0, "28.5 deg plane change ~3.8 km/s");

    // Small plane change
    auto small = orbital::Maneuvers::PlaneChange(v, 1.0 * M_PI / 180.0);
    ASSERT_NEAR(small.deltaV, 135.8, 5.0, "1 deg plane change ~136 m/s");

    std::cout << "  28.5 deg change: " << result.deltaV << " m/s\n";
    std::cout << "  1 deg change: " << small.deltaV << " m/s\n";
}

// ============================================================
// Lambert Solver Tests
// ============================================================
void testLambertSolver()
{
    std::cout << "[Lambert Solver]\n";

    double mu = 3.986e14;
    double R = 6371000.0;

    // Test: two points on a circular orbit at 200km
    double r = R + 200000.0;
    double v_circ = std::sqrt(mu / r);

    // Start at (r, 0, 0) moving in +y
    math::Vector3 r1(r, 0.0, 0.0);

    // After 90 degrees: at (0, r, 0)
    math::Vector3 r2(0.0, r, 0.0);

    // Transfer time = quarter period
    double period = 2.0 * M_PI * std::sqrt(r * r * r / mu);
    double tof = period / 4.0;

    math::Vector3 v1out, v2out;
    bool ok = orbital::Maneuvers::Lambert(r1, r2, tof, mu, true, v1out, v2out);

    ASSERT_TRUE(ok, "Lambert solver converged");

    // For circular orbit, v1 should be nearly (0, v_circ, 0)
    ASSERT_NEAR(v1out.y, v_circ, v_circ * 0.05, "Lambert v1 ≈ circular velocity");
    ASSERT_NEAR(v1out.x, 0.0, v_circ * 0.05, "Lambert v1.x ≈ 0");

    std::cout << "  v1: (" << v1out.x << ", " << v1out.y << ", " << v1out.z << ")\n";
    std::cout << "  Expected: (0, " << v_circ << ", 0)\n";
}

// ============================================================
// Booster Recovery Tests
// ============================================================
void testBoosterRecovery()
{
    std::cout << "[Booster Recovery]\n";

    double R = 6371000.0;

    landing::BoosterRecovery recovery;
    recovery.SetBodyRadius(R);

    // Landing target: launch site
    math::Vector3 launchSite(R, 0.0, 0.0);
    recovery.SetLandingTarget(launchSite);

    ASSERT_TRUE(recovery.GetPhase() == landing::RecoveryPhase::Ascent,
                "Starts in ascent");

    // Separate
    recovery.Separate();
    ASSERT_TRUE(recovery.GetPhase() == landing::RecoveryPhase::Separation,
                "Phase = separation");

    // Simulate separation wait
    math::Vector3 pos(R + 80000.0, 50000.0, 0.0);
    math::Vector3 vel(500.0, 2000.0, 0.0);

    for (int i = 0; i < 100; i++)
    {
        auto cmd = recovery.Update(pos, vel, 25000.0, 845000.0, 0.1);
    }

    ASSERT_TRUE(recovery.GetPhase() != landing::RecoveryPhase::Separation,
                "Advanced past separation");

    std::cout << "  Phase after 10s: " << recovery.GetPhaseString() << "\n";
}

// ============================================================
// Landing Burn Guidance Tests
// ============================================================
void testLandingBurnGuidance()
{
    std::cout << "[Landing Burn Guidance]\n";

    landing::LandingBurnGuidance lbg;
    lbg.bodyRadius = 6371000.0;

    // Test ignition altitude computation
    double alt = lbg.ComputeIgnitionAltitude(
        200.0,      // 200 m/s descent speed
        2000.0,     // 2km altitude
        25000.0,    // 25 tonnes
        845000.0,   // Merlin thrust
        9.81);

    ASSERT_TRUE(alt > 500.0, "Ignition altitude > 500m");
    ASSERT_TRUE(alt < 2000.0, "Ignition altitude < 2km");

    std::cout << "  Ignition altitude: " << alt << " m\n";

    // Test throttle computation
    double throttle = lbg.ComputeThrottle(
        500.0,      // 500m altitude
        150.0,      // 150 m/s speed
        25000.0,    // mass
        845000.0,   // thrust
        9.81);

    ASSERT_TRUE(throttle > 0.3, "Throttle above minimum");
    ASSERT_TRUE(throttle <= 1.0, "Throttle below maximum");

    std::cout << "  Landing throttle at 500m: " << throttle * 100.0 << "%\n";

    // Test landed detection
    ASSERT_TRUE(lbg.HasLanded(0.5, 1.0), "Detected landing");
    ASSERT_TRUE(!lbg.HasLanded(100.0, 50.0), "Not landed at altitude");
}

// ============================================================
// Aerothermal Heating Tests
// ============================================================
void testAeroHeating()
{
    std::cout << "[Aerothermal Heating]\n";

    thermal::AeroHeating heating(thermal::AeroHeating::PICAX());

    // No heating in vacuum
    heating.Update(0.0, 7800.0, 0.1);
    ASSERT_NEAR(heating.GetState().convectiveHeatFlux, 0.0, 1e-10,
                "No heating in vacuum");

    // Heating during reentry at ~70km
    double rho_70km = 8.28e-5; // kg/m^3
    double v_entry = 7500.0;   // m/s

    heating.Update(rho_70km, v_entry, 0.1);
    ASSERT_TRUE(heating.GetState().convectiveHeatFlux > 100000.0,
                "Significant heating during reentry");

    std::cout << "  Heat flux at 70km/7.5km/s: "
              << heating.GetState().convectiveHeatFlux / 1000.0 << " kW/m^2\n";

    // Run through a simulated reentry profile
    heating.Reset();
    double maxFlux = 0.0;
    for (int i = 0; i < 1000; i++)
    {
        double t = i * 0.5;
        // Simulated altitude descent and deceleration
        double alt = 120000.0 - t * 200.0;
        if (alt < 0) alt = 0;

        double rho;
        if (alt > 100000.0) rho = 1e-8;
        else rho = 1.225 * std::exp(-alt / 8500.0);

        double v = 7500.0 * std::exp(-t / 300.0);

        heating.Update(rho, v, 0.5);

        if (heating.GetState().totalHeatFlux > maxFlux)
            maxFlux = heating.GetState().totalHeatFlux;
    }

    ASSERT_TRUE(maxFlux > 100000.0, "Peak heat flux > 100 kW/m^2");
    ASSERT_TRUE(heating.GetState().totalHeatLoad > 0.0, "Accumulated heat load");
    ASSERT_TRUE(heating.GetState().surfaceTemperature > 500.0,
                "Surface heated above 500K");

    std::cout << "  Peak heat flux: " << maxFlux / 1e6 << " MW/m^2\n";
    std::cout << "  Total heat load: " << heating.GetState().totalHeatLoad / 1e6 << " MJ/m^2\n";
    std::cout << "  Surface temp: " << heating.GetState().surfaceTemperature << " K\n";
    std::cout << "  Overheated: " << (heating.GetState().overheated ? "YES" : "no") << "\n";
}

// ============================================================
// Propellant Tracking Tests
// ============================================================
void testPropellantTracking()
{
    std::cout << "[Propellant Tracking]\n";

    propulsion::PropellantState prop;
    prop.oxidizerMass = 287000.0;  // Falcon 9 S1 LOX
    prop.fuelMass = 123000.0;     // Falcon 9 S1 RP-1
    prop.mixtureRatio = 2.36;     // Merlin O/F

    double totalBefore = prop.TotalMass();
    ASSERT_NEAR(totalBefore, 410000.0, 1.0, "Total propellant mass");
    ASSERT_TRUE(prop.HasPropellant(), "Has propellant");

    // Burn at 274 kg/s for 10 seconds
    prop.Burn(274.0, 10.0);

    double consumed = totalBefore - prop.TotalMass();
    ASSERT_NEAR(consumed, 2740.0, 1.0, "2740 kg consumed in 10s");

    // Check O/F ratio maintained
    double actualRatio = (287000.0 - prop.oxidizerMass) /
                         (123000.0 - prop.fuelMass);
    ASSERT_NEAR(actualRatio, 2.36, 0.01, "O/F ratio maintained during burn");

    // Deplete fuel
    prop.fuelMass = 0.0;
    ASSERT_TRUE(!prop.HasPropellant(), "No propellant when fuel depleted");
}

// ============================================================
// DeltaV Budget Tests
// ============================================================
void testDeltaVBudget()
{
    std::cout << "[DeltaV Budget]\n";

    double mu = 3.986e14;
    double R = 6371000.0;

    // Full Falcon 9 mission budget (approximate):
    // - Gravity loss: ~1500 m/s
    // - Drag loss: ~150 m/s
    // - Steering loss: ~50 m/s
    // - Orbital velocity at 200km: ~7784 m/s
    // Total needed: ~9500 m/s

    double v_orbit = std::sqrt(mu / (R + 200000.0));
    double gravity_loss = 1500.0;
    double drag_loss = 150.0;
    double steering_loss = 50.0;

    double total_dv = v_orbit + gravity_loss + drag_loss + steering_loss;
    ASSERT_NEAR(total_dv, 9484.0, 100.0, "Total dv budget ~9.5 km/s");

    // Estimate burn time
    double burnTime = orbital::Maneuvers::EstimateBurnTime(
        total_dv,
        3100.0,     // exhaust velocity (Isp * g0 ≈ 311 * 9.81)
        549054.0,   // Falcon 9 total mass
        2770.0);    // total mass flow rate (9 Merlins)

    ASSERT_TRUE(burnTime > 100.0, "Burn time > 100s");
    ASSERT_TRUE(burnTime < 500.0, "Burn time < 500s");

    std::cout << "  Orbital velocity: " << v_orbit << " m/s\n";
    std::cout << "  Total dv budget: " << total_dv << " m/s\n";
    std::cout << "  Estimated burn time: " << burnTime << " s\n";
}

// ============================================================
// Engine Transient Tests
// ============================================================
void testEngineTransients()
{
    std::cout << "[Engine Transients]\n";

    propulsion::Engine::Config config;
    config.thrustVacuum = 1000000.0;
    config.ispVacuum = 300.0;
    config.ispSeaLevel = 270.0;
    config.startupTime = 2.0;
    config.shutdownTime = 1.0;
    config.minThrottle = 0.5;

    propulsion::Engine engine(config);
    propulsion::PropellantState prop;
    prop.oxidizerMass = 100000.0;
    prop.fuelMass = 40000.0;

    // Record thrust during startup
    engine.Ignite();
    engine.SetThrottle(1.0);

    double thrustAt05s = 0.0, thrustAt1s = 0.0, thrustAt2s = 0.0;

    for (int i = 0; i < 60; i++)
    {
        engine.Update(0.05, 0.0, prop);
        double t = (i + 1) * 0.05;
        if (std::abs(t - 0.5) < 0.03) thrustAt05s = engine.GetThrust();
        if (std::abs(t - 1.0) < 0.03) thrustAt1s = engine.GetThrust();
        if (std::abs(t - 2.0) < 0.03) thrustAt2s = engine.GetThrust();
    }

    ASSERT_TRUE(thrustAt05s < thrustAt1s, "Thrust increases during startup");
    ASSERT_TRUE(thrustAt1s < thrustAt2s, "Thrust continues increasing");
    ASSERT_NEAR(thrustAt2s, config.thrustVacuum, config.thrustVacuum * 0.05,
                "Full thrust at end of startup");

    std::cout << "  Thrust at 0.5s: " << thrustAt05s / 1000.0 << " kN\n";
    std::cout << "  Thrust at 1.0s: " << thrustAt1s / 1000.0 << " kN\n";
    std::cout << "  Thrust at 2.0s: " << thrustAt2s / 1000.0 << " kN\n";
}

// ============================================================
// Boostback Guidance Tests
// ============================================================
void testBoostbackGuidance()
{
    std::cout << "[Boostback Guidance]\n";

    landing::BoostbackGuidance bb;
    bb.landingTarget = math::Vector3(6371000.0, 0.0, 0.0);
    bb.bodyRadius = 6371000.0;

    // Vehicle moving away from target
    math::Vector3 pos(6371000.0 + 80000.0, 100000.0, 0.0);
    math::Vector3 vel(200.0, 1500.0, 0.0); // mostly horizontal, away

    auto dir = bb.ComputeThrustDirection(pos, vel);
    ASSERT_NEAR(dir.Magnitude(), 1.0, 0.01, "Unit thrust direction");

    // Thrust should have component opposing the horizontal velocity
    ASSERT_TRUE(dir.y < 0.0, "Thrust opposes horizontal velocity");

    // Not complete yet (velocity still away from target)
    ASSERT_TRUE(!bb.IsComplete(pos, vel), "Not complete while moving away");

    // Now velocity toward target
    math::Vector3 velToward(-200.0, -500.0, 0.0);
    // This might not be "complete" because the dot product depends on geometry
    // but thrust should now be more aligned
    auto dir2 = bb.ComputeThrustDirection(pos, velToward);
    ASSERT_NEAR(dir2.Magnitude(), 1.0, 0.01, "Unit direction for return");
}

// ============================================================
// Main
// ============================================================
int main()
{
    std::cout << "=== Titan Advanced Physics Test Suite ===\n\n";

    testEngineModel();
    testEnginePresets();
    testAeroModel();
    testAeroTableInterpolation();
    testPEGGuidance();
    testHohmannTransfer();
    testBiEllipticTransfer();
    testPlaneChange();
    testLambertSolver();
    testBoosterRecovery();
    testLandingBurnGuidance();
    testAeroHeating();
    testPropellantTracking();
    testDeltaVBudget();
    testEngineTransients();
    testBoostbackGuidance();

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
