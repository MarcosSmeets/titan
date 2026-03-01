#include "physics/GravityModel.h"
#include <cmath>

namespace titan::physics
{
    double GravityModel::ComputeGravity(double altitude)
    {
        /*
            Prevent negative altitude from breaking calculation.
            If altitude is negative, clamp to zero.
        */
        if (altitude < 0.0)
            altitude = 0.0;

        /*
            Distance from Earth's center.
        */
        double r = EarthRadius + altitude;

        /*
            Newtonian gravitational acceleration.
        */
        return (G * EarthMass) / (r * r);
    }
}