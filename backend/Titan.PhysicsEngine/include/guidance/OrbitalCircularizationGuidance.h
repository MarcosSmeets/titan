#pragma once
#include "guidance/Guidance.h"
#include "orbital/OrbitalMechanics.h"
#include <cmath>

namespace titan::guidance
{
    /*
        Real two-phase orbital guidance:

        1) Ascent to target apoapsis
        2) Coast to apoapsis
        3) Circularization burn
    */
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
            titan::math::Vector2 rVec(state.x, state.y);
            titan::math::Vector2 vVec(state.vx, state.vy);

            auto elements =
                titan::orbital::OrbitalMechanics::
                    ComputeOrbitalElements(
                        rVec, vVec, mu);

            double apoapsis =
                elements.apoapsis - m_earthRadius;

            double periapsis =
                elements.periapsis - m_earthRadius;

            double r = std::sqrt(state.x * state.x +
                                 state.y * state.y);

            double altitude = r - m_earthRadius;

            // Phase 1: Gravity turn
            if (apoapsis < m_targetAltitude)
            {
                double t = altitude / m_targetAltitude;
                t = std::clamp(t, 0.0, 1.0);

                double pitch =
                    (1.0 - t) * M_PI_2;

                return pitch;
            }

            // Phase 2: Circularization burn
            if (periapsis < m_targetAltitude * 0.9)
            {
                // Pure horizontal burn
                return 0.0;
            }

            // Orbit achieved → engine can idle
            return 0.0;
        }

    private:
        double m_targetAltitude;
        double m_earthRadius;
    };
}