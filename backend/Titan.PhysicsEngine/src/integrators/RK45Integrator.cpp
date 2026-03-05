#include "integrators/RK45Integrator.h"
#include <cmath>
#include <algorithm>

namespace titan::integrators
{

    RK45Integrator::RK45Integrator(
        double atol, double rtol, double h_min, double h_max)
        : m_atol(atol),
          m_rtol(rtol),
          m_h_min(h_min),
          m_h_max(h_max),
          m_h_current(0.0)
    {
    }

    // Helper: apply derivative to state with weight
    static State AddWeighted(const State &base, double h,
                             const Derivative &k, double w)
    {
        return {
            base.x + h * w * k.dx,
            base.y + h * w * k.dy,
            base.z + h * w * k.dz,
            base.vx + h * w * k.dvx,
            base.vy + h * w * k.dvy,
            base.vz + h * w * k.dvz};
    }

    // Helper: combine multiple weighted derivatives
    static State AddWeighted6(const State &base, double h,
                              const Derivative &k1, double w1,
                              const Derivative &k2, double w2,
                              const Derivative &k3, double w3,
                              const Derivative &k4, double w4,
                              const Derivative &k5, double w5,
                              const Derivative &k6, double w6)
    {
        return {
            base.x + h * (w1 * k1.dx + w2 * k2.dx + w3 * k3.dx + w4 * k4.dx + w5 * k5.dx + w6 * k6.dx),
            base.y + h * (w1 * k1.dy + w2 * k2.dy + w3 * k3.dy + w4 * k4.dy + w5 * k5.dy + w6 * k6.dy),
            base.z + h * (w1 * k1.dz + w2 * k2.dz + w3 * k3.dz + w4 * k4.dz + w5 * k5.dz + w6 * k6.dz),
            base.vx + h * (w1 * k1.dvx + w2 * k2.dvx + w3 * k3.dvx + w4 * k4.dvx + w5 * k5.dvx + w6 * k6.dvx),
            base.vy + h * (w1 * k1.dvy + w2 * k2.dvy + w3 * k3.dvy + w4 * k4.dvy + w5 * k5.dvy + w6 * k6.dvy),
            base.vz + h * (w1 * k1.dvz + w2 * k2.dvz + w3 * k3.dvz + w4 * k4.dvz + w5 * k5.dvz + w6 * k6.dvz)};
    }

    StepResult RK45Integrator::Step(
        const State &current,
        double dt,
        std::function<Derivative(const State &)> derivativeFunc)
    {
        double h = (m_h_current > 0.0) ? m_h_current : dt;
        h = std::min(h, dt);
        h = std::clamp(h, m_h_min, m_h_max);

        double t_remaining = dt;
        State state = current;

        while (t_remaining > m_h_min)
        {
            h = std::min(h, t_remaining);

            // Stage 1
            Derivative k1 = derivativeFunc(state);

            // Stage 2
            State s2 = AddWeighted(state, h, k1, b21);
            Derivative k2 = derivativeFunc(s2);

            // Stage 3
            State s3{
                state.x + h * (b31 * k1.dx + b32 * k2.dx),
                state.y + h * (b31 * k1.dy + b32 * k2.dy),
                state.z + h * (b31 * k1.dz + b32 * k2.dz),
                state.vx + h * (b31 * k1.dvx + b32 * k2.dvx),
                state.vy + h * (b31 * k1.dvy + b32 * k2.dvy),
                state.vz + h * (b31 * k1.dvz + b32 * k2.dvz)};
            Derivative k3 = derivativeFunc(s3);

            // Stage 4
            State s4{
                state.x + h * (b41 * k1.dx + b42 * k2.dx + b43 * k3.dx),
                state.y + h * (b41 * k1.dy + b42 * k2.dy + b43 * k3.dy),
                state.z + h * (b41 * k1.dz + b42 * k2.dz + b43 * k3.dz),
                state.vx + h * (b41 * k1.dvx + b42 * k2.dvx + b43 * k3.dvx),
                state.vy + h * (b41 * k1.dvy + b42 * k2.dvy + b43 * k3.dvy),
                state.vz + h * (b41 * k1.dvz + b42 * k2.dvz + b43 * k3.dvz)};
            Derivative k4 = derivativeFunc(s4);

            // Stage 5
            State s5{
                state.x + h * (b51 * k1.dx + b52 * k2.dx + b53 * k3.dx + b54 * k4.dx),
                state.y + h * (b51 * k1.dy + b52 * k2.dy + b53 * k3.dy + b54 * k4.dy),
                state.z + h * (b51 * k1.dz + b52 * k2.dz + b53 * k3.dz + b54 * k4.dz),
                state.vx + h * (b51 * k1.dvx + b52 * k2.dvx + b53 * k3.dvx + b54 * k4.dvx),
                state.vy + h * (b51 * k1.dvy + b52 * k2.dvy + b53 * k3.dvy + b54 * k4.dvy),
                state.vz + h * (b51 * k1.dvz + b52 * k2.dvz + b53 * k3.dvz + b54 * k4.dvz)};
            Derivative k5 = derivativeFunc(s5);

            // Stage 6
            State s6 = AddWeighted6(state, h,
                                    k1, b61, k2, b62, k3, b63,
                                    k4, b64, k5, b65,
                                    k1, 0.0); // placeholder, computed manually
            // Recompute s6 properly
            s6 = {
                state.x + h * (b61 * k1.dx + b62 * k2.dx + b63 * k3.dx + b64 * k4.dx + b65 * k5.dx),
                state.y + h * (b61 * k1.dy + b62 * k2.dy + b63 * k3.dy + b64 * k4.dy + b65 * k5.dy),
                state.z + h * (b61 * k1.dz + b62 * k2.dz + b63 * k3.dz + b64 * k4.dz + b65 * k5.dz),
                state.vx + h * (b61 * k1.dvx + b62 * k2.dvx + b63 * k3.dvx + b64 * k4.dvx + b65 * k5.dvx),
                state.vy + h * (b61 * k1.dvy + b62 * k2.dvy + b63 * k3.dvy + b64 * k4.dvy + b65 * k5.dvy),
                state.vz + h * (b61 * k1.dvz + b62 * k2.dvz + b63 * k3.dvz + b64 * k4.dvz + b65 * k5.dvz)};
            Derivative k6 = derivativeFunc(s6);

            // 5th order solution
            State y5{
                state.x + h * (c1 * k1.dx + c3 * k3.dx + c4 * k4.dx + c5 * k5.dx + c6 * k6.dx),
                state.y + h * (c1 * k1.dy + c3 * k3.dy + c4 * k4.dy + c5 * k5.dy + c6 * k6.dy),
                state.z + h * (c1 * k1.dz + c3 * k3.dz + c4 * k4.dz + c5 * k5.dz + c6 * k6.dz),
                state.vx + h * (c1 * k1.dvx + c3 * k3.dvx + c4 * k4.dvx + c5 * k5.dvx + c6 * k6.dvx),
                state.vy + h * (c1 * k1.dvy + c3 * k3.dvy + c4 * k4.dvy + c5 * k5.dvy + c6 * k6.dvy),
                state.vz + h * (c1 * k1.dvz + c3 * k3.dvz + c4 * k4.dvz + c5 * k5.dvz + c6 * k6.dvz)};

            // Stage 7 for error estimate
            Derivative k7 = derivativeFunc(y5);

            // 4th order solution
            State y4{
                state.x + h * (d1 * k1.dx + d3 * k3.dx + d4 * k4.dx + d5 * k5.dx + d6 * k6.dx + d7 * k7.dx),
                state.y + h * (d1 * k1.dy + d3 * k3.dy + d4 * k4.dy + d5 * k5.dy + d6 * k6.dy + d7 * k7.dy),
                state.z + h * (d1 * k1.dz + d3 * k3.dz + d4 * k4.dz + d5 * k5.dz + d6 * k6.dz + d7 * k7.dz),
                state.vx + h * (d1 * k1.dvx + d3 * k3.dvx + d4 * k4.dvx + d5 * k5.dvx + d6 * k6.dvx + d7 * k7.dvx),
                state.vy + h * (d1 * k1.dvy + d3 * k3.dvy + d4 * k4.dvy + d5 * k5.dvy + d6 * k6.dvy + d7 * k7.dvy),
                state.vz + h * (d1 * k1.dvz + d3 * k3.dvz + d4 * k4.dvz + d5 * k5.dvz + d6 * k6.dvz + d7 * k7.dvz)};

            // Error estimate: max of component-wise |y5 - y4| / (atol + rtol * |y5|)
            double err = 0.0;
            auto scaleErr = [&](double val5, double val4)
            {
                double scale = m_atol + m_rtol * std::abs(val5);
                double e = std::abs(val5 - val4) / scale;
                if (e > err)
                    err = e;
            };

            scaleErr(y5.x, y4.x);
            scaleErr(y5.y, y4.y);
            scaleErr(y5.z, y4.z);
            scaleErr(y5.vx, y4.vx);
            scaleErr(y5.vy, y4.vy);
            scaleErr(y5.vz, y4.vz);

            if (err <= 1.0)
            {
                // Accept step
                state = y5;
                t_remaining -= h;

                // Compute new step size
                double factor = (err > 1e-15)
                                    ? 0.84 * std::pow(1.0 / err, 0.25)
                                    : 4.0;
                factor = std::clamp(factor, 0.1, 4.0);
                h *= factor;
                h = std::clamp(h, m_h_min, m_h_max);
            }
            else
            {
                // Reject step, reduce h
                double factor = 0.84 * std::pow(1.0 / err, 0.25);
                factor = std::max(factor, 0.1);
                h *= factor;
                h = std::max(h, m_h_min);
            }
        }

        m_h_current = h;
        return {state, dt};
    }

}
