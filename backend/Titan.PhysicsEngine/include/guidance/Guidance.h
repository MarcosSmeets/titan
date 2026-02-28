#pragma once
#include "integrators/Integrator.h"

namespace titan::guidance
{
    /*
        Abstract guidance interface.

        Guidance is responsible for computing
        the desired pitch angle (radians)
        based on current vehicle state.

        This represents the "brain" of the rocket.
    */
    class Guidance
    {
    public:
        virtual ~Guidance() = default;

        virtual double ComputePitchAngle(
            const titan::integrators::State &state,
            double mu) = 0;
    };
}