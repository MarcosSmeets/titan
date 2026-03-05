#include <iostream>
#include <iomanip>
#include <memory>
#include <cmath>

#include "simulation/LaunchVehicle3D.h"
#include "simulation/Stage.h"
#include "integrators/RK45Integrator.h"
#include "guidance/OrbitalCircularizationGuidance.h"
#include "orbital/OrbitalMechanics.h"
#include "math/Vector3.h"

using namespace titan;

int main()
{
    const double earthRadius = 6371000.0;
    const double mu = 3.986e14;

    // Earth surface velocity at equator (~465 m/s)
    const double earthRotationRate = 7.2921159e-5; // rad/s
    const double surfaceVelocity = earthRotationRate * earthRadius;

    // Dormand-Prince RK45 adaptive integrator
    auto integrator =
        std::make_unique<integrators::RK45Integrator>(
            1e-8,   // absolute tolerance
            1e-6,   // relative tolerance
            1e-6,   // minimum step size
            10.0);  // maximum step size

    auto guidance =
        std::make_unique<guidance::OrbitalCircularizationGuidance>(
            200000.0,
            earthRadius);

    simulation::LaunchVehicle3D rocket(
        earthRadius,
        mu,
        std::move(integrator),
        std::move(guidance));

    rocket.SetMaxG(4.0);

    // First stage: ascent through atmosphere
    rocket.AddStage(
        simulation::Stage(
            10000.0,  // dry mass (kg)
            120000.0, // fuel mass (kg)
            1500.0,   // burn rate (kg/s)
            2800.0,   // exhaust velocity (m/s)
            10.0,     // reference area (m^2)
            0.5));    // drag coefficient

    // Second stage: orbital insertion and circularization
    rocket.AddStage(
        simulation::Stage(
            2000.0,   // dry mass (kg)
            20000.0,  // fuel mass (kg)
            300.0,    // burn rate (kg/s)
            3400.0,   // exhaust velocity (m/s)
            5.0,      // reference area (m^2)
            0.3));    // drag coefficient

    // Note: Vehicle starts at (R+1, 0, 0) with zero velocity.
    // In a real scenario, Earth rotation would add ~465 m/s eastward.

    double dt = 0.05;
    double simulationDuration = 900.0;

    std::cout << "=== Titan 3D Launch Simulation ===\n";
    std::cout << "Target orbit: 200 km circular\n";
    std::cout << "Surface velocity (Earth rotation): "
              << surfaceVelocity << " m/s\n\n";

    int printInterval = 5;
    double nextPrint = 0.0;

    for (double t = 0.0; t < simulationDuration; t += dt)
    {
        rocket.Update(dt);

        auto pos = rocket.GetPosition();
        auto vel = rocket.GetVelocity();

        if (std::isnan(pos.x) || std::isnan(vel.x))
        {
            std::cout << "Numerical instability detected at t = "
                      << t << " s\n";
            break;
        }

        double r = pos.Magnitude();
        double altitude = r - earthRadius;
        double velocity = vel.Magnitude();

        math::Vector3 rVec(pos.x, pos.y, pos.z);
        math::Vector3 vVec(vel.x, vel.y, vel.z);

        auto elements =
            orbital::OrbitalMechanics::ComputeOrbitalElements(
                rVec, vVec, mu);

        double apoapsis = elements.apoapsis - earthRadius;
        double periapsis = elements.periapsis - earthRadius;

        if (t >= nextPrint)
        {
            std::cout << std::fixed << std::setprecision(2);
            std::cout << "Time: " << t << " s\n";
            std::cout << "  Altitude:     " << altitude / 1000.0 << " km\n";
            std::cout << "  Velocity:     " << velocity << " m/s\n";
            std::cout << "  Apoapsis:     " << apoapsis / 1000.0 << " km\n";
            std::cout << "  Periapsis:    " << periapsis / 1000.0 << " km\n";
            std::cout << "  Eccentricity: " << elements.eccentricity << "\n";
            std::cout << "  Inclination:  "
                      << elements.inclination * 180.0 / M_PI << " deg\n";
            std::cout << "  RAAN:         "
                      << elements.raan * 180.0 / M_PI << " deg\n";
            std::cout << "-----------------------------\n";

            nextPrint += printInterval;
        }

        if (periapsis > 180000.0 &&
            elements.eccentricity < 0.02)
        {
            std::cout << "\nORBIT ACHIEVED at t = "
                      << t << " seconds\n";
            std::cout << "  Final apoapsis:  "
                      << apoapsis / 1000.0 << " km\n";
            std::cout << "  Final periapsis: "
                      << periapsis / 1000.0 << " km\n";
            std::cout << "  Eccentricity:    "
                      << elements.eccentricity << "\n";
            std::cout << "  Inclination:     "
                      << elements.inclination * 180.0 / M_PI << " deg\n";
            break;
        }
    }

    return 0;
}
