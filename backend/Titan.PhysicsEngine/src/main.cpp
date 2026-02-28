#include <iostream>
#include <iomanip>
#include "simulation/Rocket2D.h"
#include <cmath>

using namespace titan::simulation;

int main()
{
    Rocket2D rocket(
        10000.0,  // dry mass (kg)
        150000.0, // fuel mass (kg)
        2500.0,   // burn rate (kg/s)
        3000.0,   // exhaust velocity (m/s)
        0.5,      // drag coefficient
        10.0,     // cross section area (m^2)
        10000.0   // gravity turn start altitude (m)
    );

    double dt = 0.1;
    double simulationDuration = 600.0;

    for (double t = 0.0; t < simulationDuration; t += dt)
    {
        rocket.Update(dt);

        auto state = rocket.GetState();

        double altitude = std::sqrt(state.x * state.x + state.y * state.y) - 6371000.0;
        double velocity = std::sqrt(state.vx * state.vx + state.vy * state.vy);
        double energy = rocket.ComputeSpecificOrbitalEnergy();

        if (static_cast<int>(t) % 10 == 0)
        {
            std::cout << std::fixed << std::setprecision(2);
            std::cout << "Time: " << t << " s\n";
            std::cout << "Altitude: " << altitude << " m\n";
            std::cout << "Velocity: " << velocity << " m/s\n";
            std::cout << "Specific Energy: " << energy << " J/kg\n";
            std::cout << "--------------------------\n";
        }

        if (rocket.IsInOrbit())
        {
            std::cout << "\n🚀 ORBIT ACHIEVED at time: " << t << " seconds\n";
            break;
        }
    }

    return 0;
}