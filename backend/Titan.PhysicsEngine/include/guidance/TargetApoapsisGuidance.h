#pragma once
#include "Guidance.h"

namespace titan::guidance
{
    /*
        Closed-loop guidance that attempts to
        reach a target apoapsis altitude.

        Strategy:
        - Compute current orbital elements
        - Measure current apoapsis
        - Compare with target
        - Adjust pitch angle accordingly

        This is a simplified proportional controller.
    */
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

        // Proportional gain
        double m_kp;
    };
}