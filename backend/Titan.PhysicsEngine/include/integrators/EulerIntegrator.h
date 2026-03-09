#pragma once
#include "Integrator.h"

namespace titan::integrators
{
    class EulerIntegrator : public Integrator
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
