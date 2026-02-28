#pragma once
#include "Vector3.h"

namespace titan::core
{
    struct State
    {
        Vector3 position;
        Vector3 velocity;
        double mass;

        State() : mass(0.0) {}
        State(const Vector3 &p, const Vector3 &v, double m)
            : position(p), velocity(v), mass(m) {}
    };
}