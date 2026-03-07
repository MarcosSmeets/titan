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
- **Numerical integrators** - Euler, RK4, and adaptive RK45 (Dormand-Prince)
- **Guidance systems** - orbital circularization and target apoapsis
- **6DOF dynamics** - quaternion-based attitude with reaction wheel control
- **Orbital mechanics** - Keplerian element computation from Cartesian state
- **Multi-stage vehicles** with automatic stage separation

No external dependencies. Pure C++20 standard library.

### API (.NET 8)

The API layer provides:

- **SignalR WebSocket hub** for real-time telemetry streaming during simulation
- **REST endpoints** for rocket presets, custom rockets, simulation history
- **SQLite persistence** for simulation results and custom rocket designs
- **Native interop** (P/Invoke) to call the C++ physics engine

### Frontend (React + TypeScript)

The Mission Control Console interface features:

- **Trajectory Viewer** - interactive SVG with Earth, trajectory trail, predicted orbit, apo/periapsis markers
- **Real-time telemetry panels** - flight data, orbital parameters, attitude
- **NavBall** - KSP-style attitude indicator with roll/pitch/yaw
- **Chart strip** - tabbed Recharts graphs (altitude, velocity, orbit, attitude, aero)
- **Rocket Builder** - design custom multi-stage rockets
- **Simulation History** - replay and compare past launches

## Quick Start

### Prerequisites

- C++20 compiler (GCC 10+, Clang 12+)
- CMake 3.16+
- .NET 8 SDK
- Node.js 18+

### Build & Run

**1. Physics Engine (shared library)**

```bash
cd backend/Titan.PhysicsEngine
mkdir -p build && cd build
cmake ..
cmake --build .
```

**2. API Server**

```bash
cd backend/Titan.API
dotnet run
# Runs on http://localhost:5000
```

**3. Frontend**

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

Open http://localhost:5173 in your browser. Select a rocket, set a target orbit altitude, and launch.

## How It Works

1. The user selects a rocket preset or designs a custom vehicle in the frontend
2. A `SimulationRequest` is sent via SignalR to the API
3. The API configures the C++ engine via native interop (P/Invoke)
4. The engine steps the simulation at configurable dt (default 0.05s) using RK45
5. Telemetry is streamed back in real-time through SignalR at ~20 Hz
6. The frontend renders trajectory, telemetry, and charts live
7. On completion, results are persisted to SQLite for replay and comparison

## Rocket Presets

| Rocket | Manufacturer | Stages | Mass (kg) | Payload to LEO |
|--------|-------------|--------|-----------|----------------|
| Falcon 9 | SpaceX | 2 | 549,054 | 22,800 kg |
| Saturn V | Boeing/NA/Douglas | 3 | 2,970,000 | 140,000 kg |
| Electron | Rocket Lab | 2 | 12,550 | 300 kg |
| Ariane 5 | Airbus/Safran | 2 | 777,000 | 21,000 kg |
| Starship | SpaceX | 2 | 5,000,000 | 150,000 kg |

## Documentation

- [Physics Models](docs/physics/) - Gravity, atmosphere, integration, orbital mechanics, guidance, aerodynamics
- [Architecture](docs/architecture/) - System design, engine internals, API endpoints, frontend structure

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Physics Engine | C++20, CMake 3.16+ |
| API | ASP.NET Core 8, SignalR, EF Core, SQLite |
| Frontend | React 18, TypeScript, Vite 5, Recharts |
| Interop | P/Invoke (C# to native C++) |

## License

This project is for educational and research purposes.
