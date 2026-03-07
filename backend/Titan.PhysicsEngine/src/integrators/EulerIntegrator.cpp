#include "integrators/EulerIntegrator.h"

namespace titan::integrators
{
    StepResult EulerIntegrator::Step(
        const State &current,
        double dt,
        std::function<Derivative(const State &)> derivativeFunc)
    {
        Derivative d = derivativeFunc(current);

        State next;
        next.x = current.x + d.dx * dt;
        next.y = current.y + d.dy * dt;
        next.z = current.z + d.dz * dt;
        next.vx = current.vx + d.dvx * dt;
        next.vy = current.vy + d.dvy * dt;
        next.vz = current.vz + d.dvz * dt;

        return {next, dt};
    }

    VectorStepResult EulerIntegrator::StepVector(
        const StateVector &current,
        double dt,
        std::function<DerivativeVector(const StateVector &)> derivativeFunc)
    {
        size_t n = current.size();
        DerivativeVector d = derivativeFunc(current);

        StateVector next(n);
        for (size_t i = 0; i < n; i++)
            next[i] = current[i] + d[i] * dt;

        return {next, dt};
    }
}
