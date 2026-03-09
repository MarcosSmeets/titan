# Titan Architecture Overview

## Overview

Titan is a modular aerospace simulation platform with three main components:

1. **Physics Engine** (C++20) - high-fidelity simulation core
2. **API** (ASP.NET Core 8) - REST + SignalR server with persistence
3. **Frontend** (React + TypeScript) - Mission Control Console UI

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                       │
│  TrajectoryViewer  │  Telemetry Panels  │  Charts  │ MCC │
└────────────┬──────────────────────────┬──────────────────┘
             │ REST (history, rockets)   │ SignalR (live telemetry)
┌────────────▼──────────────────────────▼──────────────────┐
│                    API (.NET 8)                            │
│  Controllers  │  TelemetryHub  │  SimulationStore  │  EF  │
└────────────┬─────────────────────────────────────────────┘
             │ P/Invoke
┌────────────▼─────────────────────────────────────────────┐
│               PHYSICS ENGINE (C++20)                      │
│  Gravity (J2)  │  Atmosphere  │  RK45  │  Guidance  │ 6DOF│
└──────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Physics Engine

- Newtonian gravity with J2 perturbation
- Exponential and US Standard Atmosphere models
- Euler, RK4, RK45 (Dormand-Prince) integrators
- Orbital circularization and target apoapsis guidance
- Multi-stage vehicles with automatic separation
- 6DOF attitude dynamics with quaternions
- Reaction wheel attitude control
- Keplerian orbital element computation
- Event bus and telemetry bus
- C API exported for interop

### API

- Real-time telemetry streaming via SignalR WebSocket
- REST endpoints for rocket catalog and simulation history
- SQLite persistence via Entity Framework Core
- Native interop (P/Invoke) to C++ engine
- Time-warp pacing for real-time streaming

### Frontend

- Mission Control Console layout (TrajectoryViewer + telemetry panels + charts)
- Interactive SVG trajectory visualization with predicted orbits
- KSP-style NavBall attitude indicator
- Tabbed Recharts telemetry charts
- Rocket builder for custom vehicle design
- Simulation replay and comparison tools

## Detailed Documentation

- [System Overview](architecture/system-overview.md) - communication flow, data model, deployment
- [Physics Engine](architecture/physics-engine.md) - namespaces, design patterns, simulation loop
- [API Layer](architecture/api-layer.md) - endpoints, SignalR protocol, database schema
- [Frontend](architecture/frontend.md) - component tree, state management, data flow

## Physics Documentation

- [Rocket Dynamics](physics/rocket-dynamics.md) - propulsion, mass variation, staging
- [Gravity Models](physics/gravity-models.md) - inverse-square, J2 perturbation
- [Atmospheric Model](physics/atmospheric-model.md) - exponential and US Standard 1976
- [Integration Methods](physics/integration-methods.md) - Euler, RK4, RK45
- [Orbital Mechanics](physics/orbital-mechanics.md) - Keplerian elements, orbit types
- [Guidance Systems](physics/guidance-systems.md) - gravity turn, circularization
- [Aerodynamics](physics/aerodynamics.md) - drag, dynamic pressure, Mach effects
- [Mass Variation](physics/mass-variation.md) - Tsiolkovsky equation, mass budgets
- [Attitude Dynamics](physics/attitude-dynamics.md) - quaternions, 6DOF, reaction wheels
