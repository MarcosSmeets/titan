#pragma once
#include "math/Quaternion.h"
#include "math/Vector3.h"
#include "simulation/SimState.h"
#include <cmath>

namespace titan::gnc
{
    class PointingMode
    {
    public:
        virtual ~PointingMode() = default;

        virtual titan::math::Quaternion ComputeDesiredAttitude(
            const titan::simulation::SimState &state, double time) const = 0;
    };

    class InertialHold : public PointingMode
    {
    public:
        InertialHold(const titan::math::Quaternion &target = titan::math::Quaternion::Identity())
            : m_target(target) {}

        titan::math::Quaternion ComputeDesiredAttitude(
            const titan::simulation::SimState & /*state*/, double /*time*/) const override
        {
            return m_target;
        }

    private:
        titan::math::Quaternion m_target;
    };

    class NadirPointing : public PointingMode
    {
    public:
        titan::math::Quaternion ComputeDesiredAttitude(
            const titan::simulation::SimState &state, double /*time*/) const override
        {
            // Body -Z toward planet center
            titan::math::Vector3 nadir = (state.position * -1.0).Normalized();
            titan::math::Vector3 vel = state.velocity.Normalized();

            // Orbit normal
            titan::math::Vector3 normal = titan::math::Vector3::Cross(state.position, state.velocity).Normalized();

            // Along-track direction
            titan::math::Vector3 along = titan::math::Vector3::Cross(normal, nadir).Normalized();

            // Build rotation matrix columns: along=X, normal=Y, nadir=-Z -> -nadir=Z body frame
            // We want body-Z = -nadir (pointing away from planet), body-X = along
            // So we need rotation from identity frame to [along, normal, -nadir]
            // Using quaternion from rotation matrix:
            titan::math::Vector3 bx = along;
            titan::math::Vector3 by = normal;
            titan::math::Vector3 bz = nadir * -1.0; // body Z away from nadir

            // Rotation matrix to quaternion (body -Z toward planet = nadir)
            // Actually: body -Z = nadir means body Z = -nadir
            double trace = bx.x + by.y + bz.z;

            double w, x, y, z;
            if (trace > 0.0)
            {
                double s = 0.5 / std::sqrt(trace + 1.0);
                w = 0.25 / s;
                x = (by.z - bz.y) * s;
                y = (bz.x - bx.z) * s;
                z = (bx.y - by.x) * s;
            }
            else if (bx.x > by.y && bx.x > bz.z)
            {
                double s = 2.0 * std::sqrt(1.0 + bx.x - by.y - bz.z);
                w = (by.z - bz.y) / s;
                x = 0.25 * s;
                y = (by.x + bx.y) / s;
                z = (bz.x + bx.z) / s;
            }
            else if (by.y > bz.z)
            {
                double s = 2.0 * std::sqrt(1.0 + by.y - bx.x - bz.z);
                w = (bz.x - bx.z) / s;
                x = (by.x + bx.y) / s;
                y = 0.25 * s;
                z = (bz.y + by.z) / s;
            }
            else
            {
                double s = 2.0 * std::sqrt(1.0 + bz.z - bx.x - by.y);
                w = (bx.y - by.x) / s;
                x = (bz.x + bx.z) / s;
                y = (bz.y + by.z) / s;
                z = 0.25 * s;
            }

            return titan::math::Quaternion(w, x, y, z).Normalized();
        }
    };

    class SunPointing : public PointingMode
    {
    public:
        SunPointing(const titan::math::Vector3 &sunDir = titan::math::Vector3(1.0, 0.0, 0.0))
            : m_sunDir(sunDir.Normalized()) {}

        titan::math::Quaternion ComputeDesiredAttitude(
            const titan::simulation::SimState & /*state*/, double /*time*/) const override
        {
            // Body +X axis toward sun direction
            titan::math::Vector3 bx = m_sunDir;

            // Choose an up reference
            titan::math::Vector3 up(0.0, 0.0, 1.0);
            if (std::abs(titan::math::Vector3::Dot(bx, up)) > 0.99)
                up = titan::math::Vector3(0.0, 1.0, 0.0);

            titan::math::Vector3 by = titan::math::Vector3::Cross(up, bx).Normalized();
            titan::math::Vector3 bz = titan::math::Vector3::Cross(bx, by).Normalized();

            double trace = bx.x + by.y + bz.z;
            double w, x, y, z;
            if (trace > 0.0)
            {
                double s = 0.5 / std::sqrt(trace + 1.0);
                w = 0.25 / s;
                x = (by.z - bz.y) * s;
                y = (bz.x - bx.z) * s;
                z = (bx.y - by.x) * s;
            }
            else if (bx.x > by.y && bx.x > bz.z)
            {
                double s = 2.0 * std::sqrt(1.0 + bx.x - by.y - bz.z);
                w = (by.z - bz.y) / s;
                x = 0.25 * s;
                y = (by.x + bx.y) / s;
                z = (bz.x + bx.z) / s;
            }
            else if (by.y > bz.z)
            {
                double s = 2.0 * std::sqrt(1.0 + by.y - bx.x - bz.z);
                w = (bz.x - bx.z) / s;
                x = (by.x + bx.y) / s;
                y = 0.25 * s;
                z = (bz.y + by.z) / s;
            }
            else
            {
                double s = 2.0 * std::sqrt(1.0 + bz.z - bx.x - by.y);
                w = (bx.y - by.x) / s;
                x = (bz.x + bx.z) / s;
                y = (bz.y + by.z) / s;
                z = 0.25 * s;
            }

            return titan::math::Quaternion(w, x, y, z).Normalized();
        }

    private:
        titan::math::Vector3 m_sunDir;
    };
}
