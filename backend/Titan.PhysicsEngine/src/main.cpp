#include <iostream>
#include <iomanip>
#include <memory>
#include <cmath>

#include "simulation/Simulation.h"
#include "simulation/SimState.h"
#include "simulation/Stage.h"
#include "vehicle/Vehicle.h"
#include "environment/CelestialBody.h"
#include "environment/USStandardAtmosphere.h"
#include "physics/J2Gravity.h"
#include "physics/AtmosphericDrag.h"
#include "integrators/RK45Integrator.h"
#include "guidance/OrbitalCircularizationGuidance.h"
#include "orbital/OrbitalMechanics.h"
#include "events/EventBus.h"
#include "telemetry/TelemetryBus.h"
#include "math/Vector3.h"

using namespace titan;

int main()
{
    auto body = environment::CelestialBody::Earth();

    // Dormand-Prince RK45 adaptive integrator
    auto integrator =
        std::make_unique<integrators::RK45Integrator>(
            1e-8, 1e-6, 1e-6, 10.0);

    auto guidance =
        std::make_unique<guidance::OrbitalCircularizationGuidance>(
            200000.0, body.radius);

    simulation::Simulation sim(body, std::move(integrator), std::move(guidance));

    // Configure atmosphere (US Standard 1976)
    auto atmosphere = std::make_unique<environment::USStandardAtmosphere>();
    sim.SetAtmosphere(std::move(atmosphere));

    // Add J2 gravity (includes point mass + oblateness)
    sim.AddForce(std::make_unique<physics::J2Gravity>(body));

    // Add atmospheric drag with Mach-dependent Cd
    auto dragAtmo = environment::Atmosphere();
    sim.AddForce(std::make_unique<physics::AtmosphericDrag>(
        10.0, // reference area
        physics::AtmosphericDrag::DefaultMachCd(0.5),
        dragAtmo,
        body.radius));

    // Build vehicle
    auto vehicle = std::make_unique<vehicle::Vehicle>();

    // First stage: ascent through atmosphere
    vehicle->AddStage(simulation::Stage(
        10000.0,  // dry mass (kg)
        120000.0, // fuel mass (kg)
        1500.0,   // burn rate (kg/s)
        2800.0,   // exhaust velocity (m/s)
        10.0,     // reference area (m^2)
        0.5));    // drag coefficient

    // Second stage: orbital insertion and circularization
    vehicle->AddStage(simulation::Stage(
        2000.0,  // dry mass (kg)
        20000.0, // fuel mass (kg)
        300.0,   // burn rate (kg/s)
        3400.0,  // exhaust velocity (m/s)
        5.0,     // reference area (m^2)
        0.3));   // drag coefficient

    sim.SetVehicle(std::move(vehicle));

    // Initial state with Earth rotation
    simulation::SimState initState;
    initState.position = math::Vector3(body.radius + 1.0, 0.0, 0.0);
    double surfaceVelocity = body.rotationRate * body.radius;
    initState.velocity = math::Vector3(0.0, surfaceVelocity, 0.0);
    initState.time = 0.0;
    sim.SetInitialState(initState);

    sim.SetMaxG(4.0);

    // Event bus for flight events
    auto eventBus = std::make_shared<events::EventBus>();
    eventBus->SubscribeAll([](const events::SimEvent &event)
                           { std::cout << "[EVENT T+" << std::fixed << std::setprecision(1)
                                       << event.time << "s] " << event.description << "\n"; });
    sim.SetEventBus(eventBus);

    // Configurable completion criteria
    simulation::CompletionCriteria criteria;
    criteria.minPeriapsis = 180000.0;
    criteria.maxEccentricity = 0.02;
    criteria.enabled = true;
    sim.SetCompletionCriteria(criteria);

    double dt = 0.05;
    double simulationDuration = 900.0;

    std::cout << "=== Titan 3D Launch Simulation (Clean Architecture) ===\n";
    std::cout << "Target orbit: 200 km circular\n";
    std::cout << "Surface velocity (Earth rotation): "
              << surfaceVelocity << " m/s\n";
    std::cout << "Gravity model: J2 (oblateness perturbation)\n";
    std::cout << "Atmosphere: US Standard 1976\n";
    std::cout << "Drag: Mach-dependent Cd\n\n";

    int printInterval = 5;
    double nextPrint = 0.0;

    for (double t = 0.0; t < simulationDuration; t += dt)
    {
        auto result = sim.Step(dt);

        if (result.status == simulation::SimStatus::Impact)
        {
            std::cout << "Vehicle impacted surface at t = " << t << " s\n";
            break;
        }

        if (result.status == simulation::SimStatus::Error)
        {
            std::cout << "Simulation error at t = " << t << " s\n";
            break;
        }

        auto pos = result.state.position;
        auto vel = result.state.velocity;

        if (std::isnan(pos.x) || std::isnan(vel.x))
        {
            std::cout << "Numerical instability detected at t = "
                      << t << " s\n";
            break;
        }

        double altitude = pos.Magnitude() - body.radius;
        double velocity = vel.Magnitude();

        auto elements =
            orbital::OrbitalMechanics::ComputeOrbitalElements(pos, vel, body.mu);

        double apoapsis = elements.apoapsis - body.radius;
        double periapsis = elements.periapsis - body.radius;

        if (t >= nextPrint)
        {
            std::cout << std::fixed << std::setprecision(2);
            std::cout << "Time: " << t << " s\n";
            std::cout << "  Altitude:     " << altitude / 1000.0 << " km\n";
            std::cout << "  Velocity:     " << velocity << " m/s\n";
            std::cout << "  Apoapsis:     " << apoapsis / 1000.0 << " km\n";
            std::cout << "  Periapsis:    " << periapsis / 1000.0 << " km\n";
            std::cout << "  Eccentricity: " << elements.eccentricity << "\n";
            std::cout << "  Inclination:  "
                      << elements.inclination * 180.0 / M_PI << " deg\n";
            std::cout << "-----------------------------\n";

            nextPrint += printInterval;
        }

        if (result.status == simulation::SimStatus::Completed)
        {
            std::cout << "\nORBIT ACHIEVED at t = " << t << " seconds\n";
            std::cout << "  Final apoapsis:  "
                      << apoapsis / 1000.0 << " km\n";
            std::cout << "  Final periapsis: "
                      << periapsis / 1000.0 << " km\n";
            std::cout << "  Eccentricity:    "
                      << elements.eccentricity << "\n";
            std::cout << "  Inclination:     "
                      << elements.inclination * 180.0 / M_PI << " deg\n";
            break;
        }
    }

    return 0;
}
