#pragma once
#include "gnc/Controller.h"
#include "math/Quaternion.h"
#include <cmath>

namespace titan::gnc
{
    struct PIDGains
    {
        double Kp = 1.0;
        double Ki = 0.0;
        double Kd = 0.1;
        double maxIntegral = 10.0;
    };

    class PIDAttitudeController : public Controller
    {
    public:
        PIDAttitudeController(const PIDGains &gains);
        PIDAttitudeController(const PIDGains &rollGains,
                              const PIDGains &pitchGains,
                              const PIDGains &yawGains);

        ActuatorCommands Compute(
            const titan::simulation::SimState &current,
            const titan::simulation::SimState &desired,
            double dt) override;

        void Reset();

    private:
        PIDGains m_gains[3]; // roll, pitch, yaw
        double m_integral[3];
        double m_prevError[3];
        bool m_initialized;
    };
}
