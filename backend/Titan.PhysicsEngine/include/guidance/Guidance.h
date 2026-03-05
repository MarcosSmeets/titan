#pragma once
#include <cmath>
#include "integrators/Integrator.h"
#include "math/Vector3.h"

namespace titan::guidance
{
    class Guidance
    {
    public:
        virtual ~Guidance() = default;

        virtual double ComputePitchAngle(
            const titan::integrators::State &state,
            double mu) = 0;

        virtual titan::math::Vector3 ComputeThrustDirection(
            const titan::integrators::State &state,
            double mu)
        {
            double pitch = ComputePitchAngle(state, mu);

            titan::math::Vector3 pos(state.x, state.y, state.z);
            double r = pos.Magnitude();

            if (r < 1.0)
                return titan::math::Vector3(0.0, 0.0, 1.0);

            // Local "up" direction (radial)
            titan::math::Vector3 up = pos.Normalized();

            // Velocity vector for computing "east" (prograde-ish)
            titan::math::Vector3 vel(state.vx, state.vy, state.vz);

            // Angular momentum direction: h = r x v
            titan::math::Vector3 hDir =
                titan::math::Vector3::Cross(pos, vel);

            double hMag = hDir.Magnitude();

            titan::math::Vector3 east;
            if (hMag > 1e-6)
            {
                // East = h x r (perpendicular to up, in orbital plane)
                east = titan::math::Vector3::Cross(hDir, pos).Normalized();
            }
            else
            {
                // Fallback for zero velocity: use arbitrary east
                // Choose perpendicular to up
                if (std::abs(up.x) < 0.9)
                    east = titan::math::Vector3::Cross(
                               up, titan::math::Vector3(1.0, 0.0, 0.0))
                               .Normalized();
                else
                    east = titan::math::Vector3::Cross(
                               up, titan::math::Vector3(0.0, 1.0, 0.0))
                               .Normalized();
            }

            return up * std::sin(pitch) + east * std::cos(pitch);
        }
    };
}
