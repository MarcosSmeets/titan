#pragma once

#include <vector>
#include <memory>

#include "Stage.h"
#include "math/Vector2.h"
#include "integrators/Integrator.h"
#include "guidance/Guidance.h"

namespace titan::simulation
{
    class LaunchVehicle2D
    {
    public:
        LaunchVehicle2D(
            double earthRadius,
            double mu,
            std::unique_ptr<titan::integrators::Integrator> integrator,
            std::unique_ptr<titan::guidance::Guidance> guidance);

        void AddStage(const Stage &stage);
        void Update(double dt);

        titan::math::Vector2 GetPosition() const;
        titan::math::Vector2 GetVelocity() const;

        double GetTotalMass() const;

    private:
        void SeparateStageIfNeeded();

        std::vector<Stage> m_stages;
        titan::integrators::State m_state;

        std::unique_ptr<titan::integrators::Integrator> m_integrator;
        std::unique_ptr<titan::guidance::Guidance> m_guidance;

        double m_earthRadius;
        double m_mu;
    };
}