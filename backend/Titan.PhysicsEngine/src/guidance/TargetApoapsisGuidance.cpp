#include "guidance/TargetApoapsisGuidance.h"
#include "orbital/OrbitalMechanics.h"
#include "math/Vector2.h"
#include <cmath>

namespace titan::guidance
{

    TargetApoapsisGuidance::TargetApoapsisGuidance(
        double targetApoapsis,
        double earthRadius)
        : m_targetApoapsis(targetApoapsis),
          m_earthRadius(earthRadius),
          m_kp(5e-7) // Conservative proportional gain
    {
    }

    /*
        Computes pitch angle using a proportional
        closed-loop controller targeting apoapsis.
    */
    double TargetApoapsisGuidance::ComputePitchAngle(
        const titan::integrators::State &state,
        double mu)
    {
        titan::math::Vector2 r(state.x, state.y);
        titan::math::Vector2 v(state.vx, state.vy);

        auto elements =
            titan::orbital::OrbitalMechanics::ComputeOrbitalElements(
                r, v, mu);

        double currentApoapsis =
            elements.apoapsis - m_earthRadius;

        double error =
            m_targetApoapsis - currentApoapsis;

        // Start vertical
        double pitch = M_PI / 2.0;

        // Proportional correction
        pitch -= m_kp * error;

        // Clamp between horizontal and vertical
        if (pitch < 0.0)
            pitch = 0.0;

        if (pitch > M_PI / 2.0)
            pitch = M_PI / 2.0;

        return pitch;
    }

}