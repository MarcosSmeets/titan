#pragma once
#include "math/Vector2.h"
#include "OrbitalElements.h"

namespace titan::orbital
{
    class OrbitalMechanics
    {
    public:
        static OrbitalElements ComputeOrbitalElements(
            const titan::math::Vector2 &position,
            const titan::math::Vector2 &velocity,
            double mu);
    };
}