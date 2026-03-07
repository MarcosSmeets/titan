# Titan Frontend

React + TypeScript Mission Control Console for the Titan aerospace simulation platform. Provides real-time trajectory visualization, telemetry dashboards, and rocket design tools.

## Run

```bash
npm install
npm run dev
# http://localhost:5173
```

Requires the API running on `http://localhost:5000`.

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
├── App.tsx                     Main app + SimulationPage (MCC layout)
├── types/index.ts              TypeScript interfaces
├── services/
│   ├── api.ts                  REST API client
│   └── signalr.ts              SignalR WebSocket client
└── components/
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

### Launch Page

Rocket selection grid with preset rockets (Falcon 9, Saturn V, Electron, Ariane 5, Starship) and custom rocket management. Target altitude input, integrator/guidance selection, and launch trigger.

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

## Data Flow

```
User clicks LAUNCH
  └─► SignalR: RunSimulation(request)
        └─► API: Creates C++ simulation, starts stepping
              └─► SignalR: OnSimulationStart
              └─► SignalR: OnTelemetryUpdate (streaming ~20 Hz)
              │     └─► App state: telemetry[] grows
              │           └─► TrajectoryViewer re-renders
              │           └─► Telemetry panels update
              │           └─► Charts update
              └─► SignalR: OnStageEvent
              │     └─► Events timeline updates
              └─► SignalR: OnSimulationComplete
                    └─► simState = 'complete'
                    └─► Result saved to DB
```

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
