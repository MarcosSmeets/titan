# Titan - Aerospace Physics Simulation Platform

Titan is a modular aerospace simulation platform that combines a high-fidelity C++ physics engine with a real-time .NET API and an interactive React frontend. It simulates rocket launches from liftoff through orbital insertion, with live telemetry streaming, trajectory visualization, and orbital mechanics analysis.

## Architecture

```
titan/
├── backend/
│   ├── Titan.PhysicsEngine/    C++20 physics engine (CMake)
│   └── Titan.API/              ASP.NET Core 8 API + SignalR hub
├── frontend/                   React + TypeScript + Vite
└── docs/
    ├── physics/                Physical models documentation
    └── architecture/           System architecture documentation
```

### Physics Engine (C++)

The core simulation engine implements:

- **Newtonian gravity** with inverse-square law, J2 oblateness perturbation
- **Atmospheric models** - exponential and US Standard Atmosphere 1976
- **Numerical integrators** - Euler, RK4, and adaptive RK45 (Dormand-Prince) with NaN/Inf safety checks
- **Guidance systems** - 3-phase gravity turn, PD-controlled target apoapsis, MaxQ throttle limiting
- **6DOF dynamics** - quaternion-based attitude with reaction wheel control and pointing modes
- **GNC subsystem** - navigator, PID attitude controller, actuator interfaces
- **Environmental forces** - Coriolis (rotating frame), wind models, solar radiation pressure
- **Orbital mechanics** - Keplerian element computation from Cartesian state
- **Multi-stage vehicles** with automatic stage separation and separation impulse
- **Event system** - EventBus, TelemetryBus, and FlightSequencer for event-driven simulation

No external dependencies. Pure C++20 standard library.

### API (.NET 8)

The API layer provides:

- **Authentication** - JWT-based auth with user registration, login, and BCrypt password hashing
- **SignalR WebSocket hub** for real-time telemetry streaming during simulation
- **REST endpoints** for rocket presets, custom rockets, simulation history
- **Database** - PostgreSQL (Docker) or SQLite (local development)
- **Native interop** (P/Invoke) to call the C++ physics engine

### Frontend (React + TypeScript)

The Mission Control Console interface features:

- **Trajectory Viewer** - interactive SVG with Earth, trajectory trail, predicted orbit, apo/periapsis markers
- **Real-time telemetry panels** - flight data, orbital parameters, attitude
- **NavBall** - KSP-style attitude indicator with roll/pitch/yaw and orbital markers
- **Chart strip** - tabbed Recharts graphs (altitude, velocity, orbit, attitude, aero)
- **Rocket Builder** - design custom multi-stage rockets
- **Simulation History** - replay and compare past launches
- **Authentication** - login/register pages with JWT token management

---

## Quick Start

### Option 1: Docker Compose (recommended)

The easiest way to run the entire platform. Requires only **Docker** and **Docker Compose**.

1. Copy the example environment file and set your secrets:

```bash
cp .env.example .env
# Edit .env to set POSTGRES_PASSWORD, JWT_SECRET, and ADMIN_PASSWORD
```

2. Build and start all services:

```bash
docker compose up --build
```

This builds and starts all services:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | React UI (nginx) |
| **API** | http://localhost:5000 | .NET 8 API + SignalR |
| **PostgreSQL** | localhost:5432 | Database (internal) |
| **Physics Engine** | *(built into API)* | C++ shared library |

Open http://localhost:3000 in your browser. Select a rocket, set a target orbit altitude, and launch.

To stop:

```bash
docker compose down
```

To rebuild after code changes:

```bash
docker compose up --build
```

### Option 2: Run locally

#### Prerequisites

- C++20 compiler (GCC 10+, Clang 12+)
- CMake 3.16+
- .NET 8 SDK
- Node.js 18+

#### 1. Physics Engine (shared library)

```bash
cd backend/Titan.PhysicsEngine
mkdir -p build && cd build
cmake ..
cmake --build .
```

This produces `libTitanPhysicsEngine.so` (Linux) or `.dylib` (macOS) in the `build/` directory.

#### 2. API Server

The API needs the C++ shared library on the library path and a JWT secret:

```bash
cd backend/Titan.API
JWT_SECRET="your-secret-key-min-32-chars-long" \
LD_LIBRARY_PATH=../Titan.PhysicsEngine/build dotnet run
# Runs on http://localhost:5000
```

In local mode, the API uses SQLite (`titan.db`) and seeds an admin account if `ADMIN_PASSWORD` is set.

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

Open http://localhost:5173 in your browser. The Vite dev server proxies `/api` and `/hubs` to the API on port 5000.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Secret key for JWT token signing (min 32 characters) |
| `ADMIN_PASSWORD` | Docker | Password for the seeded admin account |
| `POSTGRES_PASSWORD` | Docker | PostgreSQL database password |
| `DATABASE_URL` | Docker | PostgreSQL connection string (auto-configured in Docker) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins (default: `http://localhost:5173`) |

## How It Works

1. The user registers/logs in and selects a rocket preset or designs a custom vehicle
2. A `SimulationRequest` is sent via SignalR to the API
3. The API configures the C++ engine via native interop (P/Invoke)
4. The engine steps the simulation using RK45 with adaptive timestep and 6DOF attitude dynamics
5. Force models (gravity, drag, thrust, Coriolis, SRP, wind) are evaluated each step
6. GNC computes attitude commands; reaction wheels apply control torques
7. MaxQ throttle limiting reduces thrust during peak dynamic pressure
8. Telemetry is streamed back in real-time through SignalR at ~20 Hz
9. The frontend renders trajectory, telemetry, and charts live
10. On completion, results are persisted to the database for replay and comparison

## Rocket Presets

| Rocket | Manufacturer | Stages | Mass (kg) | Payload to LEO |
|--------|-------------|--------|-----------|----------------|
| Falcon 9 | SpaceX | 2 | 549,054 | 22,800 kg |
| Saturn V | Boeing/NA/Douglas | 3 | 2,970,000 | 140,000 kg |
| Electron | Rocket Lab | 2 | 12,550 | 300 kg |
| Ariane 5 | Airbus/Safran | 2 | 777,000 | 21,000 kg |
| Starship | SpaceX | 2 | 5,000,000 | 150,000 kg |

## Documentation

- [Physics Models](docs/physics/) - Gravity, atmosphere, integration, orbital mechanics, guidance, aerodynamics, GNC, environmental forces, events
- [Architecture](docs/architecture/) - System design, engine internals, API endpoints, frontend structure, authentication

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Physics Engine | C++20, CMake 3.16+ |
| API | ASP.NET Core 8, SignalR, EF Core, PostgreSQL/SQLite |
| Frontend | React 18, TypeScript, Vite 5, Recharts |
| Auth | JWT, BCrypt |
| Interop | P/Invoke (C# to native C++) |
| Containers | Docker, Docker Compose, PostgreSQL 16, nginx |

## License

This project is for educational and research purposes.
