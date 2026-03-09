#pragma once
#include "simulation/SimState.h"
#include "math/Vector3.h"

namespace titan::gnc
{
    struct ActuatorCommands
    {
        titan::math::Vector3 thrustDirection;
        double throttle;
        titan::math::Vector3 torqueCommand;

        ActuatorCommands()
            : throttle(1.0) {}
    };

    class Controller
    {
    public:
        virtual ~Controller() = default;

        virtual ActuatorCommands Compute(
            const titan::simulation::SimState &current,
            const titan::simulation::SimState &desired,
            double dt) = 0;
    };
}
