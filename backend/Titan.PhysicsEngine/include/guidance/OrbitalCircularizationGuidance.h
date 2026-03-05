#pragma once
#include "guidance/Guidance.h"
#include "orbital/OrbitalMechanics.h"
#include "math/Vector3.h"
#include <cmath>

namespace titan::guidance
{
    class OrbitalCircularizationGuidance : public Guidance
    {
    public:
        OrbitalCircularizationGuidance(
            double targetAltitude,
            double earthRadius)
            : m_targetAltitude(targetAltitude),
              m_earthRadius(earthRadius)
        {
        }

        double ComputePitchAngle(
            const titan::integrators::State &state,
            double mu) override
        {
            titan::math::Vector3 rVec(state.x, state.y, state.z);
            titan::math::Vector3 vVec(state.vx, state.vy, state.vz);

            auto elements =
                titan::orbital::OrbitalMechanics::
                    ComputeOrbitalElements(rVec, vVec, mu);

            double apoapsis =
                elements.apoapsis - m_earthRadius;

            double periapsis =
                elements.periapsis - m_earthRadius;

            double r = rVec.Magnitude();
            double altitude = r - m_earthRadius;

            // Phase 1: Gravity turn — pitch over from vertical
            if (apoapsis < m_targetAltitude)
            {
                double t = altitude / m_targetAltitude;
                t = std::clamp(t, 0.0, 1.0);

                return (1.0 - t) * M_PI_2;
            }

            // Phase 2: Circularization burn (pure prograde)
            if (periapsis < m_targetAltitude * 0.9)
                return 0.0;

            // Orbit achieved
            return 0.0;
        }

    private:
        double m_targetAltitude;
        double m_earthRadius;
    };
}
