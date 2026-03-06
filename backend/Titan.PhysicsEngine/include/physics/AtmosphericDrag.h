#pragma once
#include "physics/ForceModel.h"
#include "environment/Atmosphere.h"
#include "environment/CelestialBody.h"
#include <cmath>
#include <functional>

namespace titan::physics
{
    class AtmosphericDrag : public ForceModel
    {
    public:
        using CdFunction = std::function<double(double mach)>;

        AtmosphericDrag(
            double referenceArea,
            double dragCoefficient,
            const titan::environment::Atmosphere &atmosphere,
            double bodyRadius)
            : m_referenceArea(referenceArea),
              m_baseCd(dragCoefficient),
              m_atmosphere(atmosphere),
              m_bodyRadius(bodyRadius),
              m_cdFunction(nullptr) {}

        AtmosphericDrag(
            double referenceArea,
            CdFunction cdFunction,
            const titan::environment::Atmosphere &atmosphere,
            double bodyRadius)
            : m_referenceArea(referenceArea),
              m_baseCd(0.0),
              m_atmosphere(atmosphere),
              m_bodyRadius(bodyRadius),
              m_cdFunction(std::move(cdFunction)) {}

        void SetReferenceArea(double area) { m_referenceArea = area; }
        void SetDragCoefficient(double cd) { m_baseCd = cd; }
        void SetCdFunction(CdFunction fn) { m_cdFunction = std::move(fn); }

        titan::math::Vector3 ComputeForce(
            const titan::simulation::SimState &state,
            double /*time*/) const override
        {
            double altitude = state.position.Magnitude() - m_bodyRadius;
            if (altitude < 0.0)
                altitude = 0.0;

            double density = m_atmosphere.GetDensity(altitude);
            double speed = state.velocity.Magnitude();

            if (speed < 1e-10 || density < 1e-30)
                return {};

            double cd = m_baseCd;
            if (m_cdFunction)
            {
                double temperature = m_atmosphere.GetTemperature(altitude);
                double speedOfSound = std::sqrt(1.4 * 287.058 * temperature);
                double mach = speed / speedOfSound;
                cd = m_cdFunction(mach);
            }

            double dragMagnitude = 0.5 * density * speed * speed *
                                   cd * m_referenceArea;

            return state.velocity.Normalized() * (-dragMagnitude);
        }

        static CdFunction DefaultMachCd(double subsonicCd)
        {
            return [subsonicCd](double mach) -> double
            {
                if (mach < 0.8)
                    return subsonicCd;
                if (mach < 1.2)
                {
                    double t = (mach - 0.8) / 0.4;
                    return subsonicCd * (1.0 + 1.5 * t);
                }
                if (mach < 2.0)
                {
                    double peak = subsonicCd * 2.5;
                    double t = (mach - 1.2) / 0.8;
                    return peak * (1.0 - 0.4 * t);
                }
                return subsonicCd * 1.5;
            };
        }

    private:
        double m_referenceArea;
        double m_baseCd;
        titan::environment::Atmosphere m_atmosphere;
        double m_bodyRadius;
        CdFunction m_cdFunction;
    };
}
