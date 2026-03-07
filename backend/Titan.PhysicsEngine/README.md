# Titan Physics Engine

High-fidelity aerospace physics engine written in C++20 with no external dependencies. Simulates rocket launches from liftoff through orbital insertion with multi-stage vehicles, atmospheric drag, guidance systems, and 6DOF attitude dynamics.

## Build

```bash
mkdir -p build && cd build
cmake ..
cmake --build .
./TitanTest
```

Requires CMake 3.16+ and a C++20 compiler.

## Architecture

```
include/
├── math/           Vector2, Vector3, Quaternion
├── core/           State, Constants
├── physics/        Force models (gravity, drag, thrust, SRP)
├── environment/    CelestialBody, Atmosphere, USStandardAtmosphere
├── integrators/    Euler, RK4, RK45 (Dormand-Prince)
├── guidance/       OrbitalCircularization, TargetApoapsis
├── orbital/        OrbitalMechanics, OrbitalElements
├── simulation/     Stage, Rocket1D/2D, LaunchVehicle2D/3D, Simulation
└── vehicle/        Vehicle (multi-stage container)
src/
└── (implementations)
```

## Core Concepts

### Math Layer

- **Vector2 / Vector3** - full vector algebra (dot, cross, normalize, magnitude, operators)
- **Quaternion** - rotation representation with `FromAxisAngle`, `FromEuler`, `RotateVector`, `KinematicDerivative`, `ErrorTo`

### Physics Models

All force models implement the `ForceModel` interface:

```cpp
class ForceModel {
    virtual Vector3 ComputeForce(const SimState &state, double time) const = 0;
    virtual Vector3 ComputeTorque(const SimState &state, double time) const;
};
```

Available models:

| Model | Description |
|-------|------------|
| `PointMassGravity` | Newtonian inverse-square: F = -mu * m / r^3 * r |
| `J2Gravity` | Point-mass + J2 oblateness perturbation |
| `AtmosphericDrag` | D = 0.5 * rho * v^2 * Cd * A, with optional Mach-dependent Cd |
| `ThrustForce` | Configurable direction function, optional altitude-dependent ISP |
| `SolarRadiationPressure` | SRP with shadow detection |

### Environment

- **CelestialBody** - factory presets for Earth, Moon, Mars (mu, radius, J2, atmosphere params)
- **Atmosphere** - exponential model: rho = rho0 * exp(-h / H)
- **USStandardAtmosphere** - piecewise 1976 model with troposphere, tropopause, stratosphere, mesosphere layers

### Integrators

Strategy pattern, all implement `Integrator` interface:

| Integrator | Order | Description |
|-----------|-------|-------------|
| `EulerIntegrator` | O(dt) | Forward Euler, prototype use only |
| `RK4Integrator` | O(dt^4) | Classic Runge-Kutta 4th order |
| `RK45Integrator` | O(dt^5) | Dormand-Prince with adaptive step size control |

RK45 parameters: `atol=1e-8`, `rtol=1e-6`, `h_min=1e-6`, `h_max=10.0`.

### Guidance

Returns pitch angle or 3D thrust direction from vehicle state:

| Guidance | Strategy |
|----------|---------|
| `OrbitalCircularizationGuidance` | Phase 1: gravity turn (pitch over from vertical), Phase 2: prograde burn for circularization |
| `TargetApoapsisGuidance` | Proportional feedback on apoapsis error |

### Orbital Mechanics

`OrbitalMechanics::ComputeOrbitalElements()` converts Cartesian state (r, v) to classical orbital elements: a, e, i, RAAN, argument of periapsis, true anomaly. Supports both 2D and 3D overloads.

### Vehicle & Stage

- **Stage** - mass properties (dry, fuel, burn rate, exhaust velocity), aerodynamics (Cd, ref area), optional inertia tensor
- **Vehicle** - ordered container of stages with automatic separation when current stage is depleted

### Simulation Progression

| Class | Dimensions | Features |
|-------|-----------|----------|
| `Rocket1D` | 1D vertical | Basic thrust, drag, gravity |
| `Rocket2D` | 2D planar | Gravity turn, orbital elements |
| `LaunchVehicle2D` | 2D multi-stage | Guidance, integrator strategy, staging |
| `LaunchVehicle3D` | 3D multi-stage | Full 3D thrust direction |
| `Simulation` | 3D 6DOF | All force models, attitude, reaction wheels, GNC |

### Simulation Class (High-Fidelity)

The top-level `Simulation` class composes:

- Configurable force models (gravity, drag, thrust, SRP)
- Integrator (RK4/RK45)
- Guidance system
- Multi-stage vehicle with event-driven separation
- Quaternion attitude propagation
- Reaction wheel control (momentum, saturation, torque limits)
- Completion criteria (periapsis > 180 km, eccentricity < 0.02)
- Event bus for stage events, telemetry bus for streaming output

## Physical Constants

| Constant | Value | Unit |
|----------|-------|------|
| G | 6.67430e-11 | m^3/kg/s^2 |
| Earth mass | 5.972e24 | kg |
| Earth radius | 6,371,000 | m |
| Earth mu | 3.986004418e14 | m^3/s^2 |
| Earth J2 | 1.08263e-3 | - |
| Sea-level density | 1.225 | kg/m^3 |
| Scale height | 8,500 | m |

## Design Principles

- **Strategy pattern** for integrators, guidance, and force models
- **Composition** over inheritance for vehicles and simulations
- **Stateless physics** - force models are pure functions of state
- **No external dependencies** - pure C++20 standard library
- **Deterministic** - same input produces same output
