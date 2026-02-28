#include <iostream>
#include "simulation/Rocket1D.h"

int main()
{
    titan::simulation::Rocket1D rocket(
        1000.0, // massa(kg)
        15000.0 // thrust (N)
    );

    double dt = 0.1; // 100ms
    double totalTime = 10.0;

    for (double t = 0; t < totalTime; t += dt)
    {
        rocket.Update(dt);

        auto state = rocket.GetState();

        std::cout << "t=" << t
                  << " alt=" << state.altitude
                  << " vel=" << state.velocity
                  << std::endl;
    }

    return 0;
}