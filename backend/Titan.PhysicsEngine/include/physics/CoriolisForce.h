#pragma once
#include "physics/ForceModel.h"
#include "environment/CelestialBody.h"

namespace titan::physics
{
    /// Coriolis and centrifugal pseudo-forces for a rotating reference frame.
    /// Acceleration = -2(omega x v) - omega x (omega x r)
    class CoriolisForce : public ForceModel
    {
    public:
        explicit CoriolisForce(const titan::environment::CelestialBody &body)
            : m_omega(0.0, 0.0, body.rotationRate) {}

        explicit CoriolisForce(const titan::math::Vector3 &omega)
            : m_omega(omega) {}

        titan::math::Vector3 ComputeForce(
            const titan::simulation::SimState &state,
            double /*time*/) const override
        {
            if (state.mass <= 0.0)
                return {};

            // Coriolis: -2m(omega x v)
            auto coriolis = titan::math::Vector3::Cross(m_omega, state.velocity) * (-2.0);

            // Centrifugal: -m * omega x (omega x r)
            auto omegaCrossR = titan::math::Vector3::Cross(m_omega, state.position);
            auto centrifugal = -titan::math::Vector3::Cross(m_omega, omegaCrossR);

            return (coriolis + centrifugal) * state.mass;
        }

    private:
        titan::math::Vector3 m_omega; // rotation axis (rad/s), typically (0, 0, omega_z)
    };
}
