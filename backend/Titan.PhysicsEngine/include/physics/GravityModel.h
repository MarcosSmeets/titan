#pragma once
#include "core/Vector3.h"
#include "core/Constants.h"

namespace titan::physics
{
    class GravityModel
    {
    public:
        static titan::core::Vector3 ComputeGravity(
            const titan::core::Vector3 &position,
            double mass);
    };
}