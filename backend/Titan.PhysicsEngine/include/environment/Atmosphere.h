#pragma once

#include <cmath>

namespace titan::environment
{
    class Atmosphere
    {
    public:
        Atmosphere(double rho0 = 1.225, double scaleHeight = 8500.0,
                   double surfacePressure = 101325.0, double surfaceTemperature = 288.15)
            : m_rho0(rho0),
              m_scaleHeight(scaleHeight),
              m_surfacePressure(surfacePressure),
              m_surfaceTemperature(surfaceTemperature)
        {
        }

        virtual ~Atmosphere() = default;

        virtual double GetDensity(double altitude) const
        {
            if (altitude < 0.0)
                altitude = 0.0;

            return m_rho0 * std::exp(-altitude / m_scaleHeight);
        }

        virtual double GetTemperature(double altitude) const
        {
            if (altitude < 0.0)
                altitude = 0.0;

            // Simple lapse rate model for basic exponential atmosphere
            if (altitude < 11000.0)
                return m_surfaceTemperature - 0.0065 * altitude;

            return 216.65; // isothermal stratosphere
        }

        virtual double GetPressure(double altitude) const
        {
            if (altitude < 0.0)
                altitude = 0.0;

            return m_surfacePressure * std::exp(-altitude / m_scaleHeight);
        }

        double GetScaleHeight() const { return m_scaleHeight; }
        double GetSurfaceDensity() const { return m_rho0; }

    protected:
        double m_rho0;
        double m_scaleHeight;
        double m_surfacePressure;
        double m_surfaceTemperature;
    };
}
