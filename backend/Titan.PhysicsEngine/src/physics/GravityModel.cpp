#include "physics/GravityModel.h"
#include <cmath>

using namespace titan::core;
using namespace titan::core::constants;

namespace titan::physics
{
    Vector3 GravityModel::ComputeGravity(
        const Vector3 &position,
        double mass)
    {
        double r = position.Magnitude();

        if (r == 0.0)
            return Vector3();

        double forceMagnitude = (G * EarthMass * mass) / (r * r);

        Vector3 direction = position * (-1.0 / r);

        return direction * forceMagnitude;
    }
}