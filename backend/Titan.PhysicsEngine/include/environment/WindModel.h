#pragma once
#include "math/Vector3.h"
#include <cmath>
#include <random>

namespace titan::environment
{
    /// Abstract wind model returning wind velocity at given altitude and time.
    class WindModel
    {
    public:
        virtual ~WindModel() = default;

        virtual titan::math::Vector3 GetWind(
            double altitude, double time) const = 0;
    };

    /// Constant wind at all altitudes.
    class ConstantWind : public WindModel
    {
    public:
        explicit ConstantWind(const titan::math::Vector3 &wind)
            : m_wind(wind) {}

        titan::math::Vector3 GetWind(double /*altitude*/, double /*time*/) const override
        {
            return m_wind;
        }

    private:
        titan::math::Vector3 m_wind;
    };

    /// Wind shear profile: linearly interpolates between surface and jet stream,
    /// then decays exponentially above the tropopause.
    class WindShearProfile : public WindModel
    {
    public:
        /// @param surfaceWind  Wind at ground level (m/s)
        /// @param jetStreamWind  Wind at jet stream altitude (m/s)
        /// @param jetStreamAlt  Altitude of peak wind (m), default ~11 km
        /// @param scaleHeight  Exponential decay above jet stream (m)
        WindShearProfile(
            const titan::math::Vector3 &surfaceWind,
            const titan::math::Vector3 &jetStreamWind,
            double jetStreamAlt = 11000.0,
            double scaleHeight = 7000.0)
            : m_surfaceWind(surfaceWind),
              m_jetStreamWind(jetStreamWind),
              m_jetStreamAlt(jetStreamAlt),
              m_scaleHeight(scaleHeight) {}

        titan::math::Vector3 GetWind(double altitude, double /*time*/) const override
        {
            if (altitude <= 0.0)
                return m_surfaceWind;

            if (altitude <= m_jetStreamAlt)
            {
                // Linear interpolation from surface to jet stream
                double t = altitude / m_jetStreamAlt;
                return m_surfaceWind * (1.0 - t) + m_jetStreamWind * t;
            }

            // Exponential decay above jet stream
            double decayFactor = std::exp(-(altitude - m_jetStreamAlt) / m_scaleHeight);
            return m_jetStreamWind * decayFactor;
        }

    private:
        titan::math::Vector3 m_surfaceWind;
        titan::math::Vector3 m_jetStreamWind;
        double m_jetStreamAlt;
        double m_scaleHeight;
    };
}
