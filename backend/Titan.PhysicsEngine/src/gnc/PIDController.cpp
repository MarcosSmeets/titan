#include "gnc/PIDController.h"
#include <algorithm>

namespace titan::gnc
{
    PIDAttitudeController::PIDAttitudeController(const PIDGains &gains)
        : m_initialized(false)
    {
        for (int i = 0; i < 3; i++)
        {
            m_gains[i] = gains;
            m_integral[i] = 0.0;
            m_prevError[i] = 0.0;
        }
    }

    PIDAttitudeController::PIDAttitudeController(
        const PIDGains &rollGains,
        const PIDGains &pitchGains,
        const PIDGains &yawGains)
        : m_initialized(false)
    {
        m_gains[0] = rollGains;
        m_gains[1] = pitchGains;
        m_gains[2] = yawGains;
        for (int i = 0; i < 3; i++)
        {
            m_integral[i] = 0.0;
            m_prevError[i] = 0.0;
        }
    }

    ActuatorCommands PIDAttitudeController::Compute(
        const titan::simulation::SimState &current,
        const titan::simulation::SimState &desired,
        double dt)
    {
        ActuatorCommands cmd;

        // Quaternion error: q_err = q_current^-1 * q_desired
        auto qErr = current.attitude.Conjugate() * desired.attitude;

        // Short-path rotation
        if (qErr.w < 0.0)
        {
            qErr.w = -qErr.w;
            qErr.x = -qErr.x;
            qErr.y = -qErr.y;
            qErr.z = -qErr.z;
        }

        // Small-angle body-frame errors
        double error[3] = {2.0 * qErr.x, 2.0 * qErr.y, 2.0 * qErr.z};

        double torque[3];
        for (int i = 0; i < 3; i++)
        {
            double e = error[i];

            // Integral with anti-windup
            m_integral[i] += e * dt;
            m_integral[i] = std::clamp(m_integral[i],
                                       -m_gains[i].maxIntegral,
                                       m_gains[i].maxIntegral);

            // Derivative
            double de = 0.0;
            if (m_initialized && dt > 1e-15)
                de = (e - m_prevError[i]) / dt;

            m_prevError[i] = e;

            torque[i] = m_gains[i].Kp * e +
                        m_gains[i].Ki * m_integral[i] +
                        m_gains[i].Kd * de;
        }

        m_initialized = true;

        cmd.torqueCommand = titan::math::Vector3(torque[0], torque[1], torque[2]);
        return cmd;
    }

    void PIDAttitudeController::Reset()
    {
        m_initialized = false;
        for (int i = 0; i < 3; i++)
        {
            m_integral[i] = 0.0;
            m_prevError[i] = 0.0;
        }
    }
}
