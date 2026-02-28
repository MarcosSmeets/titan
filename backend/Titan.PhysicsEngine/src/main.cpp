#include <iostream>
#include "simulation/Rocket1D.h"

int main()
{
    titan::simulation::Rocket1D rocket(
        1000.0, // dry mass
        500.0,  // fuel
        5.0,    // kg/s
        3000.0  // thrust (m/s)
    );

    double dt = 0.1;
    double totalTime = 200.0;

    for (double t = 0; t < totalTime; t += dt)
    {
        rocket.Update(dt);
        auto state = rocket.GetState();

        std::cout << "t=" << t
                  << " alt=" << state.altitude
                  << " vel=" << state.velocity
                  << " mass=" << state.totalMass
                  << " fuel=" << state.fuelMass
                  << std::endl;

        if (state.altitude < 0)
            break;
    }

    return 0;
}