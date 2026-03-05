# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
cd backend/Titan.PhysicsEngine
mkdir -p build && cd build
cmake ..
cmake --build .
./TitanTest
```

The project uses **CMake 3.16+** and **C++20**. No external dependencies — pure standard library.

## Architecture

Titan is a modular aerospace physics engine for rocket launch simulation. The source lives in `backend/Titan.PhysicsEngine/` with headers in `include/` and implementations in `src/`.

**Key layers (bottom-up):**

- **Math** (`math/`) — `Vector2`, `Vector3` with full vector algebra. No external math libs.
- **Physics** (`physics/`) — `GravityModel` (Newton's inverse-square) and `AtmosphereModel` (exponential density decay).
- **Environment** (`environment/`) — `Atmosphere` wraps atmospheric density lookup by altitude.
- **Integrators** (`integrators/`) — Abstract `Integrator` base with `RK4Integrator` (primary) and `EulerIntegrator`. Operates on `State`/`Derivative` structs (position + velocity in 3 axes).
- **Simulation** (`simulation/`) — `Stage` (mass, fuel, thrust, drag properties), `Rocket1D`, `Rocket2D`, `LaunchVehicle2D`, `LaunchVehicle3D`. Vehicles compose stages, integrators, and guidance.
- **Guidance** (`guidance/`) — Abstract `Guidance` interface returning pitch angle from vehicle state. Implementations: `OrbitalCircularizationGuidance` (two-phase: gravity turn + circularization), `TargetApoapsisGuidance`.
- **Orbital** (`orbital/`) — `OrbitalMechanics::ComputeOrbitalElements()` converts Cartesian state to orbital elements (a, e, apoapsis, periapsis).

**Design patterns:** Strategy pattern for guidance and integrators (pluggable via constructor). Stages composed into vehicles. Physics models are stateless pure functions.

## Conventions

- Commit messages use conventional commits format: `feat:`, `fix:`, `refactor:`, etc.
- Simulation progression: 1D → 2D → 3D with increasing fidelity.
- `main.cpp` serves as the integration test — configures a launch scenario and prints telemetry every 5 seconds.
- Physics docs in `docs/physics/` explain the mathematical models backing each implementation.
