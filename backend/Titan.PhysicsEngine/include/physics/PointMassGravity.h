#pragma once
#include "physics/ForceModel.h"
#include "environment/CelestialBody.h"

namespace titan::physics
{
    class PointMassGravity : public ForceModel
    {
    public:
        explicit PointMassGravity(double mu, double bodyRadius = 6371000.0)
            : m_mu(mu), m_bodyRadius(bodyRadius) {}

        explicit PointMassGravity(const titan::environment::CelestialBody &body)
            : m_mu(body.mu), m_bodyRadius(body.radius) {}

        titan::math::Vector3 ComputeForce(
            const titan::simulation::SimState &state,
            double /*time*/) const override
        {
            double r = state.position.Magnitude();
            if (r < m_bodyRadius)
                return {};

            double factor = -m_mu * state.mass / (r * r * r);
            return state.position * factor;
        }

    private:
        double m_mu;
        double m_bodyRadius;
    };
}
