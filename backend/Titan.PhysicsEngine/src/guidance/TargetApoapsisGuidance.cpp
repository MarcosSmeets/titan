#include "guidance/TargetApoapsisGuidance.h"
#include "orbital/OrbitalMechanics.h"
#include "math/Vector3.h"
#include <cmath>

namespace titan::guidance
{

    TargetApoapsisGuidance::TargetApoapsisGuidance(
        double targetApoapsis,
        double earthRadius)
        : m_targetApoapsis(targetApoapsis),
          m_earthRadius(earthRadius),
          m_kp(5e-7)
    {
    }

    double TargetApoapsisGuidance::ComputePitchAngle(
        const titan::integrators::State &state,
        double mu)
    {
        titan::math::Vector3 r(state.x, state.y, state.z);
        titan::math::Vector3 v(state.vx, state.vy, state.vz);

        auto elements =
            titan::orbital::OrbitalMechanics::ComputeOrbitalElements(
                r, v, mu);

        double currentApoapsis =
            elements.apoapsis - m_earthRadius;

        double error =
            m_targetApoapsis - currentApoapsis;

        double pitch = M_PI / 2.0;

        pitch -= m_kp * error;

        if (pitch < 0.0)
            pitch = 0.0;

        if (pitch > M_PI / 2.0)
            pitch = M_PI / 2.0;

        return pitch;
    }

}
