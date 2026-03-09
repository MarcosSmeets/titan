#pragma once
#include <functional>
#include "integrators/Integrator.h"

namespace titan::integrators
{
    class RK4Integrator : public Integrator
    {
    public:
        StepResult Step(
            const State &current,
            double dt,
            std::function<Derivative(const State &)> derivativeFunc) override;

        VectorStepResult StepVector(
            const StateVector &current,
            double dt,
            std::function<DerivativeVector(const StateVector &)> derivativeFunc) override;
    };
}
