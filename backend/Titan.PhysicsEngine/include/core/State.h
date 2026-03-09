#pragma once
#include "math/Vector3.h"

namespace titan::core
{
    struct State
    {
        titan::math::Vector3 position;
        titan::math::Vector3 velocity;
        double mass;

        State() : mass(0.0) {}
        State(const titan::math::Vector3 &p, const titan::math::Vector3 &v, double m)
            : position(p), velocity(v), mass(m) {}
    };
}
