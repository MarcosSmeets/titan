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
          m_kp(5e-7),
          m_kd(2e-4),
          m_prevApoapsis(0.0),
          m_hasPrevApoapsis(false)
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

        // Derivative term: rate of change of apoapsis
        double dApoapsis = 0.0;
        if (m_hasPrevApoapsis)
            dApoapsis = currentApoapsis - m_prevApoapsis;

        m_prevApoapsis = currentApoapsis;
        m_hasPrevApoapsis = true;

        // PD controller: pitch down as apoapsis approaches target,
        // with damping to prevent overshoot
        double pitch = M_PI / 2.0;
        pitch -= m_kp * error + m_kd * dApoapsis;

        return std::clamp(pitch, 0.0, M_PI / 2.0);
    }

}
