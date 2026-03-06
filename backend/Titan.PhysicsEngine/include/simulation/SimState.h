#pragma once
#include "math/Vector3.h"

namespace titan::simulation
{
    struct SimState
    {
        titan::math::Vector3 position;
        titan::math::Vector3 velocity;
        double mass;
        double time;

        SimState()
            : mass(0.0), time(0.0) {}

        SimState(const titan::math::Vector3 &p, const titan::math::Vector3 &v,
                 double m, double t = 0.0)
            : position(p), velocity(v), mass(m), time(t) {}

        double Altitude(double bodyRadius) const
        {
            return position.Magnitude() - bodyRadius;
        }

        double Speed() const
        {
            return velocity.Magnitude();
        }
    };
}
