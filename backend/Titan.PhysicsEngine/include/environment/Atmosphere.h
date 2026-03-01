#pragma once

#include <cmath>

namespace titan::environment
{
    /*
        Simple exponential atmosphere model.

        ρ(h) = ρ0 * exp(-h / H)

        ρ0 = sea level density
        H  = scale height
    */
    class Atmosphere
    {
    public:
        Atmosphere(double rho0 = 1.225, double scaleHeight = 8500.0)
            : m_rho0(rho0),
              m_scaleHeight(scaleHeight)
        {
        }

        /*
            Computes air density at given altitude (meters).
        */
        double GetDensity(double altitude) const
        {
            if (altitude < 0.0)
                altitude = 0.0;

            return m_rho0 * std::exp(-altitude / m_scaleHeight);
        }

    private:
        double m_rho0;        // Sea level density (kg/m^3)
        double m_scaleHeight; // Scale height (m)
    };
}