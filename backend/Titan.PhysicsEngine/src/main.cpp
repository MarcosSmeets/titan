#include <iostream>
#include <iomanip>
#include <memory>
#include <cmath>

#include "simulation/LaunchVehicle2D.h"
#include "simulation/Stage.h"
#include "integrators/RK4Integrator.h"
#include "guidance/OrbitalCircularizationGuidance.h"
#include "orbital/OrbitalMechanics.h"
#include "math/Vector2.h"

using namespace titan;

int main()
{
    // Earth parameters
    const double earthRadius = 6371000.0; // meters
    const double mu = 3.986e14;           // Earth's gravitational parameter

    // Create numerical integrator (RK4)
    auto integrator =
        std::make_unique<integrators::RK4Integrator>();

    // Create advanced orbital circularization guidance
    auto guidance =
        std::make_unique<guidance::OrbitalCircularizationGuidance>(
            200000.0, // Target orbit altitude: 200 km
            earthRadius);

    // Create launch vehicle
    simulation::LaunchVehicle2D rocket(
        earthRadius,
        mu,
        std::move(integrator),
        std::move(guidance));

    // Limit maximum acceleration to 4g
    rocket.SetMaxG(4.0);

    // Add single stage
    rocket.AddStage(
        simulation::Stage(
            10000.0,  // dry mass (kg)
            150000.0, // fuel mass (kg)
            2500.0,   // burn rate (kg/s)
            3000.0,   // exhaust velocity (m/s)
            10.0,     // reference area (m^2)
            0.5));    // drag coefficient

    double dt = 0.05;                  // integration time step
    double simulationDuration = 900.0; // allow more time for circularization

    for (double t = 0.0; t < simulationDuration; t += dt)
    {
        rocket.Update(dt);

        auto pos = rocket.GetPosition();
        auto vel = rocket.GetVelocity();

        // Numerical stability guard
        if (std::isnan(pos.x) || std::isnan(vel.x))
        {
            std::cout << "Numerical instability detected.\n";
            break;
        }

        double r = std::sqrt(pos.x * pos.x + pos.y * pos.y);
        double altitude = r - earthRadius;
        double velocity = std::sqrt(vel.x * vel.x + vel.y * vel.y);

        math::Vector2 rVec(pos.x, pos.y);
        math::Vector2 vVec(vel.x, vel.y);

        auto elements =
            orbital::OrbitalMechanics::ComputeOrbitalElements(
                rVec, vVec, mu);

        double apoapsis = elements.apoapsis - earthRadius;
        double periapsis = elements.periapsis - earthRadius;

        // Print telemetry every 5 seconds
        if (static_cast<int>(t) % 5 == 0)
        {
            std::cout << std::fixed << std::setprecision(2);
            std::cout << "Time: " << t << " s\n";
            std::cout << "Altitude: " << altitude << " m\n";
            std::cout << "Velocity: " << velocity << " m/s\n";
            std::cout << "Apoapsis: " << apoapsis << " m\n";
            std::cout << "Periapsis: " << periapsis << " m\n";
            std::cout << "Eccentricity: " << elements.eccentricity << "\n";
            std::cout << "-----------------------------\n";
        }

        // Orbit condition:
        // Periapsis above atmosphere AND nearly circular
        if (periapsis > 180000.0 &&
            elements.eccentricity < 0.02)
        {
            std::cout << "\n🚀 ORBIT ACHIEVED at t = "
                      << t << " seconds\n";
            break;
        }
    }

    return 0;
}