#pragma once

namespace titan::physics
{
    class AtmosphereModel
    {
    public:
        static double GetDensity(double altitude);

    private:
        static constexpr double rho0 = 1.225;         // kg/m³
        static constexpr double scaleHeight = 8500.0; // m
    };
}