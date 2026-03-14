# API Layer Architecture

## Overview

The Titan API is an ASP.NET Core 8 application that bridges the C++ physics engine and the React frontend. It manages simulation execution, real-time streaming, data persistence, rocket configuration, and user authentication.

## Components

```
┌─────────────────────────────────────────────────────┐
│                   ASP.NET Core 8                     │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Controllers  │  │  TelemetryHub │  │   Auth     │ │
│  │ (REST)       │  │  (SignalR)    │  │  Service   │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                  │                │         │
│  ┌──────▼──────────────────▼────────────────▼──────┐ │
│  │      SimulationStore  │  JWT Middleware          │ │
│  │      (Persistence)    │  (Authentication)       │ │
│  └──────┬──────────────────────────┬───────────────┘ │
│         │                          │                  │
│  ┌──────▼──────────┐  ┌───────────▼────────────┐    │
│  │  TitanDbContext  │  │  TitanInterop          │    │
│  │  (EF Core)       │  │  (P/Invoke to C++)     │    │
│  └──────┬──────────┘  └──────────┬─────────────┘    │
│         │                        │                    │
└─────────┼────────────────────────┼────────────────────┘
          ▼                        ▼
    PostgreSQL/SQLite       TitanPhysicsEngine.so
```

## Authentication

### AuthController (`/api/auth`)

| Method | Endpoint | Auth | Returns |
|--------|----------|------|---------|
| POST | `/api/auth/register` | No | `{ token, username, email, role }` |
| POST | `/api/auth/login` | No | `{ token, username, email, role }` |
| GET | `/api/auth/me` | Yes | `{ userId, email, username, role }` |

### JWT Configuration

- Issuer: `titan-api`
- Audience: `titan-app`
- Expiry: 24 hours
- Signing key: `JWT_SECRET` environment variable (SymmetricSecurityKey)
- SignalR token: read from `?access_token` query parameter for `/hubs` paths

### AuthService

- `Register(email, username, password)` - validates, BCrypt hashes password, creates user, returns JWT
- `Login(email, password)` - verifies BCrypt hash, returns JWT
- Password requirements: 8+ chars, uppercase, lowercase, digit
- Admin seeding on startup if `ADMIN_PASSWORD` is set

## REST Endpoints

### Rockets (`/api/rockets`)

| Method | Endpoint | Auth | Returns |
|--------|----------|------|---------|
| GET | `/api/rockets` | No | All presets (metadata only) |
| GET | `/api/rockets/{id}` | No | Preset with stage details |

Presets are loaded from `Data/RocketPresets.json` on first access and cached for the application lifetime.

### Custom Rockets (`/api/custom-rockets`)

| Method | Endpoint | Auth | Returns |
|--------|----------|------|---------|
| GET | `/api/custom-rockets` | No | All user rockets |
| GET | `/api/custom-rockets/{id}` | No | Single rocket with stages |
| POST | `/api/custom-rockets` | Yes | Created rocket (8-char ID) |
| DELETE | `/api/custom-rockets/{id}` | Yes | Success/not found |

### Simulations (`/api/simulations`)

| Method | Endpoint | Auth | Returns |
|--------|----------|------|---------|
| GET | `/api/simulations` | No | All saved sims (summary) |
| GET | `/api/simulations/{id}` | No | Full sim with telemetry+events |
| POST | `/api/simulations` | No | Run blocking sim, return result |
| POST | `/api/simulations/compare` | No | Run multiple sims for comparison |
| DELETE | `/api/simulations/{id}` | Yes | Delete sim and cascade data |

## SignalR Hub

### Connection

Endpoint: `/hubs/telemetry`

The frontend maintains a singleton `HubConnection` instance. JWT token is passed via `?access_token` query parameter.

### Protocol

```
Client → Server:
  RunSimulation(SimulationRequest)

Server → Client:
  OnSimulationStart { rocketName, targetAltitude, duration }
  OnTelemetryUpdate { TelemetryPoint }              (streaming, ~20 Hz)
  OnStageEvent { time, previousStage, newStage, description }
  OnSimulationComplete { orbitAchieved, finalTime, simulationId }
  OnSimulationError { message }
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
TitanSimConfig     → Simulation parameters (target alt, mu, integrator, useEarthRotation, etc.)
TitanStageConfig   → Stage properties (mass, fuel, burn rate, etc.)
TitanTelemetry     → Per-step output (position, velocity, orbital elements, attitude, aero)
TitanVec6          → 6D state vector (x,y,z,vx,vy,vz)
```

### Core Functions

```
titan_create_simulation(config) → pointer
titan_add_stage(sim, stage)
titan_step(sim) → telemetry
titan_get_telemetry(sim) → telemetry
titan_destroy(sim)
```

### 6DOF Functions

```
titan_set_initial_attitude(sim, w, x, y, z)
titan_add_reaction_wheel(sim, ax, ay, az, maxTorque, maxMomentum, wheelInertia)
titan_set_pointing_mode(sim, mode)    // 0=none, 1=inertial, 2=nadir, 3=sun
```

### Event/Telemetry Callbacks

```
titan_set_event_callback(sim, callback, userData)
titan_set_telemetry_callback(sim, callback, userData)
```

### Data Export

```
titan_export_csv(sim, filename) → int
titan_export_json(sim, filename) → int
```

### Error Handling

```
titan_get_last_error(sim, buffer, bufferSize) → int
```

The native library is loaded automatically by .NET runtime from the output directory.

## Database Schema

### Entity Relationships

```
UserEntity                                   (standalone)
SimulationEntity (1) ──→ (N) SimulationTelemetryEntity
SimulationEntity (1) ──→ (N) SimulationEventEntity
CustomRocketEntity (1) ──→ (N) CustomRocketStageEntity
```

All relationships use cascade delete.

### UserEntity

Stores user accounts:
- ID (8-char unique)
- Email (unique index)
- Username (unique index)
- PasswordHash (BCrypt)
- Role ("user" or "admin")
- CreatedAt

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
var corsOrigins = Environment.GetEnvironmentVariable("CORS_ORIGINS")?.Split(',')
    ?? new[] { "http://localhost:5173" };
// AllowAnyHeader, AllowAnyMethod, AllowCredentials
```

### Swagger

Available in development mode at `/swagger`.

### Database

- **Local**: SQLite file `titan.db` in `AppContext.BaseDirectory`. Auto-created with `EnsureCreated()`.
- **Docker**: PostgreSQL via `DATABASE_URL` environment variable. Schema auto-created on startup.
