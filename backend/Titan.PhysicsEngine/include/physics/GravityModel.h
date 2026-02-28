#pragma once

namespace titan::physics
{
    class GravityModel
    {
    public:
        /*
            Computes gravitational acceleration magnitude at a given altitude.

            Uses Newton's law of universal gravitation:

                g(h) = G * M / (R + h)^2

            Returns acceleration in m/s² (positive magnitude).
        */
        static double ComputeGravity(double altitude);

    private:
        static constexpr double G = 6.67430e-11;         // Gravitational constant (m³/kg/s²)
        static constexpr double EarthMass = 5.972e24;    // kg
        static constexpr double EarthRadius = 6371000.0; // meters
    };
}