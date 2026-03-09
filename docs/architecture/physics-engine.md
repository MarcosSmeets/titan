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
titan::environment       CelestialBody, Atmosphere
  ↑
titan::integrators       ODE solvers (Integrator interface)
  ↑
titan::guidance          Guidance strategies
  ↑
titan::orbital           Orbital element computation
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
// Implementations: PointMassGravity, J2Gravity, AtmosphericDrag, ThrustForce, SRP
```

**Guidance:**
```cpp
class Guidance {
    virtual double ComputePitchAngle(const State &, double mu) = 0;
    virtual Vector3 ComputeThrustDirection(const State &, double mu);
};
// Implementations: OrbitalCircularizationGuidance, TargetApoapsisGuidance
```

### Composition

The `Simulation` class composes all subsystems:

```cpp
Simulation sim(body, make_unique<RK45Integrator>(), make_unique<CircGuidance>());
sim.AddForce(make_unique<PointMassGravity>(body));
sim.AddForce(make_unique<AtmosphericDrag>(...));
sim.SetVehicle(make_unique<Vehicle>());
sim.SetAtmosphere(make_unique<USStandardAtmosphere>());
```

### Event-Driven Communication

- **EventBus** - publishes stage separation events
- **TelemetryBus** - publishes per-step telemetry snapshots

## Simulation Loop (Simulation::Step)

```
1. Check impact (r <= body.radius - 1)
2. Compute total force from all ForceModels
3. Compute total torque from all ForceModels
4. Get guidance thrust direction
5. Apply thrust force (if fuel available)
6. Apply G-load throttle limiting
7. Burn fuel
8. Integrate translational state (position, velocity)
9. Integrate rotational state (quaternion, angular velocity)
10. Update reaction wheels
11. Check stage separation
12. Compute orbital elements
13. Publish telemetry
14. Check completion criteria
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

```c
void* titan_create_simulation(TitanSimConfig config);
void  titan_add_stage(void* sim, TitanStageConfig stage);
TitanTelemetry titan_step(void* sim);
TitanTelemetry titan_get_telemetry(void* sim);
void  titan_destroy(void* sim);
```

These wrap the C++ `Simulation` class for cross-language use.

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
