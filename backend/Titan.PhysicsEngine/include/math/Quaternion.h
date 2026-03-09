#pragma once
#include <cmath>
#include "math/Vector3.h"

namespace titan::math
{
    struct Quaternion
    {
        double w, x, y, z;

        Quaternion() : w(1.0), x(0.0), y(0.0), z(0.0) {}
        Quaternion(double w_, double x_, double y_, double z_)
            : w(w_), x(x_), y(y_), z(z_) {}

        static Quaternion Identity() { return Quaternion(); }

        static Quaternion FromAxisAngle(const Vector3 &axis, double angle)
        {
            Vector3 n = axis.Normalized();
            double halfAngle = angle * 0.5;
            double s = std::sin(halfAngle);
            return Quaternion(std::cos(halfAngle), n.x * s, n.y * s, n.z * s);
        }

        static Quaternion FromEuler(double roll, double pitch, double yaw)
        {
            double cr = std::cos(roll * 0.5);
            double sr = std::sin(roll * 0.5);
            double cp = std::cos(pitch * 0.5);
            double sp = std::sin(pitch * 0.5);
            double cy = std::cos(yaw * 0.5);
            double sy = std::sin(yaw * 0.5);

            return Quaternion(
                cr * cp * cy + sr * sp * sy,
                sr * cp * cy - cr * sp * sy,
                cr * sp * cy + sr * cp * sy,
                cr * cp * sy - sr * sp * cy);
        }

        double Norm() const
        {
            return std::sqrt(w * w + x * x + y * y + z * z);
        }

        Quaternion Normalized() const
        {
            double n = Norm();
            if (n < 1e-15)
                return Identity();
            return Quaternion(w / n, x / n, y / n, z / n);
        }

        Quaternion Conjugate() const
        {
            return Quaternion(w, -x, -y, -z);
        }

        Quaternion Inverse() const
        {
            double n2 = w * w + x * x + y * y + z * z;
            if (n2 < 1e-15)
                return Identity();
            return Quaternion(w / n2, -x / n2, -y / n2, -z / n2);
        }

        Quaternion operator*(const Quaternion &q) const
        {
            return Quaternion(
                w * q.w - x * q.x - y * q.y - z * q.z,
                w * q.x + x * q.w + y * q.z - z * q.y,
                w * q.y - x * q.z + y * q.w + z * q.x,
                w * q.z + x * q.y - y * q.x + z * q.w);
        }

        Quaternion operator+(const Quaternion &q) const
        {
            return Quaternion(w + q.w, x + q.x, y + q.y, z + q.z);
        }

        Quaternion operator*(double s) const
        {
            return Quaternion(w * s, x * s, y * s, z * s);
        }

        friend Quaternion operator*(double s, const Quaternion &q)
        {
            return q * s;
        }

        Vector3 RotateVector(const Vector3 &v) const
        {
            Quaternion qv(0.0, v.x, v.y, v.z);
            Quaternion result = (*this) * qv * Conjugate();
            return Vector3(result.x, result.y, result.z);
        }

        Quaternion KinematicDerivative(const Vector3 &omega) const
        {
            Quaternion omegaQ(0.0, omega.x, omega.y, omega.z);
            return (*this) * omegaQ * 0.5;
        }

        Quaternion ErrorTo(const Quaternion &target) const
        {
            return Conjugate() * target;
        }

        void ToEuler(double &roll, double &pitch, double &yaw) const
        {
            // Roll (x-axis rotation)
            double sinr_cosp = 2.0 * (w * x + y * z);
            double cosr_cosp = 1.0 - 2.0 * (x * x + y * y);
            roll = std::atan2(sinr_cosp, cosr_cosp);

            // Pitch (y-axis rotation)
            double sinp = 2.0 * (w * y - z * x);
            if (std::abs(sinp) >= 1.0)
                pitch = std::copysign(M_PI / 2.0, sinp);
            else
                pitch = std::asin(sinp);

            // Yaw (z-axis rotation)
            double siny_cosp = 2.0 * (w * z + x * y);
            double cosy_cosp = 1.0 - 2.0 * (y * y + z * z);
            yaw = std::atan2(siny_cosp, cosy_cosp);
        }
    };
}
