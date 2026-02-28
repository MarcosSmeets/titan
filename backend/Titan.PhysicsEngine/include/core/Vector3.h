#pragma once
#include <cmath>

namespace titan::core
{
    struct Vector3
    {
        double x;
        double y;
        double z;

        Vector3() : x(0), y(0), z(0) {}
        Vector3(double x, double y, double z) : x(x), y(y), z(z) {}

        double Magnitude() const
        {
            return std::sqrt(x * x + y * y + z * z);
        }

        Vector3 operator+(const Vector3 &other) const
        {
            return {x + other.x, y + other.y, z + other.z};
        }

        Vector3 operator*(double scalar) const
        {
            return {x * scalar, y * scalar, z * scalar};
        }
    };
}