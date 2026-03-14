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

            double r = rVec.Magnitude();
            double altitude = r - m_earthRadius;
            double speed = vVec.Magnitude();

            auto elements =
                titan::orbital::OrbitalMechanics::
                    ComputeOrbitalElements(rVec, vVec, mu);

            double apoapsis = elements.apoapsis - m_earthRadius;
            double periapsis = elements.periapsis - m_earthRadius;

            // Phase 1: Vertical ascent (clear the pad)
            if (altitude < m_kickAltitude)
                return M_PI_2;

            // Phase 2: Gravity turn — raise apoapsis to target
            if (apoapsis < m_targetAltitude)
            {
                // In the atmosphere (below ~50km): use altitude-scheduled
                // pitch to manage aero loads while turning
                double altFraction = std::clamp(altitude / m_targetAltitude, 0.0, 1.0);
                double scheduledPitch = (1.0 - altFraction) * M_PI_2;

                // Above atmosphere: follow velocity vector (zero AoA)
                // for aerodynamic efficiency and natural gravity turn
                if (altitude > 50000.0 && speed > 1.0)
                {
                    titan::math::Vector3 rHat = rVec.Normalized();
                    double vRadial = titan::math::Vector3::Dot(vVec, rHat);
                    double vHoriz = std::sqrt(std::max(0.0, speed * speed - vRadial * vRadial));
                    double velocityPitch = std::atan2(vRadial, vHoriz);
                    return std::clamp(velocityPitch, 0.0, M_PI_2);
                }

                return std::clamp(scheduledPitch, 0.0, M_PI_2);
            }

            // Phase 3: Circularization — thrust prograde to raise periapsis
            if (periapsis < m_targetAltitude * 0.9)
                return 0.0;

            // Orbit achieved
            return 0.0;
        }

    private:
        double m_targetAltitude;
        double m_earthRadius;
        double m_kickAltitude = 500.0;   // meters — vertical ascent phase
        double m_kickAngle = 5.0 * M_PI / 180.0; // ~5 degrees initial kick
    };
}
