#include "integrators/EulerIntegrator.h"

namespace titan::integration
{
    State EulerIntegrator::Step(
        const State &current,
        double dt,
        std::function<Derivative(const State &)> derivativeFunc)
    {
        Derivative d = derivativeFunc(current);

        State next;
        next.x = current.x + d.dx * dt;
        next.y = current.y + d.dy * dt;
        next.vx = current.vx + d.dvx * dt;
        next.vy = current.vy + d.dvy * dt;

        return next;
    }
}