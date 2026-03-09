# Frontend Architecture

## Overview

The Titan frontend is a React 18 + TypeScript application built with Vite. It implements a Mission Control Console interface for real-time rocket simulation monitoring.

## Technology Stack

| Technology | Purpose |
|-----------|---------|
| React 18 | Component framework |
| TypeScript 5.3 | Type safety |
| Vite 5 | Dev server, bundling |
| Recharts 2.10 | Line charts for telemetry |
| @microsoft/signalr 8.0 | Real-time WebSocket streaming |

## Component Architecture

```
App
├── Nav bar (page navigation, MET clock, status badge)
├── HeroSection (launch page)
│   ├── Rocket selection grid
│   ├── LaunchConfig (target altitude, integrator, guidance)
│   └── Custom rocket management
├── SimulationPage (mission control console)
│   ├── Header bar (TITAN MCC, rocket name, status, MET, buttons)
│   ├── Main area (flex row)
│   │   ├── TrajectoryViewer (60%, SVG interactive map)
│   │   └── Right panel (40%, scrollable)
│   │       ├── Panel: FLT TELEMETRY (8 data fields)
│   │       ├── Panel: ORB PARAMS (8 data fields)
│   │       ├── Panel: NAVBALL (attitude indicator)
│   │       └── Panel: MISSION EVENTS (timeline)
│   ├── Chart strip (200px, 5 tabs)
│   └── Modal overlays (Editor, Compare, Advisor)
├── SimulationHistory (browse & replay)
├── HowItWorks (educational content)
└── RocketBuilderModal (custom rocket designer)
```

## State Management

Pure React state (useState + useRef). No external state library.

### App-Level State

```typescript
rockets: RocketPreset[]          // Preset catalog
telemetry: TelemetryPoint[]      // Current simulation data
simState: SimulationState        // idle|connecting|running|complete|failed
events: StageEvent[]             // Stage separations
rocketName: string               // Current rocket name
orbitResult: {achieved, time}    // Orbit status
page: AppPage                    // Current view
lastRequest: SimulationRequest   // For re-launch/editing
```

### Performance: Ref-Based Batching

During live simulation, telemetry arrives at ~20 Hz. To avoid excessive re-renders:

```typescript
const telemetryRef = useRef<TelemetryPoint[]>([]);

onTelemetry: (point) => {
    telemetryRef.current = [...telemetryRef.current, point];
    setTelemetry([...telemetryRef.current]);  // Single state update
}
```

### Derived State (useMemo)

Heavy computations are memoized:
- `stageMarkers` - trajectory SVG markers from events
- `chartData` - transformed telemetry for Recharts
- `euler` - quaternion-to-Euler conversion
- `maxQ`, `maxG` - aggregated peak values
- `orbitPrediction` - Keplerian orbit from latest state

## Data Flow

### Launch Flow

```
User → HeroSection → handleLaunch(request)
    → SignalR: RunSimulation(request)
    → Hub: OnSimulationStart → setSimState('running')
    → Hub: OnTelemetryUpdate (streaming) → append to telemetry[]
    → Hub: OnStageEvent → append to events[]
    → Hub: OnSimulationComplete → setSimState('complete')
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

Interactive SVG rendering of the simulation in 2D:

- **Earth**: gradient-filled circle with continent hints, atmosphere glow
- **Trajectory**: polyline trail with gradient coloring
- **Predicted orbit**: Keplerian ellipse from current position/velocity
- **Markers**: apoapsis, periapsis, stage separations, launch site
- **Velocity vector**: arrow showing current direction
- **Altitude rings**: 100 km Karman line, target orbit
- **Controls**: scroll to zoom, drag to pan, FIT button to reset

All rendering uses SVG viewBox scaling — responsive to container size.

### NavBall

180px SVG attitude indicator inspired by KSP:

- Sky (blue) / ground (brown) split by pitch
- Inner group rotated by roll
- Pitch ladder lines every 10 degrees
- Heading markers at 30-degree intervals with N/E/S/W labels
- Roll indicator ticks with triangle pointer
- Fixed crosshair reticle (orange #ffaa00)
- Digital readouts: R/P/Y in degrees

### Chart Strip

Tabbed Recharts line charts at bottom of SimulationPage:

| Tab | Lines |
|-----|-------|
| ALTITUDE | Altitude, Apoapsis, Periapsis (km) |
| VELOCITY | Velocity (m/s) |
| ORBIT | Eccentricity, Inclination (deg) |
| ATTITUDE | Roll, Pitch, Yaw (deg) |
| AERO | Dynamic Pressure (kPa), Mach |

Stage separation events shown as reference lines on all charts.

### Modal Overlays

Triggered by header buttons, rendered as fixed-position overlays:

- **EDIT**: Modify stage parameters and target altitude, re-launch
- **CMP**: Select saved simulations to compare
- **ADV**: Orbit advisor with tips and per-stage analysis

## Services Layer

### API Service (`services/api.ts`)

Fetch-based REST client:

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

Vite dev server proxies all API traffic:

```typescript
server: {
    proxy: {
        '/api': 'http://localhost:5000',
        '/hubs': { target: 'http://localhost:5000', ws: true }
    }
}
```

## Styling

All styling is inline CSS (React CSSProperties objects). No CSS files or CSS-in-JS libraries.

Color palette:
- Background: `#0a0a14`, `#08080e`
- Panels: `#0a0a12`, `#0a0a16`
- Borders: `#151520`, `#1a1a2e`
- Text primary: `#dde`, `#fff`
- Text secondary: `#556`, `#445`
- Accent blue: `#4488ff`
- Accent green: `#44cc66`, `#22aa44`
- Accent orange: `#ffaa00`
- Accent red: `#ff4444`
- Accent purple: `#aa44ff`
- Monospace: JetBrains Mono, Fira Code, Cascadia Code
