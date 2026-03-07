#pragma once
#include <vector>

namespace titan::integrators
{
    using StateVector = std::vector<double>;
    using DerivativeVector = std::vector<double>;

    /*
        Legacy struct kept for backward compatibility with
        LaunchVehicle2D, LaunchVehicle3D, and Guidance interfaces.
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
