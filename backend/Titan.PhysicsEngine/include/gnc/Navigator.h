#pragma once
#include "simulation/SimState.h"

namespace titan::gnc
{
    class Navigator
    {
    public:
        virtual ~Navigator() = default;

        virtual titan::simulation::SimState EstimateState(
            const titan::simulation::SimState &trueState,
            double time) const = 0;
    };

    class IdealNavigator : public Navigator
    {
    public:
        titan::simulation::SimState EstimateState(
            const titan::simulation::SimState &trueState,
            double /*time*/) const override
        {
            return trueState;
        }
    };
}
