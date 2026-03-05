#pragma once
#include <functional>
#include "integrators/State.h"

namespace titan::integrators
{
    struct StepResult
    {
        State state;
        double dt_used;
    };

    class Integrator
    {
    public:
        virtual ~Integrator() = default;

        virtual StepResult Step(
            const State &current,
            double dt,
            std::function<Derivative(const State &)> derivativeFunc) = 0;
    };
}
