# Titan Frontend

React + TypeScript Mission Control Console for the Titan aerospace simulation platform. Provides real-time trajectory visualization, telemetry dashboards, rocket design tools, and user authentication.

## Run

```bash
npm install
npm run dev
# http://localhost:5173
```

Requires the API running on `http://localhost:5000`.

### Docker

The frontend runs as part of the Docker Compose stack served by nginx:

```bash
# From the project root
docker compose up --build
# Frontend available at http://localhost:3000
```

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.2 | UI framework |
| TypeScript | 5.3 | Type safety |
| Vite | 5.0 | Dev server & bundler |
| Recharts | 2.10 | Telemetry charts |
| @microsoft/signalr | 8.0 | Real-time telemetry streaming |

## Architecture

```
src/
├── App.tsx                     Main app + routing
├── types/index.ts              TypeScript interfaces
├── context/
│   ├── AuthContext.tsx          JWT auth state (user, login, logout)
│   └── SimulationContext.tsx    Simulation state (telemetry, events, launch/replay)
├── services/
│   ├── api.ts                  REST API client
│   ├── auth.ts                 Auth API client (login, register, token storage)
│   └── signalr.ts              SignalR WebSocket client
└── components/
    ├── LoginPage.tsx           Email/password login form
    ├── RegisterPage.tsx        Registration with password validation
    ├── HeroSection.tsx         Landing page, rocket selection, launch
    ├── TrajectoryViewer.tsx    Interactive SVG trajectory + Earth + orbit
    ├── NavBall.tsx             KSP-style attitude indicator
    ├── MissionEventTimeline.tsx Vertical event timeline
    ├── TelemetryDashboard.tsx  Collapsible Recharts charts
    ├── RocketBuilder.tsx       Custom rocket design modal
    ├── SimulationHistory.tsx   Browse & replay past launches
    ├── RocketComparison.tsx    Multi-rocket comparison
    ├── LaunchConfig.tsx        Mission parameter configuration
    └── HowItWorks.tsx          Educational physics content
```

## Pages

### Login / Register

- **LoginPage** - email and password form, JWT token storage on success, error display
- **RegisterPage** - email, username, password with client-side validation (8+ chars, uppercase, lowercase, digit)

### Launch Page

Rocket selection grid with preset rockets (Falcon 9, Saturn V, Electron, Ariane 5, Starship) and custom rocket management. Target altitude input, integrator/guidance selection, and launch trigger. Custom rocket creation requires authentication.

### Simulation Page (Mission Control Console)

Dense professional layout:

```
+------------------------------------------------------------------+
| HEADER: TITAN MCC | RocketName | Status | MET T+00:00 | STAGE    |
+-------------------------------+----------------------------------+
|                               | FLT TELEMETRY                    |
|                               |  ALT  VEL  V/V  V/H  MACH  Q   |
|   TRAJECTORY VIEWER           +----------------------------------+
|   (60% width)                 | ORB PARAMS                       |
|   - Earth + atmosphere        |  APO  PERI  ECC  INC  SMA  RAAN |
|   - Trajectory trail          +----------------------------------+
|   - Predicted orbit           | NAVBALL (180px)                  |
|   - Velocity vector           |  Roll/Pitch/Yaw readouts         |
|   - Apo/Peri markers          +----------------------------------+
|   - Stage markers             | MISSION EVENTS (timeline)        |
+-------------------------------+----------------------------------+
| CHART STRIP (tabbed: altitude | velocity | orbit | attitude | aero)|
+------------------------------------------------------------------+
```

**Modal overlays** (triggered from header buttons):
- **EDIT** - modify rocket parameters and re-launch
- **CMP** - compare with past simulation telemetry
- **ADV** - orbit advisor with tips and per-stage analysis

### History Page

Browse saved simulations with stats (success rate, total launches). Replay any simulation with full telemetry.

### How It Works

Educational content explaining the physics models, guidance systems, and orbital mechanics.

## State Management

### AuthContext

Manages user authentication state:

```typescript
interface AuthContextType {
  user: User | null;       // { username, email, role }
  login: (user: User) => void;
  logout: () => void;
}
```

On mount, reads the JWT from `localStorage`, parses claims, and restores the user session. Provides `user`, `login`, and `logout` to the component tree.

### SimulationContext

Manages simulation state and telemetry streaming:

```typescript
interface SimulationContextType {
  telemetry: TelemetryPoint[];
  simState: SimulationState;  // idle | connecting | running | complete | failed
  events: StageEvent[];
  rocketName: string;
  orbitResult: { achieved: boolean; time: number } | null;
  lastRequest: SimulationRequest | null;
  isActive: boolean;
  handleLaunch: (request: SimulationRequest) => Promise<void>;
  handleReplay: (...) => void;
  reset: () => void;
}
```

Integrates with SignalR for streaming telemetry during live simulations and supports replay of saved simulations.

### Performance: Ref-Based Batching

During live simulation, telemetry arrives at ~20 Hz. To avoid excessive re-renders:

```typescript
const telemetryRef = useRef<TelemetryPoint[]>([]);

onTelemetry: (point) => {
    telemetryRef.current = [...telemetryRef.current, point];
    setTelemetry([...telemetryRef.current]);  // Single state update
}
```

## Data Flow

### Auth Flow

```
User → LoginPage → auth.login(email, password)
  → POST /api/auth/login → JWT token
  → setToken(localStorage) → AuthContext.login(user)
  → Redirect to Launch page
```

### Launch Flow

```
User clicks LAUNCH
  └─► SignalR: RunSimulation(request)
        └─► API: Creates C++ simulation, starts stepping
              └─► SignalR: OnSimulationStart
              └─► SignalR: OnTelemetryUpdate (streaming ~20 Hz)
              │     └─► SimulationContext: telemetry[] grows
              │           └─► TrajectoryViewer re-renders
              │           └─► Telemetry panels update
              │           └─► Charts update
              └─► SignalR: OnStageEvent
              │     └─► Events timeline updates
              └─► SignalR: OnSimulationComplete
                    └─► simState = 'complete'
                    └─► Result saved to DB
```

### Replay Flow

```
User → SimulationHistory → fetchSimulationById(id)
  → handleReplay(telemetry, events, ...)
  → setTelemetry(fullArray), setSimState('complete')
  → SimulationPage renders with complete data
```

## Key Components

### TrajectoryViewer

Interactive SVG renderer showing:
- Earth with continent hints and atmosphere glow
- Trajectory trail with gradient coloring
- Predicted Keplerian orbit (computed from current state)
- Target orbit ring (dashed green)
- Apoapsis/periapsis markers with distance labels
- Velocity vector arrow
- Stage separation markers
- Altitude reference rings (100 km Karman line, target)
- Zoom (scroll wheel) and pan (drag) controls

### NavBall

KSP-style spherical attitude indicator (180px SVG):
- Blue sky / brown ground hemisphere split
- Horizon line driven by pitch
- Pitch ladder lines every 10 degrees
- Cardinal direction labels (N/E/S/W) positioned by yaw
- Roll indicator ring with triangle pointer
- Fixed crosshair reticle
- Digital roll/pitch/yaw readouts

### MissionEventTimeline

Vertical timeline with:
- Color-coded dots (amber = staging, green = orbit, blue = default)
- MET timestamps in monospace
- Stage badges
- Auto-scroll during live simulation

## Services Layer

### Auth Service (`services/auth.ts`)

```typescript
login(email, password)     // POST /api/auth/login → AuthResponse
register(email, username, password)  // POST /api/auth/register → AuthResponse
getToken()                 // Read JWT from localStorage
setToken(token)            // Store JWT in localStorage
clearToken()               // Remove JWT
parseToken(jwt)            // Decode claims (sub, email, username, role)
```

### API Service (`services/api.ts`)

```typescript
fetchRockets()                    // GET /api/rockets
fetchSimulations()                // GET /api/simulations
fetchSimulationById(id)           // GET /api/simulations/{id}
saveCustomRocket(name, stages)    // POST /api/custom-rockets
deleteSimulation(id)              // DELETE /api/simulations/{id}
```

### SignalR Service (`services/signalr.ts`)

Singleton `HubConnection` to `/hubs/telemetry`:

```typescript
runStreamingSimulation(request, {
    onStart, onTelemetry, onStageEvent, onComplete, onError
})
```

Event handlers registered before invocation, cleaned up on completion.

## Proxy Configuration

Vite proxies API calls to the backend:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:5000',
    '/hubs': { target: 'http://localhost:5000', ws: true }
  }
}
```
