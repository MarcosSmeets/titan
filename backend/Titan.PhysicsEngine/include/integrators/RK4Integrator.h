#pragma once
#include "Integrator.h"

namespace titan::integration
{
    class RK4Integrator : public Integrator
    {
    public:
        State Step(
            const State &current,
            double dt,
            std::function<Derivative(const State &)> derivativeFunc) override;
    };
}