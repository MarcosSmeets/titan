#pragma once

namespace titan::integrators
{
    /*
        Represents full 3D translational state.
    */
    struct State
    {
        double x;
        double y;
        double z;

        double vx;
        double vy;
        double vz;
    };

    struct Derivative
    {
        double dx;
        double dy;
        double dz;

        double dvx;
        double dvy;
        double dvz;
    };
}