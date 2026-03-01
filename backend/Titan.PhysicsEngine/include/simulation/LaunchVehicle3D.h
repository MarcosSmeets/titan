#pragma once
#include <vector>
#include <memory>
#include "integrators/Integrator.h"
#include "simulation/Stage.h"
#include "guidance/Guidance.h"
#include "environment/Atmosphere.h"
#include "math/Vector3.h"

namespace titan::simulation
{
    class LaunchVehicle3D
    {
    public:
        LaunchVehicle3D(
            double earthRadius,
            double mu,
            std::unique_ptr<titan::integrators::Integrator> integrator,
            std::unique_ptr<titan::guidance::Guidance> guidance);

        void AddStage(const Stage &stage);
        void Update(double dt);

        titan::math::Vector3 GetPosition() const;
        titan::math::Vector3 GetVelocity() const;

        void SetMaxG(double maxG);

    private:
        double GetTotalMass() const;
        void SeparateStageIfNeeded();

        titan::integrators::State m_state;

        double m_earthRadius;
        double m_mu;
        double m_maxG = 4.0;

        std::vector<Stage> m_stages;

        std::unique_ptr<titan::integrators::Integrator> m_integrator;
        std::unique_ptr<titan::guidance::Guidance> m_guidance;

        titan::environment::Atmosphere m_atmosphere;
    };
}