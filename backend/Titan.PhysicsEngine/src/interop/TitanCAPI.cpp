#include "interop/TitanCAPI.h"
#include "simulation/Simulation.h"
#include "simulation/SimState.h"
#include "simulation/Stage.h"
#include "vehicle/Vehicle.h"
#include "environment/CelestialBody.h"
#include "environment/Atmosphere.h"
#include "environment/USStandardAtmosphere.h"
#include "physics/PointMassGravity.h"
#include "physics/J2Gravity.h"
#include "physics/AtmosphericDrag.h"
#include "integrators/RK4Integrator.h"
#include "integrators/EulerIntegrator.h"
#include "integrators/RK45Integrator.h"
#include "guidance/OrbitalCircularizationGuidance.h"
#include "guidance/TargetApoapsisGuidance.h"
#include "orbital/OrbitalMechanics.h"
#include "events/EventBus.h"
#include "telemetry/TelemetryBus.h"
#include "gnc/PIDController.h"
#include "gnc/PointingMode.h"
#include "export/DataExporter.h"
#include <memory>
#include <cmath>
#include <cstring>
#include <string>

struct TitanSim
{
    std::unique_ptr<titan::simulation::Simulation> simulation;
    std::unique_ptr<titan::vehicle::Vehicle> vehicleRef;
    TitanSimConfig config;
    std::shared_ptr<titan::events::EventBus> eventBus;
    std::shared_ptr<titan::telemetry::TelemetryBus> telemetryBus;
    std::unique_ptr<titan::environment::Atmosphere> atmosphere;

    TitanEventCallback eventCallback;
    void *eventUserData;

    TitanTelemetryCallback telemetryCallback;
    void *telemetryUserData;

    std::string lastError;
};

extern "C"
{

    TITAN_API TitanSim *titan_create_simulation(TitanSimConfig config)
    {
        // Build integrator
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

        // Build guidance
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

        // Build celestial body
        auto body = titan::environment::CelestialBody::Earth();
        body.mu = config.mu > 0 ? config.mu : body.mu;
        body.radius = config.earthRadius > 0 ? config.earthRadius : body.radius;

        auto sim = new TitanSim();
        sim->config = config;
        sim->eventCallback = nullptr;
        sim->eventUserData = nullptr;
        sim->telemetryCallback = nullptr;
        sim->telemetryUserData = nullptr;

        sim->eventBus = std::make_shared<titan::events::EventBus>();
        sim->telemetryBus = std::make_shared<titan::telemetry::TelemetryBus>();

        sim->simulation = std::make_unique<titan::simulation::Simulation>(
            body,
            std::move(integrator),
            std::move(guidance));

        sim->simulation->SetEventBus(sim->eventBus);
        sim->simulation->SetTelemetryBus(sim->telemetryBus);
        sim->simulation->SetMaxG(config.maxG > 0 ? config.maxG : 4.0);

        // Configure atmosphere
        if (config.useUSStandardAtmosphere)
        {
            sim->simulation->SetAtmosphere(
                std::make_unique<titan::environment::USStandardAtmosphere>());
        }
        else
        {
            sim->simulation->SetAtmosphere(
                std::make_unique<titan::environment::Atmosphere>());
        }

        // Add gravity force model
        if (config.useJ2)
        {
            sim->simulation->AddForce(
                std::make_unique<titan::physics::J2Gravity>(body));
        }
        else
        {
            sim->simulation->AddForce(
                std::make_unique<titan::physics::PointMassGravity>(body));
        }

        // Configure completion criteria
        titan::simulation::CompletionCriteria criteria;
        criteria.minPeriapsis = config.completionMinPeriapsis > 0
                                    ? config.completionMinPeriapsis
                                    : 180000.0;
        criteria.maxEccentricity = config.completionMaxEccentricity > 0
                                       ? config.completionMaxEccentricity
                                       : 0.02;
        criteria.enabled = true;
        sim->simulation->SetCompletionCriteria(criteria);

        // Set initial state with Earth rotation if enabled
        if (config.useEarthRotation)
        {
            titan::simulation::SimState initState;
            initState.position = titan::math::Vector3(body.radius + 1.0, 0.0, 0.0);
            double surfaceVelocity = body.rotationRate * body.radius;
            initState.velocity = titan::math::Vector3(0.0, surfaceVelocity, 0.0);
            initState.time = 0.0;
            sim->simulation->SetInitialState(initState);
        }

        return sim;
    }

    TITAN_API void titan_add_stage(TitanSim *sim, TitanStageConfig stage)
    {
        if (!sim || !sim->simulation)
        {
            if (sim)
                sim->lastError = "Simulation not initialized";
            return;
        }

        if (!sim->vehicleRef)
            sim->vehicleRef = std::make_unique<titan::vehicle::Vehicle>();

        sim->vehicleRef->AddStage(titan::simulation::Stage(
            stage.dryMass,
            stage.fuelMass,
            stage.burnRate,
            stage.exhaustVelocity,
            stage.referenceArea,
            stage.dragCoefficient));

        sim->simulation->SetVehicle(std::move(sim->vehicleRef));
        sim->vehicleRef = nullptr;

        auto body = sim->simulation->GetBody();

        if (sim->config.useMachCd)
        {
            auto atmosphere = sim->simulation->GetAtmosphere();
            if (atmosphere)
            {
                sim->simulation->AddForce(
                    std::make_unique<titan::physics::AtmosphericDrag>(
                        stage.referenceArea,
                        titan::physics::AtmosphericDrag::DefaultMachCd(stage.dragCoefficient),
                        *atmosphere,
                        body.radius));
            }
        }
    }

    static TitanTelemetry BuildTelemetry(TitanSim *sim)
    {
        TitanTelemetry tel{};

        if (!sim || !sim->simulation)
            return tel;

        const auto &state = sim->simulation->GetState();
        auto pos = state.position;
        auto vel = state.velocity;
        auto body = sim->simulation->GetBody();

        tel.time = state.time;
        tel.state = {pos.x, pos.y, pos.z, vel.x, vel.y, vel.z};

        double r = pos.Magnitude();
        tel.altitude = r - body.radius;
        tel.velocity = vel.Magnitude();

        auto elements = titan::orbital::OrbitalMechanics::ComputeOrbitalElements(
            pos, vel, body.mu);

        tel.apoapsis = elements.apoapsis - body.radius;
        tel.periapsis = elements.periapsis - body.radius;
        tel.eccentricity = elements.eccentricity;
        tel.inclination = elements.inclination;
        tel.raan = elements.raan;
        tel.argumentOfPeriapsis = elements.argumentOfPeriapsis;
        tel.trueAnomaly = elements.trueAnomaly;
        tel.semiMajorAxis = elements.semiMajorAxis;

        const auto *vehicle = sim->simulation->GetVehicle();
        tel.stageIndex = vehicle ? static_cast<int>(vehicle->GetCurrentStageIndex()) : 0;

        auto simStatus = sim->simulation->GetStatus();
        tel.isComplete = (simStatus == titan::simulation::SimStatus::Completed) ? 1 : 0;
        tel.status = static_cast<int>(simStatus);

        // 6DOF attitude data
        tel.attitude_w = state.attitude.w;
        tel.attitude_x = state.attitude.x;
        tel.attitude_y = state.attitude.y;
        tel.attitude_z = state.attitude.z;

        tel.angularVelocity_x = state.angularVelocity.x;
        tel.angularVelocity_y = state.angularVelocity.y;
        tel.angularVelocity_z = state.angularVelocity.z;

        tel.wheelCount = 0;
        for (int i = 0; i < 4; i++)
        {
            tel.wheelSpeed[i] = 0.0;
            tel.wheelMomentum[i] = 0.0;
        }

        return tel;
    }

    TITAN_API TitanTelemetry titan_step(TitanSim *sim)
    {
        TitanTelemetry tel{};
        if (!sim || !sim->simulation)
        {
            tel.status = 3;
            return tel;
        }

        double dt = sim->config.dt > 0 ? sim->config.dt : 0.05;
        auto result = sim->simulation->Step(dt);

        // Process event callbacks
        if (sim->eventCallback && sim->eventBus)
        {
            const auto &log = sim->eventBus->GetEventLog();
            for (const auto &event : log)
            {
                TitanEvent te{};
                te.time = event.time;
                te.type = static_cast<int>(event.type);
                std::strncpy(te.description, event.description.c_str(),
                             sizeof(te.description) - 1);
                te.description[sizeof(te.description) - 1] = '\0';
                sim->eventCallback(te, sim->eventUserData);
            }
            sim->eventBus->ClearLog();
        }

        return BuildTelemetry(sim);
    }

    TITAN_API TitanTelemetry titan_get_telemetry(TitanSim *sim)
    {
        TitanTelemetry tel{};
        if (!sim || !sim->simulation)
        {
            tel.status = 3;
            return tel;
        }

        return BuildTelemetry(sim);
    }

    TITAN_API void titan_destroy(TitanSim *sim)
    {
        delete sim;
    }

    TITAN_API void titan_set_event_callback(TitanSim *sim,
                                            TitanEventCallback cb,
                                            void *userData)
    {
        if (!sim)
            return;
        sim->eventCallback = cb;
        sim->eventUserData = userData;
    }

    TITAN_API void titan_set_telemetry_callback(TitanSim *sim,
                                                TitanTelemetryCallback cb,
                                                void *userData)
    {
        if (!sim)
            return;
        sim->telemetryCallback = cb;
        sim->telemetryUserData = userData;
    }

    TITAN_API int titan_get_last_error(TitanSim *sim, char *buffer, int bufferSize)
    {
        if (!sim || !buffer || bufferSize <= 0)
            return -1;

        if (sim->lastError.empty())
        {
            buffer[0] = '\0';
            return 0;
        }

        std::strncpy(buffer, sim->lastError.c_str(), bufferSize - 1);
        buffer[bufferSize - 1] = '\0';
        return static_cast<int>(sim->lastError.size());
    }

    TITAN_API void titan_set_initial_attitude(TitanSim *sim,
                                              double w, double x, double y, double z)
    {
        if (!sim || !sim->simulation)
            return;

        auto state = sim->simulation->GetState();
        titan::simulation::SimState newState = state;
        newState.attitude = titan::math::Quaternion(w, x, y, z).Normalized();
        sim->simulation->SetInitialState(newState);
    }

    TITAN_API void titan_add_reaction_wheel(TitanSim *sim,
                                             double ax, double ay, double az,
                                             double maxTorque, double maxMomentum,
                                             double wheelInertia)
    {
        if (!sim || !sim->simulation)
            return;

        sim->simulation->AddReactionWheel(
            titan::math::Vector3(ax, ay, az),
            maxTorque, maxMomentum, wheelInertia);
    }

    TITAN_API void titan_set_pointing_mode(TitanSim *sim, int mode)
    {
        if (!sim || !sim->simulation)
            return;

        switch (mode)
        {
        case 1:
            sim->simulation->SetPointingMode(
                std::make_unique<titan::gnc::InertialHold>());
            break;
        case 2:
            sim->simulation->SetPointingMode(
                std::make_unique<titan::gnc::NadirPointing>());
            break;
        case 3:
            sim->simulation->SetPointingMode(
                std::make_unique<titan::gnc::SunPointing>());
            break;
        default:
            sim->simulation->SetPointingMode(nullptr);
            break;
        }

        // Auto-create a PID controller if none exists
        if (mode > 0)
        {
            titan::gnc::PIDGains gains;
            gains.Kp = 5.0;
            gains.Ki = 0.1;
            gains.Kd = 2.0;
            gains.maxIntegral = 10.0;
            sim->simulation->SetController(
                std::make_unique<titan::gnc::PIDAttitudeController>(gains));
        }
    }

    TITAN_API int titan_export_csv(TitanSim *sim, const char *filename)
    {
        if (!sim || !sim->telemetryBus || !filename)
            return 0;

        return titan::data::DataExporter::ExportCSV(*sim->telemetryBus, filename) ? 1 : 0;
    }

    TITAN_API int titan_export_json(TitanSim *sim, const char *filename)
    {
        if (!sim || !sim->telemetryBus || !filename)
            return 0;

        return titan::data::DataExporter::ExportJSON(*sim->telemetryBus, filename) ? 1 : 0;
    }
}
