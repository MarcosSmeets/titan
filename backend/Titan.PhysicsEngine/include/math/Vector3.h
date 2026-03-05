#pragma once
#include <cmath>

namespace titan::math
{
    struct Vector3
    {
        double x;
        double y;
        double z;

        Vector3() : x(0.0), y(0.0), z(0.0) {}
        Vector3(double x_, double y_, double z_)
            : x(x_), y(y_), z(z_) {}

        double Magnitude() const
        {
            return std::sqrt(x * x + y * y + z * z);
        }

        double MagnitudeSquared() const
        {
            return x * x + y * y + z * z;
        }

        Vector3 Normalized() const
        {
            double mag = Magnitude();
            if (mag == 0.0)
                return Vector3();

            return Vector3(x / mag, y / mag, z / mag);
        }

        static double Dot(const Vector3 &a, const Vector3 &b)
        {
            return a.x * b.x + a.y * b.y + a.z * b.z;
        }

        static Vector3 Cross(const Vector3 &a, const Vector3 &b)
        {
            return Vector3(
                a.y * b.z - a.z * b.y,
                a.z * b.x - a.x * b.z,
                a.x * b.y - a.y * b.x);
        }

        Vector3 operator+(const Vector3 &other) const
        {
            return Vector3(x + other.x, y + other.y, z + other.z);
        }

        Vector3 operator-(const Vector3 &other) const
        {
            return Vector3(x - other.x, y - other.y, z - other.z);
        }

        Vector3 operator-() const
        {
            return Vector3(-x, -y, -z);
        }

        Vector3 operator*(double scalar) const
        {
            return Vector3(x * scalar, y * scalar, z * scalar);
        }

        Vector3 operator/(double scalar) const
        {
            return Vector3(x / scalar, y / scalar, z / scalar);
        }

        Vector3 &operator+=(const Vector3 &other)
        {
            x += other.x;
            y += other.y;
            z += other.z;
            return *this;
        }

        Vector3 &operator-=(const Vector3 &other)
        {
            x -= other.x;
            y -= other.y;
            z -= other.z;
            return *this;
        }

        Vector3 &operator*=(double scalar)
        {
            x *= scalar;
            y *= scalar;
            z *= scalar;
            return *this;
        }

        Vector3 &operator/=(double scalar)
        {
            x /= scalar;
            y /= scalar;
            z /= scalar;
            return *this;
        }

        friend Vector3 operator*(double scalar, const Vector3 &v)
        {
            return Vector3(scalar * v.x, scalar * v.y, scalar * v.z);
        }
    };
}
