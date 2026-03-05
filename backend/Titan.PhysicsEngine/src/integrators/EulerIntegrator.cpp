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
}
