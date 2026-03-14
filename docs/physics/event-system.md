# Event System

## Overview

Titan uses an event-driven architecture for communication between simulation subsystems. The event system consists of three components: **EventBus** for discrete simulation events, **TelemetryBus** for continuous telemetry data, and **FlightSequencer** for timed and conditional event scheduling.

## EventBus

The EventBus implements a publish-subscribe pattern for simulation events.

### Interface

```cpp
class EventBus {
    void Subscribe(EventType type, Handler handler);
    void SubscribeAll(Handler handler);
    void Emit(const SimEvent &event);
    void ScheduleEvent(double time, SimEvent event);
    void ProcessScheduledEvents(double currentTime);
    const std::vector<SimEvent> &GetEventLog() const;
    void ClearLog();
};
```

### Event Types

```cpp
enum class EventType {
    StageIgnition,         // New stage engine start
    StageSeparation,       // Stage jettisoned
    StageBurnout,          // Stage fuel depleted
    MaxQ,                  // Peak dynamic pressure passed
    FairingJettison,       // Payload fairing released
    OrbitInsertion,        // Orbit criteria met
    Impact,                // Vehicle hit the surface
    SimulationStart,       // Simulation initialized
    SimulationEnd,         // Simulation complete
    GuidancePhaseChange,   // Guidance switched phases
    ThrottleChange,        // Throttle level changed
    Custom                 // User-defined event
};
```

### SimEvent

Events carry metadata:

```cpp
struct SimEvent {
    EventType type;
    double time;               // Simulation time (seconds)
    std::string description;   // Human-readable description
    std::map<std::string, double> data;  // Key-value data pairs

    SimEvent &WithData(const std::string &key, double value);
};
```

### Usage

```cpp
// Subscribe to specific events
eventBus.Subscribe(EventType::StageSeparation, [](const SimEvent &e) {
    std::cout << "Stage separated at T+" << e.time << "s\n";
});

// Subscribe to all events
eventBus.SubscribeAll([](const SimEvent &e) {
    log(e);
});

// Emit an event
eventBus.Emit(SimEvent{EventType::MaxQ, currentTime, "Maximum dynamic pressure"}
    .WithData("maxQ_Pa", 32500.0));
```

### Scheduled Events

Events can be scheduled for future times:

```cpp
eventBus.ScheduleEvent(120.0, SimEvent{EventType::FairingJettison, 120.0, "Fairing jettison"});
```

Scheduled events are processed during each simulation step when the current time reaches or exceeds the scheduled time.

### Event Log

All emitted events are stored in a log accessible via `GetEventLog()`. This log is used by the C API to populate event data in telemetry output and is available for post-simulation analysis.

## TelemetryBus

The TelemetryBus provides channel-based publish-subscribe for continuous telemetry data.

### Interface

```cpp
struct TelemetryRecord {
    std::string channel;
    double time;
    TelemetryValue value;
};

class TelemetryBus {
    void Publish(const std::string &channel, double time, const TelemetryValue &value);
    void Subscribe(const std::string &channel, TelemetryCallback callback);
    void SubscribeAll(TelemetryCallback callback);
    const std::vector<TelemetryRecord> &GetRecords() const;
};
```

### Channels

Telemetry is organized by named channels:

| Channel | Data |
|---------|------|
| `position` | x, y, z (meters) |
| `velocity` | vx, vy, vz (m/s) |
| `orbital` | a, e, i, RAAN, omega, nu |
| `attitude` | quaternion w, x, y, z |
| `angular_velocity` | wx, wy, wz (rad/s) |
| `aero` | dynamic pressure, Mach |
| `vehicle` | stage index, mass, fuel remaining |
| `wheels` | wheel speeds, momenta |

### Usage

```cpp
// Subscribe to a specific channel
telemetryBus.Subscribe("orbital", [](const std::string &ch, double t, const TelemetryValue &v) {
    // Process orbital telemetry
});

// Publish telemetry
telemetryBus.Publish("position", time, {state.position.x, state.position.y, state.position.z});
```

### Record Storage

All published telemetry is stored in a record buffer, accessible via `GetRecords()`. This is used by the data export functions (`titan_export_csv`, `titan_export_json`) to write complete telemetry histories.

## FlightSequencer

The FlightSequencer orchestrates timed and conditional events during a simulation, similar to a launch vehicle's flight computer sequence.

### Interface

```cpp
class FlightSequencer {
    void AddTimedEvent(double time, SimEvent event);
    void AddConditionalEvent(
        std::function<bool(const SimState &)> condition,
        SimEvent event);
    void Update(double currentTime, const SimState &state);
    void Reset();
};
```

### Timed Events

Events triggered at specific mission elapsed times:

```cpp
sequencer.AddTimedEvent(10.0, SimEvent{EventType::Custom, 10.0, "Roll program"});
sequencer.AddTimedEvent(120.0, SimEvent{EventType::FairingJettison, 120.0, "Fairing jettison"});
sequencer.AddTimedEvent(150.0, SimEvent{EventType::ThrottleChange, 150.0, "Throttle up"});
```

### Conditional Events

Events triggered when a state-based predicate becomes true:

```cpp
// Jettison fairing when altitude exceeds 100 km
sequencer.AddConditionalEvent(
    [](const SimState &s) {
        return s.position.Magnitude() - 6371000.0 > 100000.0;
    },
    SimEvent{EventType::FairingJettison, 0, "Fairing jettison (altitude trigger)"}
);

// Report orbit insertion when eccentricity drops below threshold
sequencer.AddConditionalEvent(
    [](const SimState &s) {
        auto oe = OrbitalMechanics::ComputeOrbitalElements(s.position, s.velocity, 3.986e14);
        return oe.eccentricity < 0.02;
    },
    SimEvent{EventType::OrbitInsertion, 0, "Orbit insertion"}
);
```

Conditional events fire once — after triggering, the condition is no longer evaluated.

### Integration with Simulation

The FlightSequencer's `Update()` method is called each simulation step. It:

1. Checks timed events against the current time
2. Evaluates conditional predicates against the current state
3. Emits triggered events through the EventBus

## MaxQ Detection

The simulation includes built-in MaxQ detection as a special case of the event system:

```
1. Track dynamic pressure each step
2. Record peak dynamic pressure
3. When current q drops to 95% of peak AND peak > 1 kPa:
   → Emit EventType::MaxQ with peak pressure data
4. Only fires once per simulation
```

This detects the moment of maximum aerodynamic loading and reports it as a mission event, visible in the frontend's event timeline.

## Event Flow Through the Stack

```
Physics Engine (C++)
  │
  ├── EventBus emits SimEvent
  │     │
  │     ├── FlightSequencer processes conditional triggers
  │     ├── Event callback (if set via C API)
  │     └── Event log stores event
  │
  ▼
C API (titan_step returns telemetry with event data)
  │
  ▼
.NET API (TelemetryHub)
  │
  ├── Detects stage changes → OnStageEvent
  └── On completion → OnSimulationComplete (includes events)
  │
  ▼
React Frontend
  │
  └── MissionEventTimeline renders events with timestamps
```
