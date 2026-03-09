#pragma once
#include <vector>
#include <memory>
#include "simulation/SimState.h"
#include "physics/ForceModel.h"
#include "integrators/Integrator.h"
#include "vehicle/Vehicle.h"
#include "events/EventBus.h"
#include "events/FlightSequencer.h"
#include "telemetry/TelemetryBus.h"
#include "guidance/Guidance.h"
#include "environment/CelestialBody.h"
#include "environment/Atmosphere.h"
#include "orbital/OrbitalMechanics.h"
#include "gnc/Controller.h"
#include "gnc/Navigator.h"
#include "gnc/Actuator.h"
#include "gnc/PointingMode.h"
#include "math/Quaternion.h"

namespace titan::simulation
{
    enum class SimStatus
    {
        Running,
        Completed,
        Impact,
        Error
    };

    struct StepResult
    {
        SimStatus status;
        double dt_actual;
        SimState state;
    };

    struct CompletionCriteria
    {
        double minPeriapsis;    // meters altitude
        double maxEccentricity;
        bool enabled;

        CompletionCriteria()
            : minPeriapsis(180000.0), maxEccentricity(0.02), enabled(true) {}
    };

    class Simulation
    {
    public:
        Simulation(
            const titan::environment::CelestialBody &body,
            std::unique_ptr<titan::integrators::Integrator> integrator,
            std::unique_ptr<titan::guidance::Guidance> guidance);

        void AddForce(std::unique_ptr<titan::physics::ForceModel> force);
        void SetVehicle(std::unique_ptr<titan::vehicle::Vehicle> vehicle);
        void SetEventBus(std::shared_ptr<titan::events::EventBus> bus);
        void SetTelemetryBus(std::shared_ptr<titan::telemetry::TelemetryBus> telemetry);
        void SetFlightSequencer(std::unique_ptr<titan::events::FlightSequencer> sequencer);
        void SetAtmosphere(std::unique_ptr<titan::environment::Atmosphere> atmosphere);
        void SetCompletionCriteria(const CompletionCriteria &criteria);
        void SetMaxG(double maxG);
        void SetInitialState(const SimState &state);

        void SetController(std::unique_ptr<titan::gnc::Controller> controller);
        void SetNavigator(std::unique_ptr<titan::gnc::Navigator> navigator);
        void SetPointingMode(std::unique_ptr<titan::gnc::PointingMode> mode);
        void AddReactionWheel(titan::math::Vector3 axis, double maxTorque,
                              double maxMomentum, double wheelInertia);

        StepResult Step(double dt);

        const SimState &GetState() const { return m_state; }
        double GetTime() const { return m_state.time; }
        SimStatus GetStatus() const { return m_status; }
        const titan::vehicle::Vehicle *GetVehicle() const { return m_vehicle.get(); }
        const titan::environment::CelestialBody &GetBody() const { return m_body; }
        const titan::environment::Atmosphere *GetAtmosphere() const { return m_atmosphere.get(); }

    private:
        titan::math::Vector3 ComputeTotalAcceleration(
            const SimState &state, double time) const;

        titan::math::Vector3 ComputeTotalTorque(
            const SimState &state, double time) const;

        void PublishTelemetry();
        void CheckCompletion();

        SimState m_state;
        SimStatus m_status;

        titan::environment::CelestialBody m_body;
        std::unique_ptr<titan::environment::Atmosphere> m_atmosphere;

        std::vector<std::unique_ptr<titan::physics::ForceModel>> m_forces;
        std::unique_ptr<titan::integrators::Integrator> m_integrator;
        std::unique_ptr<titan::guidance::Guidance> m_guidance;
        std::unique_ptr<titan::vehicle::Vehicle> m_vehicle;

        std::shared_ptr<titan::events::EventBus> m_eventBus;
        std::shared_ptr<titan::telemetry::TelemetryBus> m_telemetryBus;
        std::unique_ptr<titan::events::FlightSequencer> m_sequencer;

        CompletionCriteria m_completionCriteria;
        double m_maxG;
        double m_maxDynamicPressure;
        bool m_maxQReported;

        // GNC
        std::unique_ptr<titan::gnc::Controller> m_controller;
        std::unique_ptr<titan::gnc::Navigator> m_navigator;
        std::unique_ptr<titan::gnc::PointingMode> m_pointingMode;

        struct ReactionWheelState
        {
            titan::math::Vector3 axis;
            double maxTorque;
            double maxMomentum;
            double wheelInertia;
            double wheelSpeed;
        };
        std::vector<ReactionWheelState> m_reactionWheels;

        titan::math::Vector3 m_controlTorque;

        static constexpr double g0 = 9.80665;
    };
}
