# Guidance Systems

## Overview

Titan implements guidance systems that compute thrust direction from the current vehicle state. Guidance determines the pitch angle (or full 3D direction) to steer the rocket from launch to orbit.

## Interface

All guidance systems implement:

```cpp
class Guidance {
    virtual double ComputePitchAngle(const State &state, double mu) = 0;
    virtual Vector3 ComputeThrustDirection(const State &state, double mu);
};
```

The default `ComputeThrustDirection` converts pitch angle to a 3D vector using the local vertical/horizontal frame:

```
direction = up * sin(pitch) + east * cos(pitch)
```

Where `up` is the radial unit vector and `east` is the velocity-tangent direction.

## Orbital Circularization Guidance

The primary guidance for launch-to-orbit. Two-phase approach:

### Phase 1: Gravity Turn

While apoapsis < target altitude:

```
t = altitude / target_altitude      (progress factor, 0 to 1)
pitch = (1 - t) * pi/2             (starts vertical, pitches over)
```

At launch (t = 0): pitch = 90 deg (vertical).
At target altitude (t = 1): pitch = 0 deg (horizontal).

The gravity turn is a natural and efficient trajectory. As the rocket gains altitude, it progressively tilts from vertical to horizontal, trading vertical climb for horizontal orbital velocity.

### Phase 2: Circularization

When apoapsis >= target but periapsis < 90% of target:

```
pitch = 0  (pure prograde burn)
```

Burns horizontally to raise the periapsis and circularize the orbit.

### Phase 3: Complete

When both apoapsis and periapsis are near target:

```
pitch = 0  (coast or shut down)
```

### Gravity Turn Physics

The gravity turn is efficient because:
1. Thrust is always along the velocity vector (minimizes gravity losses)
2. Gravity naturally curves the trajectory from vertical to horizontal
3. No steering losses from fighting the natural trajectory shape

Real-world gravity turns begin with a small initial kick (pitch-over maneuver) at ~100 m altitude, then follow the velocity vector.

## Target Apoapsis Guidance

Proportional feedback controller targeting a specific apoapsis altitude:

```
apoapsis_error = target_apoapsis - current_apoapsis
pitch = Kp * apoapsis_error
```

Where Kp is a proportional gain tuned for stability.

- When apoapsis is below target: positive pitch (climb)
- When apoapsis is above target: negative pitch (flatten)

This guidance is simpler but less efficient than orbital circularization. It's useful for reaching a specific apoapsis without full circularization.

## Thrust Direction in 3D

For 3D vehicles, the guidance pitch angle is converted to a thrust direction in the local orbital frame:

```
r_hat = position / |position|          (radial up)
h_hat = (position x velocity) / |...|  (orbit normal)
theta_hat = h_hat x r_hat              (along-track)

thrust_direction = r_hat * sin(pitch) + theta_hat * cos(pitch)
```

## G-Load Limiting

The simulation supports maximum G-load limits (default: 4.0g). When acceleration exceeds the limit, throttle is reduced:

```
if (acceleration > maxG * g0):
    throttle = maxG * g0 * mass / max_thrust
```

This protects the payload and crew from excessive forces.

## Delta-V Considerations

### Gravity Losses

Thrusting against gravity (vertical component) wastes delta-v:

```
delta_v_gravity_loss = integral(g * sin(gamma) * dt)
```

Where gamma is the flight path angle. Minimized by pitching over early (but not too early, or drag increases).

### Drag Losses

Atmospheric drag removes kinetic energy:

```
delta_v_drag_loss = integral(D / m * dt)
```

Minimized by reaching altitude quickly before building horizontal speed.

### Optimal Trajectory

The optimal balance minimizes the sum of gravity and drag losses. For typical LEO missions:
- Gravity losses: ~1,200 m/s
- Drag losses: ~100-400 m/s
- Steering losses: ~50-200 m/s

Total delta-v budget: ~9,400 m/s (for ~200 km circular orbit)
