#pragma once
#include "Integrator.h"

namespace titan::integrators
{
    class RK45Integrator : public Integrator
    {
    public:
        RK45Integrator(
            double atol = 1e-8,
            double rtol = 1e-6,
            double h_min = 1e-6,
            double h_max = 10.0);

        StepResult Step(
            const State &current,
            double dt,
            std::function<Derivative(const State &)> derivativeFunc) override;

    private:
        double m_atol;
        double m_rtol;
        double m_h_min;
        double m_h_max;
        double m_h_current;

        // Dormand-Prince coefficients
        static constexpr double a2 = 1.0 / 5.0;
        static constexpr double a3 = 3.0 / 10.0;
        static constexpr double a4 = 4.0 / 5.0;
        static constexpr double a5 = 8.0 / 9.0;
        // a6 = 1.0, a7 = 1.0

        static constexpr double b21 = 1.0 / 5.0;

        static constexpr double b31 = 3.0 / 40.0;
        static constexpr double b32 = 9.0 / 40.0;

        static constexpr double b41 = 44.0 / 45.0;
        static constexpr double b42 = -56.0 / 15.0;
        static constexpr double b43 = 32.0 / 9.0;

        static constexpr double b51 = 19372.0 / 6561.0;
        static constexpr double b52 = -25360.0 / 2187.0;
        static constexpr double b53 = 64448.0 / 6561.0;
        static constexpr double b54 = -212.0 / 729.0;

        static constexpr double b61 = 9017.0 / 3168.0;
        static constexpr double b62 = -355.0 / 33.0;
        static constexpr double b63 = 46732.0 / 5247.0;
        static constexpr double b64 = 49.0 / 176.0;
        static constexpr double b65 = -5103.0 / 18656.0;

        // 5th order weights
        static constexpr double c1 = 35.0 / 384.0;
        // c2 = 0
        static constexpr double c3 = 500.0 / 1113.0;
        static constexpr double c4 = 125.0 / 192.0;
        static constexpr double c5 = -2187.0 / 6784.0;
        static constexpr double c6 = 11.0 / 84.0;

        // 4th order weights (for error estimate)
        static constexpr double d1 = 5179.0 / 57600.0;
        // d2 = 0
        static constexpr double d3 = 7571.0 / 16695.0;
        static constexpr double d4 = 393.0 / 640.0;
        static constexpr double d5 = -92097.0 / 339200.0;
        static constexpr double d6 = 187.0 / 2100.0;
        static constexpr double d7 = 1.0 / 40.0;
    };
}
