#pragma once
#include <vector>
#include "Stage.h"
#include "math/Vector2.h"

namespace titan::simulation
{
    /*
        Represents a multi-stage launch vehicle in 2D space.

        This class is responsible for:
        - Managing stages
        - Computing total mass
        - Producing thrust from active stage
        - Performing stage separation
    */
    class LaunchVehicle2D
    {
    public:
        LaunchVehicle2D(double earthRadius, double mu);

        void AddStage(const Stage &stage);

        void Update(double dt);

        titan::math::Vector2 GetPosition() const;
        titan::math::Vector2 GetVelocity() const;

        double GetTotalMass() const;

    private:
        void SeparateStageIfNeeded();

        std::vector<Stage> m_stages;

        titan::math::Vector2 m_position;
        titan::math::Vector2 m_velocity;

        double m_earthRadius;
        double m_mu; // gravitational parameter (GM)

        double m_pitchAngle; // radians
    };
}