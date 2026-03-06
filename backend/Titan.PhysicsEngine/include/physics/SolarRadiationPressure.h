#pragma once
#include "physics/ForceModel.h"

namespace titan::physics
{
    class SolarRadiationPressure : public ForceModel
    {
    public:
        SolarRadiationPressure(
            double area,
            double reflectivityCoefficient,
            double bodyRadius)
            : m_area(area),
              m_Cr(reflectivityCoefficient),
              m_bodyRadius(bodyRadius) {}

        titan::math::Vector3 ComputeForce(
            const titan::simulation::SimState &state,
            double /*time*/) const override
        {
            double r = state.position.Magnitude();
            if (r < m_bodyRadius)
                return {};

            // Simplified: assume sun is at +X infinity
            // SRP acceleration = P_sr * Cr * A / m * sun_direction
            // P_sr ~= 4.56e-6 N/m^2 at 1 AU
            titan::math::Vector3 sunDir(-1.0, 0.0, 0.0);

            double force = m_Psr * m_Cr * m_area;
            return sunDir * force;
        }

    private:
        double m_area;
        double m_Cr;
        double m_bodyRadius;
        static constexpr double m_Psr = 4.56e-6; // Solar radiation pressure at 1 AU (N/m^2)
    };
}
