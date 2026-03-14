# Titan Architecture Overview

## Overview

Titan is a modular aerospace simulation platform with three main components:

1. **Physics Engine** (C++20) - high-fidelity simulation core
2. **API** (ASP.NET Core 8) - REST + SignalR server with persistence and authentication
3. **Frontend** (React + TypeScript) - Mission Control Console UI

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                       │
│  TrajectoryViewer  │  Telemetry Panels  │  Charts  │ MCC │
│  LoginPage  │  RegisterPage  │  AuthContext              │
└────────────┬──────────────────────────┬──────────────────┘
             │ REST (history, rockets)   │ SignalR (live telemetry)
             │ + Auth (JWT Bearer)       │
┌────────────▼──────────────────────────▼──────────────────┐
│                    API (.NET 8)                            │
│  AuthController  │  Controllers  │  TelemetryHub  │  EF  │
└────────────┬──────────────────┬──────────────────────────┘
             │ P/Invoke          │ EF Core
┌────────────▼───────────┐ ┌────▼─────────────────────────┐
│  PHYSICS ENGINE (C++20) │ │  DATABASE (PostgreSQL/SQLite) │
│  Forces │ RK45 │ GNC    │ │  Users │ Simulations │ Rockets│
│  Guidance │ Events │ 6DOF│ └─────────────────────────────┘
└──────────────────────────┘
```

## Layer Responsibilities

### Physics Engine

- Newtonian gravity with J2 perturbation
- Exponential and US Standard Atmosphere models
- Euler, RK4, RK45 (Dormand-Prince) integrators with NaN/Inf safety
- 3-phase gravity turn and PD target apoapsis guidance
- MaxQ throttle bucket (70% thrust during peak dynamic pressure)
- Multi-stage vehicles with automatic separation and separation impulse
- 6DOF attitude dynamics with quaternions
- GNC subsystem: navigator, PID attitude controller, pointing modes
- Environmental forces: Coriolis, wind models, solar radiation pressure
- Reaction wheel attitude control
- Keplerian orbital element computation
- Event bus, telemetry bus, and flight sequencer
- C API exported for interop (lifecycle, 6DOF, export)

### API

- JWT authentication with user registration and login
- Authorization on protected endpoints
- Real-time telemetry streaming via SignalR WebSocket
- REST endpoints for rocket catalog, custom rockets, simulation history
- PostgreSQL (Docker) or SQLite (local) persistence via Entity Framework Core
- Native interop (P/Invoke) to C++ engine
- Time-warp pacing for real-time streaming

### Frontend

- Login and registration pages with JWT token management
- AuthContext and SimulationContext for state management
- Mission Control Console layout (TrajectoryViewer + telemetry panels + charts)
- Interactive SVG trajectory visualization with predicted orbits
- KSP-style NavBall attitude indicator
- Tabbed Recharts telemetry charts
- Rocket builder for custom vehicle design
- Simulation replay and comparison tools

## Detailed Documentation

### Architecture

- [System Overview](architecture/system-overview.md) - communication flow, data model, deployment
- [Physics Engine](architecture/physics-engine.md) - namespaces, design patterns, simulation loop
- [API Layer](architecture/api-layer.md) - endpoints, SignalR protocol, database schema
- [Frontend](architecture/frontend.md) - component tree, state management, data flow
- [Authentication](architecture/authentication.md) - JWT flow, BCrypt hashing, authorization

### Physics

- [Rocket Dynamics](physics/rocket-dynamics.md) - propulsion, mass variation, staging
- [Gravity Models](physics/gravity-models.md) - inverse-square, J2 perturbation
- [Atmospheric Model](physics/atmospheric-model.md) - exponential and US Standard 1976
- [Integration Methods](physics/integration-methods.md) - Euler, RK4, RK45, NaN detection
- [Orbital Mechanics](physics/orbital-mechanics.md) - Keplerian elements, orbit types
- [Guidance Systems](physics/guidance-systems.md) - 3-phase gravity turn, PD controller, MaxQ throttle
- [Aerodynamics](physics/aerodynamics.md) - drag, dynamic pressure, Mach effects, MaxQ throttle
- [Mass Variation](physics/mass-variation.md) - Tsiolkovsky equation, mass budgets
- [Attitude Dynamics](physics/attitude-dynamics.md) - quaternions, 6DOF, reaction wheels
- [GNC System](physics/gnc-system.md) - navigator, controller, actuators, pointing modes
- [Environmental Forces](physics/environmental-forces.md) - Coriolis, wind, solar radiation pressure
- [Event System](physics/event-system.md) - EventBus, TelemetryBus, FlightSequencer
