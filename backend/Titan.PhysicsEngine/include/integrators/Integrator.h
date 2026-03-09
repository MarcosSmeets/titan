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

    struct VectorStepResult
    {
        StateVector state;
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

        virtual VectorStepResult StepVector(
            const StateVector &current,
            double dt,
            std::function<DerivativeVector(const StateVector &)> derivativeFunc)
        {
            // Default: delegate to legacy 6-field Step for backward compat
            if (current.size() == 6)
            {
                State s{current[0], current[1], current[2],
                        current[3], current[4], current[5]};

                auto legacyDeriv = [&](const State &ls) -> Derivative
                {
                    StateVector sv = {ls.x, ls.y, ls.z, ls.vx, ls.vy, ls.vz};
                    auto dv = derivativeFunc(sv);
                    return {dv[0], dv[1], dv[2], dv[3], dv[4], dv[5]};
                };

                auto result = Step(s, dt, legacyDeriv);
                StateVector out = {result.state.x, result.state.y, result.state.z,
                                   result.state.vx, result.state.vy, result.state.vz};
                return {out, result.dt_used};
            }
            // Subclasses must override for N != 6
            return {current, dt};
        }
    };
}
