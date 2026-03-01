#pragma once
#include "integrators/Integrator.h"
#include "integrators/State.h"

namespace titan::integrators
{
    class RK4Integrator : public Integrator
    {
    public:
        State Step(
            const State &state,
            double dt,
            DerivativeFunction derivativeFunc) override
        {
            Derivative k1 = derivativeFunc(state);

            State s2 = Add(state, k1, dt * 0.5);
            Derivative k2 = derivativeFunc(s2);

            State s3 = Add(state, k2, dt * 0.5);
            Derivative k3 = derivativeFunc(s3);

            State s4 = Add(state, k3, dt);
            Derivative k4 = derivativeFunc(s4);

            State result = {
                state.x + dt / 6.0 * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
                state.y + dt / 6.0 * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy),
                state.z + dt / 6.0 * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz),
                state.vx + dt / 6.0 * (k1.dvx + 2 * k2.dvx + 2 * k3.dvx + k4.dvx),
                state.vy + dt / 6.0 * (k1.dvy + 2 * k2.dvy + 2 * k3.dvy + k4.dvy),
                state.vz + dt / 6.0 * (k1.dvz + 2 * k2.dvz + 2 * k3.dvz + k4.dvz)};

            return result;
        }

    private:
        State Add(const State &s, const Derivative &d, double dt)
        {
            return {
                s.x + d.dx * dt,
                s.y + d.dy * dt,
                s.z + d.dz * dt,
                s.vx + d.dvx * dt,
                s.vy + d.dvy * dt,
                s.vz + d.dvz * dt};
        }
    };
}