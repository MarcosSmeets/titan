#pragma once
#include "math/Vector2.h"
#include "math/Vector3.h"
#include "OrbitalElements.h"

namespace titan::orbital
{
    class OrbitalMechanics
    {
    public:
        // 2D overload (backward compatible)
        static OrbitalElements ComputeOrbitalElements(
            const titan::math::Vector2 &position,
            const titan::math::Vector2 &velocity,
            double mu);

        // 3D overload with full classical elements
        static OrbitalElements ComputeOrbitalElements(
            const titan::math::Vector3 &position,
            const titan::math::Vector3 &velocity,
            double mu);
    };
}
