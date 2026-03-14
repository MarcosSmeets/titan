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

The primary guidance for launch-to-orbit. Three-phase approach:

### Phase 1: Vertical Hold

While altitude < kick altitude (500 m):

```
pitch = pi/2  (90 degrees, straight up)
```

The rocket ascends vertically to clear the launch pad and build initial velocity before beginning the gravity turn. This prevents premature pitchover at low altitude where aerodynamic forces would be dangerous.

### Phase 2: Gravity Turn

While apoapsis < target altitude:

The gravity turn uses two sub-modes based on altitude:

**Below 50 km (atmospheric):** Altitude-scheduled pitch

```
altFraction = clamp(altitude / targetAltitude, 0, 1)
pitch = (1 - altFraction) * pi/2
```

At launch (altFraction = 0): pitch = 90 deg (vertical).
At target altitude (altFraction = 1): pitch = 0 deg (horizontal).

The pitch schedule gradually tilts the rocket from vertical to horizontal as it gains altitude, trading vertical climb for horizontal orbital velocity.

**Above 50 km (exoatmospheric):** Velocity-following

```
pitch = angle between velocity vector and local horizontal
```

Once above the dense atmosphere, the rocket follows its velocity vector (zero angle of attack). This is the most efficient trajectory because thrust is always aligned with motion, minimizing steering losses.

### Phase 3: Circularization

When apoapsis >= target but periapsis < 90% of target:

```
pitch = 0  (pure prograde burn)
```

Burns horizontally to raise the periapsis and circularize the orbit. Once both apoapsis and periapsis are near target, the guidance considers the orbit complete.

### Gravity Turn Physics

The gravity turn is efficient because:
1. Thrust is always along the velocity vector (minimizes gravity losses)
2. Gravity naturally curves the trajectory from vertical to horizontal
3. No steering losses from fighting the natural trajectory shape

Real-world gravity turns begin with a small initial kick (pitch-over maneuver) at low altitude, then follow the velocity vector. Titan's 500 m kick altitude models this behavior.

## Target Apoapsis Guidance

PD (Proportional-Derivative) controller targeting a specific apoapsis altitude:

```
error = target_apoapsis - current_apoapsis
dApoapsis = current_apoapsis - previous_apoapsis

pitch = pi/2 - Kp * error - Kd * dApoapsis
```

Where:
- **Kp = 5e-7** — proportional gain on apoapsis error
- **Kd = 2e-4** — derivative gain on apoapsis rate of change

The derivative term provides damping:
- When apoapsis is below target: positive pitch (climb)
- When apoapsis is approaching target rapidly: derivative term reduces pitch to prevent overshoot
- When apoapsis is above target: negative pitch correction

Output is clamped to [0, pi/2] to prevent the rocket from pointing downward.

This guidance is simpler but less efficient than orbital circularization. It's useful for reaching a specific apoapsis without full circularization.

## MaxQ Throttle Bucket

During ascent through the peak dynamic pressure region, thrust is automatically throttled to reduce structural loads:

```
if altitude in [5 km, 20 km] AND q > 30 kPa:
    throttle = min(throttle, 0.70)
```

This reduces thrust to 70% when dynamic pressure exceeds 30 kPa in the 5-20 km altitude band. This mimics real launch vehicle profiles — for example, Falcon 9's throttle-down through max-Q.

The throttle bucket is only active during the max-Q altitude band and automatically releases as the rocket climbs into thinner atmosphere.

## Stage Separation Impulse

On stage separation, a small delta-v impulse is applied to ensure clean separation:

```
separation_delta_v = 2.0 m/s (along velocity vector)
```

This prevents the separated stage from interfering with the next stage's ignition. Real launch vehicles use separation motors or springs for this purpose.

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
