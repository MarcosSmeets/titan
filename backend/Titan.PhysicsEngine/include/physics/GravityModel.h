#pragma once
#include "core/Constants.h"

namespace titan::physics
{
    class GravityModel
    {
    public:
        static double ComputeGravity(double altitude);

    private:
        static constexpr double G = titan::core::constants::G;
        static constexpr double EarthMass = titan::core::constants::EarthMass;
        static constexpr double EarthRadius = titan::core::constants::EarthRadius;
    };
}
