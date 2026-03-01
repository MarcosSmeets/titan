#pragma once
#include "Integrator.h"

namespace titan::integrators
{
    class EulerIntegrator : public Integrator
    {
    public:
        State Step(
            const State &current,
            double dt,
            std::function<Derivative(const State &)> derivativeFunc) override;
    };
}