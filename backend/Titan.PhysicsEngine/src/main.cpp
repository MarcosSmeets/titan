#include <iostream>
#include <iomanip>
#include <memory>
#include <cmath>

#include "simulation/LaunchVehicle2D.h"
#include "simulation/Stage.h"
#include "integrators/RK4Integrator.h"
#include "guidance/TargetApoapsisGuidance.h"
#include "orbital/OrbitalMechanics.h"
#include "math/Vector2.h"

using namespace titan;

int main()
{
    const double earthRadius = 6371000.0;
    const double mu = 3.986e14;

    auto integrator =
        std::make_unique<integrators::RK4Integrator>();

    auto guidance =
        std::make_unique<guidance::TargetApoapsisGuidance>(
            200000.0, // Target apoapsis: 200 km
            earthRadius);

    simulation::LaunchVehicle2D rocket(
        earthRadius,
        mu,
        std::move(integrator),
        std::move(guidance));

    rocket.AddStage(
        simulation::Stage(
            10000.0,  // dry mass
            150000.0, // fuel mass
            2500.0,   // burn rate
            3000.0,   // exhaust velocity
            10.0,     // reference area (m^2)
            0.5));    // drag coefficient

    double dt = 0.05;
    double simulationDuration = 600.0;

    for (double t = 0.0; t < simulationDuration; t += dt)
    {
        rocket.Update(dt);

        auto pos = rocket.GetPosition();
        auto vel = rocket.GetVelocity();
        // numerical stability guard
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

        // Orbit condition: periapsis above atmosphere and near circular
        if (periapsis > 150000.0 &&
            elements.eccentricity < 0.05)
        {
            std::cout << "\n🚀 ORBIT ACHIEVED at t = "
                      << t << " seconds\n";
            break;
        }
    }

    return 0;
}