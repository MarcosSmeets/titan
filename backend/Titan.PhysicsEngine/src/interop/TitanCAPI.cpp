#include "interop/TitanCAPI.h"
#include "simulation/LaunchVehicle3D.h"
#include "simulation/Stage.h"
#include "integrators/RK4Integrator.h"
#include "integrators/EulerIntegrator.h"
#include "integrators/RK45Integrator.h"
#include "guidance/OrbitalCircularizationGuidance.h"
#include "guidance/TargetApoapsisGuidance.h"
#include "orbital/OrbitalMechanics.h"
#include <memory>
#include <cmath>

struct TitanSim
{
    std::unique_ptr<titan::simulation::LaunchVehicle3D> vehicle;
    TitanSimConfig config;
    double time;
    int stageCount;
    int currentStage;
};

extern "C"
{

    TITAN_API TitanSim *titan_create_simulation(TitanSimConfig config)
    {
        std::unique_ptr<titan::integrators::Integrator> integrator;

        switch (config.integratorType)
        {
        case 1:
            integrator = std::make_unique<titan::integrators::EulerIntegrator>();
            break;
        case 2:
            integrator = std::make_unique<titan::integrators::RK45Integrator>(
                config.rk45_atol > 0 ? config.rk45_atol : 1e-8,
                config.rk45_rtol > 0 ? config.rk45_rtol : 1e-6,
                config.rk45_hmin > 0 ? config.rk45_hmin : 1e-6,
                config.rk45_hmax > 0 ? config.rk45_hmax : 10.0);
            break;
        default:
            integrator = std::make_unique<titan::integrators::RK4Integrator>();
            break;
        }

        std::unique_ptr<titan::guidance::Guidance> guidance;

        switch (config.guidanceType)
        {
        case 1:
            guidance = std::make_unique<titan::guidance::TargetApoapsisGuidance>(
                config.targetAltitude, config.earthRadius);
            break;
        default:
            guidance = std::make_unique<titan::guidance::OrbitalCircularizationGuidance>(
                config.targetAltitude, config.earthRadius);
            break;
        }

        auto sim = new TitanSim();
        sim->vehicle = std::make_unique<titan::simulation::LaunchVehicle3D>(
            config.earthRadius,
            config.mu,
            std::move(integrator),
            std::move(guidance));

        sim->vehicle->SetMaxG(config.maxG > 0 ? config.maxG : 4.0);
        sim->config = config;
        sim->time = 0.0;
        sim->stageCount = 0;
        sim->currentStage = 0;

        return sim;
    }

    TITAN_API void titan_add_stage(TitanSim *sim, TitanStageConfig stage)
    {
        if (!sim || !sim->vehicle)
            return;

        sim->vehicle->AddStage(titan::simulation::Stage(
            stage.dryMass,
            stage.fuelMass,
            stage.burnRate,
            stage.exhaustVelocity,
            stage.referenceArea,
            stage.dragCoefficient));

        sim->stageCount++;
    }

    static TitanTelemetry BuildTelemetry(TitanSim *sim)
    {
        TitanTelemetry tel{};

        auto pos = sim->vehicle->GetPosition();
        auto vel = sim->vehicle->GetVelocity();

        tel.time = sim->time;
        tel.state = {pos.x, pos.y, pos.z, vel.x, vel.y, vel.z};

        double r = pos.Magnitude();
        tel.altitude = r - sim->config.earthRadius;
        tel.velocity = vel.Magnitude();

        titan::math::Vector3 rVec(pos.x, pos.y, pos.z);
        titan::math::Vector3 vVec(vel.x, vel.y, vel.z);

        auto elements = titan::orbital::OrbitalMechanics::ComputeOrbitalElements(
            rVec, vVec, sim->config.mu);

        tel.apoapsis = elements.apoapsis - sim->config.earthRadius;
        tel.periapsis = elements.periapsis - sim->config.earthRadius;
        tel.eccentricity = elements.eccentricity;
        tel.inclination = elements.inclination;
        tel.raan = elements.raan;
        tel.argumentOfPeriapsis = elements.argumentOfPeriapsis;
        tel.trueAnomaly = elements.trueAnomaly;
        tel.semiMajorAxis = elements.semiMajorAxis;
        tel.stageIndex = sim->currentStage;

        tel.isComplete = (tel.periapsis > 180000.0 && elements.eccentricity < 0.02) ? 1 : 0;

        return tel;
    }

    TITAN_API TitanTelemetry titan_step(TitanSim *sim)
    {
        TitanTelemetry tel{};
        if (!sim || !sim->vehicle)
            return tel;

        double dt = sim->config.dt > 0 ? sim->config.dt : 0.05;
        sim->vehicle->Update(dt);
        sim->time += dt;

        return BuildTelemetry(sim);
    }

    TITAN_API TitanTelemetry titan_get_telemetry(TitanSim *sim)
    {
        TitanTelemetry tel{};
        if (!sim || !sim->vehicle)
            return tel;

        return BuildTelemetry(sim);
    }

    TITAN_API void titan_destroy(TitanSim *sim)
    {
        delete sim;
    }
}
