#pragma once
#include "physics/ForceModel.h"
#include "environment/CelestialBody.h"

namespace titan::physics
{
    class PointMassGravity : public ForceModel
    {
    public:
        explicit PointMassGravity(double mu)
            : m_mu(mu) {}

        explicit PointMassGravity(const titan::environment::CelestialBody &body)
            : m_mu(body.mu) {}

        titan::math::Vector3 ComputeForce(
            const titan::simulation::SimState &state,
            double /*time*/) const override
        {
            double r = state.position.Magnitude();
            if (r < 1.0)
                return {};

            double factor = -m_mu * state.mass / (r * r * r);
            return state.position * factor;
        }

    private:
        double m_mu;
    };
}
