# Titan API

ASP.NET Core 8 Web API that serves as the bridge between the C++ physics engine and the React frontend. Provides REST endpoints for rocket management and simulation history, a SignalR WebSocket hub for real-time telemetry streaming, and JWT-based authentication.

## Run

### Local (SQLite)

```bash
JWT_SECRET="your-secret-key-min-32-chars-long" dotnet run
# Listening on http://localhost:5000
```

### Docker

The API runs as part of the Docker Compose stack with PostgreSQL:

```bash
# From the project root
docker compose up --build
```

See the root README for Docker environment variable setup.

## Dependencies

| Package | Purpose |
|---------|---------|
| Microsoft.EntityFrameworkCore.Sqlite | SQLite database (local dev) |
| Npgsql.EntityFrameworkCore.PostgreSQL | PostgreSQL database (Docker) |
| Microsoft.AspNetCore.SignalR.Core | Real-time WebSocket communication |
| Microsoft.AspNetCore.Authentication.JwtBearer | JWT authentication |
| BCrypt.Net-Next | Password hashing |
| Swashbuckle.AspNetCore | Swagger/OpenAPI documentation |

## Architecture

```
Titan.API/
├── Controllers/
│   ├── AuthController.cs           Register, login, JWT token issuance
│   ├── SimulationsController.cs    REST endpoints for simulation runs & history
│   ├── RocketsController.cs        Preset rocket catalog
│   └── CustomRocketsController.cs  User-created rocket CRUD (auth required)
├── Hubs/
│   └── TelemetryHub.cs            SignalR hub for real-time simulation
├── Services/
│   ├── AuthService.cs             JWT generation, BCrypt hashing, user management
│   └── SimulationStore.cs         Simulation persistence layer
├── Models/
│   ├── SimulationModels.cs        Request/response DTOs
│   ├── AuthModels.cs              Register/Login request/response DTOs
│   └── RocketPreset.cs            Rocket preset data model
├── Data/
│   ├── TitanDbContext.cs           EF Core context (SQLite or PostgreSQL)
│   ├── Entities/
│   │   ├── UserEntity.cs          User account (id, email, username, passwordHash, role)
│   │   ├── SimulationEntity.cs    Simulation metadata and results
│   │   └── ...                    Telemetry, events, custom rockets
│   └── RocketPresets.json          Built-in rocket catalog
├── Native/
│   └── TitanInterop.cs            P/Invoke bindings to C++ engine
└── Program.cs                     App configuration & startup
```

## Authentication

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Create new account |
| POST | `/api/auth/login` | No | Login, returns JWT token |
| GET | `/api/auth/me` | Yes | Get current user info |

### JWT Token Flow

1. User registers via `POST /api/auth/register` with email, username, password
2. User logs in via `POST /api/auth/login` with email and password
3. Server returns a JWT token (24-hour expiry) with claims: sub, email, username, role
4. Client includes `Authorization: Bearer <token>` header on protected requests
5. For SignalR, the token is passed via `?access_token=<token>` query parameter

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit

Passwords are hashed with BCrypt before storage.

### Roles

- `user` - default role for registered accounts
- `admin` - seeded on startup if `ADMIN_PASSWORD` is set (email: `admin@titan.local`)

### Authorization

| Endpoint | Auth Required |
|----------|--------------|
| `GET /api/rockets` | No |
| `GET /api/simulations` | No |
| `POST /api/custom-rockets` | Yes |
| `DELETE /api/custom-rockets/{id}` | Yes |
| `DELETE /api/simulations/{id}` | Yes |
| `GET /api/auth/me` | Yes |

## API Endpoints

### Rockets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rockets` | List all preset rockets (metadata) |
| GET | `/api/rockets/{id}` | Get rocket details with stage parameters |

### Custom Rockets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/custom-rockets` | No | List user-created rockets |
| GET | `/api/custom-rockets/{id}` | No | Get custom rocket details |
| POST | `/api/custom-rockets` | Yes | Create custom rocket |
| DELETE | `/api/custom-rockets/{id}` | Yes | Delete custom rocket |

### Simulations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/simulations` | No | List all saved simulations (summary) |
| GET | `/api/simulations/{id}` | No | Get full simulation with telemetry & events |
| POST | `/api/simulations` | No | Run synchronous simulation (blocking) |
| POST | `/api/simulations/compare` | No | Run multiple simulations for comparison |
| DELETE | `/api/simulations/{id}` | Yes | Delete a simulation |

### SignalR Hub

**Endpoint:** `/hubs/telemetry`

**Client invokes:**
- `RunSimulation(SimulationRequest)` - Start a real-time streaming simulation

**Server broadcasts:**
- `OnSimulationStart` - Simulation initialized (rocket name, target altitude)
- `OnTelemetryUpdate` - Telemetry snapshot (position, velocity, orbital elements, attitude, aero)
- `OnStageEvent` - Stage separation occurred (time, previous/new stage, description)
- `OnSimulationComplete` - Simulation finished (orbit achieved, final time, simulation ID)
- `OnSimulationError` - Simulation failed (error message)

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

### Core Functions

```
titan_create_simulation(config) → IntPtr
titan_add_stage(sim, stageConfig)
titan_step(sim) → TelemetryStruct
titan_get_telemetry(sim) → TelemetryStruct
titan_destroy(sim)
```

### 6DOF Functions

```
titan_set_initial_attitude(sim, w, x, y, z)
titan_add_reaction_wheel(sim, ax, ay, az, maxTorque, maxMomentum, wheelInertia)
titan_set_pointing_mode(sim, mode)
```

### Data Export

```
titan_export_csv(sim, filename) → int
titan_export_json(sim, filename) → int
```

The native library (`TitanPhysicsEngine.so/.dll/.dylib`) must be in the output directory or system library path.

## Database

The API supports two database providers:

| Mode | Provider | Connection |
|------|----------|------------|
| Local | SQLite | `titan.db` in app directory, auto-created |
| Docker | PostgreSQL 16 | Via `DATABASE_URL` environment variable |

**Tables:**
- `Users` - user accounts (id, email, username, passwordHash, role, createdAt)
- `Simulations` - simulation metadata and orbital results
- `SimulationTelemetry` - telemetry time series (FK to Simulations)
- `SimulationEvents` - stage events (FK to Simulations)
- `CustomRockets` - user-created rocket designs
- `CustomRocketStages` - stage parameters (FK to CustomRockets)

Unique constraints on `Users.Email` and `Users.Username`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Signing key for JWT tokens (min 32 characters) |
| `ADMIN_PASSWORD` | No | Seeds admin account on startup (`admin@titan.local`) |
| `DATABASE_URL` | Docker | PostgreSQL connection string |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `http://localhost:5173`) |

## CORS

Configured dynamically via `CORS_ORIGINS` environment variable:

- **Local default**: `http://localhost:5173` (Vite dev server)
- **Docker**: `http://localhost:3000,http://localhost:5173`
- Credentials enabled (for JWT tokens and SignalR WebSocket)
- Any headers and methods allowed
