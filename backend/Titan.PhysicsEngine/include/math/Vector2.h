#pragma once
#include <cmath>

namespace titan::math
{
    class Vector2
    {
    public:
        double x;
        double y;

        // Default constructor
        Vector2()
            : x(0.0), y(0.0) {}

        // Parameterized constructor
        Vector2(double xVal, double yVal)
            : x(xVal), y(yVal) {}

        // Magnitude (vector length)
        double Magnitude() const
        {
            return std::sqrt(x * x + y * y);
        }

        // Squared magnitude (avoids sqrt for performance)
        double MagnitudeSquared() const
        {
            return x * x + y * y;
        }

        // Normalized vector (unit vector)
        Vector2 Normalized() const
        {
            double mag = Magnitude();

            if (mag == 0.0)
                return Vector2(0.0, 0.0);

            return Vector2(x / mag, y / mag);
        }

        // Dot product
        double Dot(const Vector2 &other) const
        {
            return x * other.x + y * other.y;
        }

        // 2D Cross product (returns scalar in 2D)
        double Cross(const Vector2 &other) const
        {
            return x * other.y - y * other.x;
        }

        // Vector addition
        Vector2 operator+(const Vector2 &other) const
        {
            return Vector2(x + other.x, y + other.y);
        }

        // Vector subtraction
        Vector2 operator-(const Vector2 &other) const
        {
            return Vector2(x - other.x, y - other.y);
        }

        // Scalar multiplication
        Vector2 operator*(double scalar) const
        {
            return Vector2(x * scalar, y * scalar);
        }

        // Scalar division
        Vector2 operator/(double scalar) const
        {
            return Vector2(x / scalar, y / scalar);
        }

        // Compound addition
        Vector2 &operator+=(const Vector2 &other)
        {
            x += other.x;
            y += other.y;
            return *this;
        }

        // Compound subtraction
        Vector2 &operator-=(const Vector2 &other)
        {
            x -= other.x;
            y -= other.y;
            return *this;
        }

        // Compound scalar multiplication
        Vector2 &operator*=(double scalar)
        {
            x *= scalar;
            y *= scalar;
            return *this;
        }

        // Compound scalar division
        Vector2 &operator/=(double scalar)
        {
            x /= scalar;
            y /= scalar;
            return *this;
        }
    };
}