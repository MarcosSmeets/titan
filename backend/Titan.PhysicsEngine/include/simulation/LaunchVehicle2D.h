#pragma once
#include <vector>
#include <memory>
#include "integrators/Integrator.h"
#include "simulation/Stage.h"
#include "guidance/Guidance.h"
#include "environment/Atmosphere.h"
#include "math/Vector2.h"

namespace titan::simulation
{
    class LaunchVehicle2D
    {
    public:
        LaunchVehicle2D(
            double earthRadius,
            double mu,
            std::unique_ptr<titan::integrators::Integrator> integrator,
            std::unique_ptr<titan::guidance::Guidance> guidance,
            double gLimit = 4.0); // maximum allowed acceleration in g

        void AddStage(const Stage &stage);

        void Update(double dt);

        titan::math::Vector2 GetPosition() const;
        titan::math::Vector2 GetVelocity() const;

    private:
        double GetTotalMass() const;
        void SeparateStageIfNeeded();

        titan::integrators::State m_state;

        double m_earthRadius;
        double m_mu;
        double m_gLimit; // g limit

        std::vector<Stage> m_stages;

        std::unique_ptr<titan::integrators::Integrator> m_integrator;
        std::unique_ptr<titan::guidance::Guidance> m_guidance;

        titan::environment::Atmosphere m_atmosphere;
    };
}