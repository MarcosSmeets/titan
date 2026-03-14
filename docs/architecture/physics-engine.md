# Physics Engine Architecture

## Overview

The Titan Physics Engine is a modular C++20 library organized in layered namespaces. Each layer depends only on layers below it.

## Namespace Hierarchy

```
titan::math              Vectors, Quaternion (no dependencies)
  ↑
titan::core              State, Constants
  ↑
titan::physics           Force models (ForceModel interface)
  ↑
titan::environment       CelestialBody, Atmosphere, WindModel
  ↑
titan::integrators       ODE solvers (Integrator interface)
  ↑
titan::guidance          Guidance strategies
  ↑
titan::orbital           Orbital element computation
  ↑
titan::gnc               Navigator, Controller, PIDAttitudeController, PointingMode
  ↑
titan::events            EventBus, FlightSequencer, SimEvent
  ↑
titan::telemetry         TelemetryBus
  ↑
titan::vehicle           Vehicle, Stage
  ↑
titan::simulation        Rocket1D/2D, LaunchVehicle2D/3D, Simulation
```

## Design Patterns

### Strategy Pattern

Three pluggable interfaces allow mix-and-match composition:

**Integrators:**
```cpp
class Integrator {
    virtual StepResult Step(const State &, double dt,
        function<Derivative(const State &)>) = 0;
};
// Implementations: EulerIntegrator, RK4Integrator, RK45Integrator
```

**Force Models:**
```cpp
class ForceModel {
    virtual Vector3 ComputeForce(const SimState &, double time) const = 0;
    virtual Vector3 ComputeTorque(const SimState &, double time) const;
};
// Implementations: PointMassGravity, J2Gravity, AtmosphericDrag, ThrustForce,
//                  SolarRadiationPressure, CoriolisForce
```

**Guidance:**
```cpp
class Guidance {
    virtual double ComputePitchAngle(const State &, double mu) = 0;
    virtual Vector3 ComputeThrustDirection(const State &, double mu);
};
// Implementations: OrbitalCircularizationGuidance, TargetApoapsisGuidance
```

**GNC:**
```cpp
class Navigator {
    virtual SimState EstimateState(const SimState &trueState) = 0;
};
class Controller {
    virtual ActuatorCommands Compute(const SimState &estimated, const SimState &desired) = 0;
};
class PointingMode {
    virtual Quaternion DesiredAttitude(const SimState &state) = 0;
};
```

### Composition

The `Simulation` class composes all subsystems:

```cpp
Simulation sim(body, make_unique<RK45Integrator>(), make_unique<CircGuidance>());
sim.AddForce(make_unique<PointMassGravity>(body));
sim.AddForce(make_unique<AtmosphericDrag>(...));
sim.AddForce(make_unique<CoriolisForce>(body.angularVelocity));
sim.SetVehicle(make_unique<Vehicle>());
sim.SetAtmosphere(make_unique<USStandardAtmosphere>());
sim.SetNavigator(make_unique<IdealNavigator>());
sim.SetController(make_unique<PIDAttitudeController>(gains));
sim.SetPointingMode(make_unique<NadirPointing>());
```

### Event-Driven Communication

- **EventBus** - publishes simulation events (stage separation, MaxQ, orbit insertion, etc.)
- **TelemetryBus** - publishes per-step telemetry snapshots to named channels
- **FlightSequencer** - triggers timed and conditional events during the simulation

## Simulation Loop (Simulation::Step)

```
 1. Check impact (r <= body.radius - 1)
 2. Compute total force from all ForceModels
 3. Compute total torque from all ForceModels
 4. Get guidance thrust direction
 5. Apply thrust force (if fuel available)
 6. Apply G-load throttle limiting
 7. Apply MaxQ throttle bucket (70% if q > 30kPa in 5-20km band)
 8. Burn fuel
 9. Integrate translational state (position, velocity)
10. NaN/Inf check — halt if numerical instability detected
11. Integrate rotational state (quaternion, angular velocity)
12. Update reaction wheels
13. Run GNC loop (navigator → controller → actuators)
14. Check stage separation, apply separation impulse (2 m/s prograde)
15. Compute orbital elements
16. Publish telemetry to TelemetryBus
17. Detect and emit MaxQ event (when q drops to 95% of peak)
18. Process FlightSequencer events
19. Check completion criteria (periapsis > 180km, eccentricity < 0.02)
```

## State Structures

Three levels of state representation:

| Struct | Components | Used By |
|--------|-----------|---------|
| `integrators::State` | x,y,z,vx,vy,vz (6 doubles) | Integrators, LaunchVehicle |
| `core::State` | Vector3 position, velocity, mass | Legacy models |
| `SimState` | Vector3 pos/vel, Quaternion attitude, Vector3 angVel, mass, time | Simulation class |

## Build Output

The CMake build produces:
- `libTitanPhysicsEngine.so` (Linux) / `.dll` (Windows) / `.dylib` (macOS) - shared library for API interop
- `TitanTest` - test executable running `main.cpp` integration scenarios

## C API for Interop

Exported C functions for .NET P/Invoke:

### Simulation Lifecycle

```c
void* titan_create_simulation(TitanSimConfig config);
void  titan_add_stage(void* sim, TitanStageConfig stage);
TitanTelemetry titan_step(void* sim);
TitanTelemetry titan_get_telemetry(void* sim);
void  titan_destroy(void* sim);
```

### 6DOF Attitude Control

```c
void titan_set_initial_attitude(void* sim, double w, double x, double y, double z);
void titan_add_reaction_wheel(void* sim, double ax, double ay, double az,
                               double maxTorque, double maxMomentum, double wheelInertia);
void titan_set_pointing_mode(void* sim, int mode);  // 0=none, 1=inertial, 2=nadir, 3=sun
```

### Events & Telemetry

```c
void titan_set_event_callback(void* sim, TitanEventCallback cb, void* userData);
void titan_set_telemetry_callback(void* sim, TitanTelemetryCallback cb, void* userData);
```

### Data Export & Error Handling

```c
int titan_export_csv(void* sim, const char* filename);
int titan_export_json(void* sim, const char* filename);
int titan_get_last_error(void* sim, char* buffer, int bufferSize);
```

### Configuration

Earth rotation (Coriolis force) is activated via the `useEarthRotation` flag in `TitanSimConfig`.

## Simulation Progression

The codebase provides models at increasing fidelity for learning and development:

```
Rocket1D          (1D, single stage, constant g, basic drag)
    ↓
Rocket2D          (2D, gravity turn, orbital elements)
    ↓
LaunchVehicle2D   (2D, multi-stage, guidance, integrator)
    ↓
LaunchVehicle3D   (3D, 3D thrust direction)
    ↓
Simulation        (3D 6DOF, all forces, GNC, events, telemetry)
```
