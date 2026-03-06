#pragma once
#include "math/Vector3.h"
#include "simulation/SimState.h"

namespace titan::physics
{
    class ForceModel
    {
    public:
        virtual ~ForceModel() = default;

        virtual titan::math::Vector3 ComputeForce(
            const titan::simulation::SimState &state,
            double time) const = 0;

        titan::math::Vector3 ComputeAcceleration(
            const titan::simulation::SimState &state,
            double time) const
        {
            if (state.mass <= 0.0)
                return {};
            return ComputeForce(state, time) / state.mass;
        }
    };
}
