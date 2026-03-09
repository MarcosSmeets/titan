#pragma once
#include "physics/ForceModel.h"
#include "environment/CelestialBody.h"

namespace titan::physics
{
    class J2Gravity : public ForceModel
    {
    public:
        J2Gravity(double mu, double bodyRadius, double J2)
            : m_mu(mu), m_bodyRadius(bodyRadius), m_J2(J2) {}

        explicit J2Gravity(const titan::environment::CelestialBody &body)
            : m_mu(body.mu), m_bodyRadius(body.radius), m_J2(body.J2) {}

        titan::math::Vector3 ComputeForce(
            const titan::simulation::SimState &state,
            double /*time*/) const override
        {
            double r = state.position.Magnitude();
            if (r < 1.0)
                return {};

            double x = state.position.x;
            double y = state.position.y;
            double z = state.position.z;
            double mass = state.mass;

            // Point mass gravity
            double r3 = r * r * r;
            double pmFactor = -m_mu * mass / r3;
            titan::math::Vector3 pointMass = state.position * (pmFactor / mass);

            // J2 perturbation acceleration
            double Re2 = m_bodyRadius * m_bodyRadius;
            double r2 = r * r;
            double r5 = r2 * r3;
            double z2_r2 = (z * z) / r2;

            double j2Coeff = 1.5 * m_J2 * m_mu * Re2 / r5;

            double ax_j2 = j2Coeff * x * (5.0 * z2_r2 - 1.0);
            double ay_j2 = j2Coeff * y * (5.0 * z2_r2 - 1.0);
            double az_j2 = j2Coeff * z * (5.0 * z2_r2 - 3.0);

            titan::math::Vector3 totalAccel = pointMass +
                                              titan::math::Vector3(ax_j2, ay_j2, az_j2);

            return totalAccel * mass;
        }

    private:
        double m_mu;
        double m_bodyRadius;
        double m_J2;
    };
}
