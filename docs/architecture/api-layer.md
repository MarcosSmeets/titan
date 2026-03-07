# API Layer Architecture

## Overview

The Titan API is an ASP.NET Core 8 application that bridges the C++ physics engine and the React frontend. It manages simulation execution, real-time streaming, data persistence, and rocket configuration.

## Components

```
┌─────────────────────────────────────────────────────┐
│                   ASP.NET Core 8                     │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Controllers  │  │  TelemetryHub │  │   Static   │ │
│  │ (REST)       │  │  (SignalR)    │  │  Presets   │ │
│  └──────┬───────┘  └──────┬───────┘  └────────────┘ │
│         │                  │                          │
│  ┌──────▼──────────────────▼───────┐                 │
│  │      SimulationStore            │                 │
│  │      (Persistence Layer)        │                 │
│  └──────┬──────────────────────────┘                 │
│         │                                             │
│  ┌──────▼──────────┐  ┌──────────────────────┐      │
│  │  TitanDbContext  │  │  TitanInterop        │      │
│  │  (EF Core)       │  │  (P/Invoke to C++)   │      │
│  └──────┬──────────┘  └──────────┬───────────┘      │
│         │                         │                   │
└─────────┼─────────────────────────┼───────────────────┘
          ▼                         ▼
      SQLite DB              TitanPhysicsEngine.so
```

## REST Endpoints

### Rockets (`/api/rockets`)

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/rockets` | All presets (metadata only) |
| GET | `/api/rockets/{id}` | Preset with stage details |

Presets are loaded from `Data/RocketPresets.json` on first access and cached for the application lifetime.

### Custom Rockets (`/api/custom-rockets`)

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/custom-rockets` | All user rockets |
| GET | `/api/custom-rockets/{id}` | Single rocket with stages |
| POST | `/api/custom-rockets` | Created rocket (8-char ID) |
| DELETE | `/api/custom-rockets/{id}` | Success/not found |

### Simulations (`/api/simulations`)

| Method | Endpoint | Returns |
|--------|----------|---------|
| GET | `/api/simulations` | All saved sims (summary) |
| GET | `/api/simulations/{id}` | Full sim with telemetry+events |
| POST | `/api/simulations` | Run blocking sim, return result |
| POST | `/api/simulations/compare` | Run multiple sims for comparison |
| DELETE | `/api/simulations/{id}` | Delete sim and cascade data |

## SignalR Hub

### Connection

Endpoint: `/hubs/telemetry`

The frontend maintains a singleton `HubConnection` instance.

### Protocol

```
Client → Server:
  RunSimulation(SimulationRequest)

Server → Client:
  OnSimulationStart { rocketName, targetAltitude, duration }
  OnTelemetryUpdate { TelemetryPoint }              (streaming, ~20 Hz)
  OnStageEvent { time, previousStage, newStage, description }
  OnSimulationComplete { orbitAchieved, finalTime, simulationId }
```

### Simulation Loop (Hub)

```csharp
for (int step = 0; step < maxSteps; step++) {
    TitanTelemetry t = TitanInterop.titan_step(simPtr);

    // Detect stage separation
    if (t.StageIndex != prevStage) {
        await Clients.Caller.SendAsync("OnStageEvent", ...);
    }

    // Stream telemetry at interval
    if (step % stepsPerPush == 0) {
        await Clients.Caller.SendAsync("OnTelemetryUpdate", point);
    }

    // Time-warp pacing
    await Task.Delay(delayMs);

    if (t.IsComplete) break;
}

// Save to database
store.Save(simulation);
await Clients.Caller.SendAsync("OnSimulationComplete", result);
```

## Native Interop (P/Invoke)

### Structs

```
TitanSimConfig     → Simulation parameters (target alt, mu, integrator, etc.)
TitanStageConfig   → Stage properties (mass, fuel, burn rate, etc.)
TitanTelemetry     → Per-step output (position, velocity, orbital elements, etc.)
TitanVec6          → 6D state vector (x,y,z,vx,vy,vz)
```

### Functions

```
titan_create_simulation(config) → pointer
titan_add_stage(sim, stage)
titan_step(sim) → telemetry
titan_get_telemetry(sim) → telemetry
titan_destroy(sim)
```

The native library is loaded automatically by .NET runtime from the output directory.

## Database Schema

### Entity Relationships

```
SimulationEntity (1) ──→ (N) SimulationTelemetryEntity
SimulationEntity (1) ──→ (N) SimulationEventEntity
CustomRocketEntity (1) ──→ (N) CustomRocketStageEntity
```

All relationships use cascade delete.

### SimulationEntity

Stores simulation metadata and aggregate results:
- ID, rocket name, target altitude
- Orbit achieved, final time
- Max altitude, max velocity
- Final apoapsis, periapsis, eccentricity
- Creation timestamp

### SimulationTelemetryEntity

Stores telemetry time series (one row per recorded timestep):
- Time, altitude, velocity
- Orbital elements (6)
- Position (x, y, z)
- Stage index

### CustomRocketEntity / CustomRocketStageEntity

User-designed rockets with stages:
- Each stage: mass properties, burn rate, exhaust velocity, aerodynamics
- Ordered by StageIndex

## Configuration

### CORS

```csharp
Origins: ["http://localhost:5173"]
Methods: Any
Headers: Any
Credentials: Allowed
```

### Swagger

Available in development mode at `/swagger`.

### Database

SQLite file `titan.db` in `AppContext.BaseDirectory`. Auto-created with `EnsureCreated()` on startup (no migrations needed).
