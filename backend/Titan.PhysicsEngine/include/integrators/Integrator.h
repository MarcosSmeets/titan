#pragma once
#include <functional>

namespace titan::integration
{
    /*
        Represents the state of a dynamical system.

        For 2D rocket:
            x, y       -> position
            vx, vy     -> velocity
    */
    struct State
    {
        double x;
        double y;
        double vx;
        double vy;
    };

    /*
        Represents time derivatives of the state.
    */
    struct Derivative
    {
        double dx;
        double dy;
        double dvx;
        double dvy;
    };

    /*
        Integrator interface.

        Accepts:
            - Current state
            - Time step dt
            - Function that computes derivatives

        Returns:
            - New state after integration
    */
    class Integrator
    {
    public:
        virtual ~Integrator() = default;

        virtual State Step(
            const State &current,
            double dt,
            std::function<Derivative(const State &)> derivativeFunc) = 0;
    };
}