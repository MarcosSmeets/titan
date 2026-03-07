# Titan API

ASP.NET Core 8 Web API that serves as the bridge between the C++ physics engine and the React frontend. Provides REST endpoints for rocket management and simulation history, plus a SignalR WebSocket hub for real-time telemetry streaming.

## Run

```bash
dotnet run
# Listening on http://localhost:5000
```

## Dependencies

| Package | Purpose |
|---------|---------|
| Microsoft.EntityFrameworkCore.Sqlite | SQLite database via EF Core |
| Microsoft.AspNetCore.SignalR.Core | Real-time WebSocket communication |
| Swashbuckle.AspNetCore | Swagger/OpenAPI documentation |

## Architecture

```
Titan.API/
├── Controllers/
│   ├── SimulationsController.cs    REST endpoints for simulation runs & history
│   ├── RocketsController.cs        Preset rocket catalog
│   └── CustomRocketsController.cs  User-created rocket CRUD
├── Hubs/
│   └── TelemetryHub.cs            SignalR hub for real-time simulation
├── Services/
│   └── SimulationStore.cs         Simulation persistence layer
├── Models/
│   ├── SimulationModels.cs        Request/response DTOs
│   └── RocketPreset.cs            Rocket preset data model
├── Data/
│   ├── TitanDbContext.cs           EF Core context with SQLite
│   ├── Entities/                   Database entities
│   └── RocketPresets.json          Built-in rocket catalog
├── Native/
│   └── TitanInterop.cs            P/Invoke bindings to C++ engine
└── Program.cs                     App configuration & startup
```

## API Endpoints

### Rockets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rockets` | List all preset rockets (metadata) |
| GET | `/api/rockets/{id}` | Get rocket details with stage parameters |

### Custom Rockets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/custom-rockets` | List user-created rockets |
| GET | `/api/custom-rockets/{id}` | Get custom rocket details |
| POST | `/api/custom-rockets` | Create custom rocket |
| DELETE | `/api/custom-rockets/{id}` | Delete custom rocket |

### Simulations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/simulations` | List all saved simulations (summary) |
| GET | `/api/simulations/{id}` | Get full simulation with telemetry & events |
| POST | `/api/simulations` | Run synchronous simulation (blocking) |
| POST | `/api/simulations/compare` | Run multiple simulations for comparison |
| DELETE | `/api/simulations/{id}` | Delete a simulation |

### SignalR Hub

**Endpoint:** `/hubs/telemetry`

**Client invokes:**
- `RunSimulation(SimulationRequest)` - Start a real-time streaming simulation

**Server broadcasts:**
- `OnSimulationStart` - Simulation initialized (rocket name, target altitude)
- `OnTelemetryUpdate` - Telemetry snapshot (position, velocity, orbital elements, attitude, aero)
- `OnStageEvent` - Stage separation occurred (time, previous/new stage, description)
- `OnSimulationComplete` - Simulation finished (orbit achieved, final time, simulation ID)

## Simulation Request

```json
{
  "rocketId": "falcon9",
  "targetAltitude": 200000,
  "maxG": 4.0,
  "dt": 0.05,
  "duration": 900,
  "integratorType": 2,
  "guidanceType": 0,
  "timeWarp": 50,
  "customStages": null
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `rocketId` | - | Preset rocket ID (or null if using customStages) |
| `targetAltitude` | 200000 | Target orbit altitude in meters |
| `maxG` | 4.0 | Maximum G-load limit |
| `dt` | 0.05 | Simulation timestep (seconds) |
| `duration` | 900 | Max simulation duration (seconds) |
| `integratorType` | 2 | 0=RK4, 1=Euler, 2=RK45 |
| `guidanceType` | 0 | 0=Orbital Circularization, 1=Target Apoapsis |
| `timeWarp` | 50 | Simulation speed multiplier for streaming |
| `customStages` | null | Array of custom stage configurations |

## Telemetry Point

Each telemetry update contains:

- **Position**: x, y, z (meters, Earth-centered)
- **Velocity**: vx, vy, vz (m/s)
- **Orbital elements**: apoapsis, periapsis, eccentricity, inclination, RAAN, SMA, argument of periapsis, true anomaly
- **Attitude**: quaternion (w, x, y, z), angular velocity (x, y, z)
- **Aerodynamics**: dynamic pressure (Pa), Mach number
- **Reaction wheels**: wheel speeds, momenta, count
- **Status**: stage index, completion flag

## Native Interop

The API calls the C++ physics engine via P/Invoke through `TitanInterop.cs`:

```
titan_create_simulation(config) → IntPtr
titan_add_stage(sim, stageConfig)
titan_step(sim) → TelemetryStruct
titan_get_telemetry(sim) → TelemetryStruct
titan_destroy(sim)
```

The native library (`TitanPhysicsEngine.so/.dll/.dylib`) must be in the output directory or system library path.

## Database

SQLite database (`titan.db`) with auto-migration on startup.

**Tables:**
- `Simulations` - simulation metadata and orbital results
- `SimulationTelemetry` - telemetry time series (FK to Simulations)
- `SimulationEvents` - stage events (FK to Simulations)
- `CustomRockets` - user-created rocket designs
- `CustomRocketStages` - stage parameters (FK to CustomRockets)

## CORS

Configured to allow requests from `http://localhost:5173` (Vite dev server) with credentials and any headers/methods.
