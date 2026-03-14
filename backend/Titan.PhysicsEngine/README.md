# Titan Physics Engine

High-fidelity aerospace physics engine written in C++20 with no external dependencies. Simulates rocket launches from liftoff through orbital insertion with multi-stage vehicles, atmospheric drag, guidance systems, 6DOF attitude dynamics, GNC, and environmental force models.

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
├── physics/        Force models (gravity, drag, thrust, SRP, Coriolis)
├── environment/    CelestialBody, Atmosphere, USStandardAtmosphere, WindModel
├── integrators/    Euler, RK4, RK45 (Dormand-Prince) with NaN/Inf detection
├── guidance/       OrbitalCircularization (3-phase), TargetApoapsis (PD)
├── orbital/        OrbitalMechanics, OrbitalElements
├── gnc/            Navigator, Controller, PIDAttitudeController, PointingMode
├── events/         EventBus, FlightSequencer, SimEvent
├── telemetry/      TelemetryBus
├── simulation/     Stage, Rocket1D/2D, LaunchVehicle2D/3D, Simulation
├── vehicle/        Vehicle (multi-stage container)
└── interop/        TitanCAPI (C API for foreign language interop)
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
| `PointMassGravity` | Newtonian inverse-square: F = -mu * m / r^3 * r. Guard: returns zero if r < bodyRadius |
| `J2Gravity` | Point-mass + J2 oblateness perturbation |
| `AtmosphericDrag` | D = 0.5 * rho * v^2 * Cd * A, with optional Mach-dependent Cd |
| `ThrustForce` | Configurable direction function, optional altitude-dependent ISP |
| `SolarRadiationPressure` | P_sr = 4.56e-6 N/m^2 at 1 AU, reflectivity coefficient, shadow detection |
| `CoriolisForce` | Rotating reference frame: -2m(omega x v) + centrifugal term |

### Environment

- **CelestialBody** - factory presets for Earth, Moon, Mars (mu, radius, J2, atmosphere params)
- **Atmosphere** - exponential model: rho = rho0 * exp(-h / H)
- **USStandardAtmosphere** - piecewise 1976 model with troposphere, tropopause, stratosphere, mesosphere layers
- **WindModel** - abstract wind interface with `ConstantWind` and `WindShearProfile` (jet stream, scale height) implementations

### Integrators

Strategy pattern, all implement `Integrator` interface:

| Integrator | Order | Description |
|-----------|-------|-------------|
| `EulerIntegrator` | O(dt) | Forward Euler, prototype use only |
| `RK4Integrator` | O(dt^4) | Classic Runge-Kutta 4th order |
| `RK45Integrator` | O(dt^5) | Dormand-Prince with adaptive step size control |

RK45 parameters: `atol=1e-8`, `rtol=1e-6`, `h_min=1e-6`, `h_max=10.0`.

All integrators include **NaN/Inf detection**: if the integrated state contains non-finite values, the step is rejected and the previous state is returned unchanged, preventing numerical instability from propagating.

### Guidance

Returns pitch angle or 3D thrust direction from vehicle state:

| Guidance | Strategy |
|----------|---------|
| `OrbitalCircularizationGuidance` | 3-phase gravity turn: (1) vertical hold below kick altitude (500m), (2) altitude-scheduled pitch with velocity-following above 50km, (3) prograde circularization burn |
| `TargetApoapsisGuidance` | PD controller (Kp=5e-7, Kd=2e-4) on apoapsis error with derivative damping |

#### MaxQ Throttle Bucket

During ascent through the 5-20 km altitude band, if dynamic pressure exceeds 30 kPa, thrust is automatically reduced to 70% to limit structural loads. This mimics real launch vehicle throttle-down profiles through the max-Q region.

### GNC (Guidance, Navigation, Control)

The GNC subsystem provides closed-loop attitude control for 6DOF simulations:

**Navigator:**
- Abstract `Navigator` interface with `EstimateState()` method
- `IdealNavigator` - returns true simulation state (perfect knowledge)

**Controller:**
- Abstract `Controller` interface returning `ActuatorCommands` (thrust direction, throttle, torque)
- `PIDAttitudeController` - 3-axis PID with per-axis gains (Kp, Ki, Kd), integral anti-windup clamping, quaternion error calculation with short-path rotation

**Pointing Modes:**

| Mode | Behavior |
|------|----------|
| `InertialHold` | Maintains a fixed target quaternion |
| `NadirPointing` | Body -Z toward planet center, X along-track |
| `SunPointing` | Body +X toward sun direction |

### Orbital Mechanics

`OrbitalMechanics::ComputeOrbitalElements()` converts Cartesian state (r, v) to classical orbital elements: a, e, i, RAAN, argument of periapsis, true anomaly. Supports both 2D and 3D overloads.

### Vehicle & Stage

- **Stage** - mass properties (dry, fuel, burn rate, exhaust velocity), aerodynamics (Cd, ref area), optional inertia tensor
- **Vehicle** - ordered container of stages with automatic separation when current stage is depleted
- **Separation impulse** - on stage separation, a 2.0 m/s delta-v is applied along the velocity vector to ensure clean separation

### Event System

- **EventBus** - pub/sub for simulation events. Supports `Subscribe`, `SubscribeAll`, `Emit`, `ScheduleEvent`, `ProcessScheduledEvents`. Maintains an event log.
- **SimEvent** - typed events: `StageIgnition`, `StageSeparation`, `StageBurnout`, `MaxQ`, `FairingJettison`, `OrbitInsertion`, `Impact`, `GuidancePhaseChange`, `ThrottleChange`, and `Custom`
- **FlightSequencer** - schedules timed events (`AddTimedEvent`) and conditional events (`AddConditionalEvent`) that trigger when a predicate on `SimState` becomes true
- **TelemetryBus** - channel-based pub/sub for telemetry data. Subscribers receive `(channel, time, value)` tuples. Records stored for later retrieval.

**MaxQ auto-detection:** the simulation tracks peak dynamic pressure and emits a `MaxQ` event when pressure drops to 95% of its peak (indicating max-Q has passed).

### Simulation Progression

| Class | Dimensions | Features |
|-------|-----------|----------|
| `Rocket1D` | 1D vertical | Basic thrust, drag, gravity |
| `Rocket2D` | 2D planar | Gravity turn, orbital elements |
| `LaunchVehicle2D` | 2D multi-stage | Guidance, integrator strategy, staging |
| `LaunchVehicle3D` | 3D multi-stage | Full 3D thrust direction |
| `Simulation` | 3D 6DOF | All force models, attitude, reaction wheels, GNC, events, telemetry |

### Simulation Class (High-Fidelity)

The top-level `Simulation` class composes:

- Configurable force models (gravity, drag, thrust, SRP, Coriolis, wind)
- Integrator (RK4/RK45) with NaN/Inf safety
- Guidance system (3-phase gravity turn or PD target apoapsis)
- Multi-stage vehicle with event-driven separation and separation impulse
- MaxQ throttle bucket (70% thrust when q > 30 kPa in 5-20 km band)
- Quaternion attitude propagation
- Reaction wheel control (momentum, saturation, torque limits)
- GNC loop (navigator → controller → actuators)
- Pointing modes (inertial hold, nadir, sun)
- Completion criteria (periapsis > 180 km, eccentricity < 0.02)
- Event bus for stage events, telemetry bus for streaming output

## C API

The C API (`interop/TitanCAPI.h`) exports functions for cross-language interop via P/Invoke:

### Simulation Lifecycle

```c
TitanSim *titan_create_simulation(TitanSimConfig config);
void      titan_add_stage(TitanSim *sim, TitanStageConfig stage);
TitanTelemetry titan_step(TitanSim *sim);
TitanTelemetry titan_get_telemetry(TitanSim *sim);
void      titan_destroy(TitanSim *sim);
```

### 6DOF Attitude Control

```c
void titan_set_initial_attitude(TitanSim *sim, double w, double x, double y, double z);
void titan_add_reaction_wheel(TitanSim *sim, double ax, double ay, double az,
                               double maxTorque, double maxMomentum, double wheelInertia);
void titan_set_pointing_mode(TitanSim *sim, int mode);
// mode: 0=none, 1=inertial, 2=nadir, 3=sun
```

### Event/Telemetry Callbacks

```c
void titan_set_event_callback(TitanSim *sim, TitanEventCallback cb, void *userData);
void titan_set_telemetry_callback(TitanSim *sim, TitanTelemetryCallback cb, void *userData);
```

### Data Export

```c
int titan_export_csv(TitanSim *sim, const char *filename);
int titan_export_json(TitanSim *sim, const char *filename);
```

### Error Handling

```c
int titan_get_last_error(TitanSim *sim, char *buffer, int bufferSize);
```

### Configuration

Earth rotation is enabled via the `useEarthRotation` flag in `TitanSimConfig`, which activates the `CoriolisForce` model.

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
- **Fail-safe numerics** - NaN/Inf detection prevents silent corruption
