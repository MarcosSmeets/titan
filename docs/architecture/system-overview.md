# System Architecture Overview

## High-Level Architecture

Titan is a three-tier aerospace simulation platform:

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                       │
│  Mission Control Console  │  Trajectory Viewer  │ Charts │
└────────────┬──────────────────────────┬──────────────────┘
             │ REST API                  │ SignalR WebSocket
             │ (history, rockets)        │ (real-time telemetry)
┌────────────▼──────────────────────────▼──────────────────┐
│                    API (.NET 8)                            │
│  Controllers  │  SignalR Hub  │  SimulationStore  │  EF   │
└────────────┬─────────────────────────────────────────────┘
             │ P/Invoke (native interop)
┌────────────▼─────────────────────────────────────────────┐
│               PHYSICS ENGINE (C++20)                      │
│  Forces  │  Integrators  │  Guidance  │  Orbital  │  GNC │
└──────────────────────────────────────────────────────────┘
             │
┌────────────▼─────────────────────────────────────────────┐
│                    SQLITE DATABASE                         │
│  Simulations  │  Telemetry  │  Events  │  Custom Rockets │
└──────────────────────────────────────────────────────────┘
```

## Communication Flow

### Real-Time Simulation (Primary Path)

```
1. User clicks LAUNCH in frontend
2. Frontend opens SignalR WebSocket to /hubs/telemetry
3. Frontend invokes RunSimulation(request)
4. API Hub creates C++ simulation via P/Invoke:
   - titan_create_simulation(config)
   - titan_add_stage(sim, stage) x N
5. API Hub enters simulation loop:
   - titan_step(sim) → telemetry
   - Hub broadcasts OnTelemetryUpdate to client (~20 Hz)
   - Hub broadcasts OnStageEvent on stage separation
   - Delay based on TimeWarp for real-time pacing
6. On completion:
   - Hub saves to SQLite via SimulationStore
   - Hub broadcasts OnSimulationComplete
7. Frontend updates TrajectoryViewer, panels, charts in real-time
```

### Replay Path

```
1. User opens History page
2. Frontend calls GET /api/simulations (REST)
3. User selects a simulation to replay
4. Frontend calls GET /api/simulations/{id} (REST)
5. Full telemetry array loaded at once
6. SimulationPage renders complete data (non-live mode)
```

## Data Model

### Telemetry Point

Each simulation timestep produces a telemetry snapshot:

| Category | Fields |
|----------|--------|
| Position | x, y, z (meters, Earth-centered) |
| Velocity | vx, vy, vz (m/s) |
| Orbital | apoapsis, periapsis, eccentricity, inclination, RAAN, SMA, arg-periapsis, true anomaly |
| Attitude | quaternion (w,x,y,z), angular velocity (x,y,z) |
| Aerodynamics | dynamic pressure, Mach number |
| Vehicle | stage index, completion flag |
| Reaction Wheels | wheel speeds, momenta, count |

### Simulation Request

| Field | Description |
|-------|-------------|
| rocketId / customStages | Vehicle configuration |
| targetAltitude | Target orbit altitude (m) |
| maxG | G-load limit |
| dt | Timestep (s) |
| duration | Max simulation time (s) |
| integratorType | 0=RK4, 1=Euler, 2=RK45 |
| guidanceType | 0=Circularization, 1=TargetApoapsis |
| timeWarp | Streaming speed multiplier |

## Performance Characteristics

### Physics Engine

- Timestep: 0.05s default (adaptive with RK45)
- Typical simulation: 600-900s of flight time
- Steps per simulation: ~12,000-18,000
- Native execution: <1 second for full simulation

### Telemetry Streaming

- Push rate: ~20 Hz (adjustable via timeWarp)
- Delay per push: max(16ms, 1000ms / timeWarp)
- Points per push: 1 telemetry snapshot
- Total points stored: ~180 per simulation (every 5s interval)

### Database

- SQLite file: titan.db
- Auto-created on startup
- Cascade delete for simulation → telemetry/events

## Security & CORS

- CORS limited to `http://localhost:5173`
- No authentication (local development tool)
- Credentials enabled for SignalR WebSocket

## Deployment Topology

Currently designed for local development:

```
localhost:5173  →  Vite Dev Server (React)
                    ↓ proxy
localhost:5000  →  ASP.NET Core API
                    ↓ P/Invoke
                   TitanPhysicsEngine.so/dll (native library)
                    ↓
                   titan.db (SQLite)
```

Vite proxies `/api/*` and `/hubs/*` to the API server.
