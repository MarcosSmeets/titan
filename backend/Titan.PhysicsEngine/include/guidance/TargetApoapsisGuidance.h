#pragma once
#include "Guidance.h"

namespace titan::guidance
{
    class TargetApoapsisGuidance : public Guidance
    {
    public:
        TargetApoapsisGuidance(double targetApoapsis,
                               double earthRadius);

        double ComputePitchAngle(
            const titan::integrators::State &state,
            double mu) override;

    private:
        double m_targetApoapsis;
        double m_earthRadius;
        double m_kp;
        double m_kd;
        double m_prevApoapsis;
        bool m_hasPrevApoapsis;
    };
}
