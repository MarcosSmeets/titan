#include "integrators/RK4Integrator.h"

namespace titan::integrators
{
    StepResult RK4Integrator::Step(
        const State &current,
        double dt,
        std::function<Derivative(const State &)> derivativeFunc)
    {
        Derivative k1 = derivativeFunc(current);

        State s2{
            current.x + 0.5 * dt * k1.dx,
            current.y + 0.5 * dt * k1.dy,
            current.z + 0.5 * dt * k1.dz,
            current.vx + 0.5 * dt * k1.dvx,
            current.vy + 0.5 * dt * k1.dvy,
            current.vz + 0.5 * dt * k1.dvz};

        Derivative k2 = derivativeFunc(s2);

        State s3{
            current.x + 0.5 * dt * k2.dx,
            current.y + 0.5 * dt * k2.dy,
            current.z + 0.5 * dt * k2.dz,
            current.vx + 0.5 * dt * k2.dvx,
            current.vy + 0.5 * dt * k2.dvy,
            current.vz + 0.5 * dt * k2.dvz};

        Derivative k3 = derivativeFunc(s3);

        State s4{
            current.x + dt * k3.dx,
            current.y + dt * k3.dy,
            current.z + dt * k3.dz,
            current.vx + dt * k3.dvx,
            current.vy + dt * k3.dvy,
            current.vz + dt * k3.dvz};

        Derivative k4 = derivativeFunc(s4);

        State next;

        next.x =
            current.x + (dt / 6.0) *
                            (k1.dx + 2.0 * k2.dx + 2.0 * k3.dx + k4.dx);

        next.y =
            current.y + (dt / 6.0) *
                            (k1.dy + 2.0 * k2.dy + 2.0 * k3.dy + k4.dy);

        next.z =
            current.z + (dt / 6.0) *
                            (k1.dz + 2.0 * k2.dz + 2.0 * k3.dz + k4.dz);

        next.vx =
            current.vx + (dt / 6.0) *
                             (k1.dvx + 2.0 * k2.dvx + 2.0 * k3.dvx + k4.dvx);

        next.vy =
            current.vy + (dt / 6.0) *
                             (k1.dvy + 2.0 * k2.dvy + 2.0 * k3.dvy + k4.dvy);

        next.vz =
            current.vz + (dt / 6.0) *
                             (k1.dvz + 2.0 * k2.dvz + 2.0 * k3.dvz + k4.dvz);

        return {next, dt};
    }
}
