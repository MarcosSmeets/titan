#pragma once
#include <vector>
#include "Stage.h"
#include "math/Vector2.h"
#include "integrators/Integrator.h"
#include <memory>

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
        LaunchVehicle2D(double earthRadius, double mu, std::unique_ptr<titan::integration::Integrator> integrator);

        void AddStage(const Stage &stage);

        void Update(double dt);

        titan::math::Vector2 GetPosition() const;
        titan::math::Vector2 GetVelocity() const;

        double GetTotalMass() const;

    private:
        void SeparateStageIfNeeded();

        std::vector<Stage> m_stages;

        titan::integration::State m_state;
        std::unique_ptr<titan::integration::Integrator> m_integrator;

        double m_earthRadius;
        double m_mu; // gravitational parameter (GM)

        double m_pitchAngle; // radians
    };
}