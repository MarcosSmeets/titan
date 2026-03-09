# Orbital Mechanics

## Overview

Titan computes classical Keplerian orbital elements from Cartesian state vectors (position and velocity). This enables real-time orbit characterization during simulation.

## Cartesian to Keplerian Conversion

Given position vector **r** and velocity vector **v** in an inertial frame:

### Step 1: Fundamental Quantities

```
r = |r|                          (distance from center)
v = |v|                          (speed)
epsilon = v^2/2 - mu/r          (specific orbital energy)
h = r x v                       (specific angular momentum vector)
h = |h|                         (angular momentum magnitude)
```

### Step 2: Eccentricity Vector

```
e = (v x h)/mu - r/r
e = |e|                          (eccentricity)
```

The eccentricity vector points from the center of attraction toward periapsis.

### Step 3: Semi-Major Axis

```
a = -mu / (2 * epsilon)         (for elliptical orbits, epsilon < 0)
```

For parabolic orbits (e = 1): a is undefined.
For hyperbolic orbits (e > 1): a is negative.

### Step 4: Apoapsis and Periapsis

```
r_apoapsis  = a * (1 + e)       (farthest point)
r_periapsis = a * (1 - e)       (closest point)
```

These are distances from the center of the body. Altitude = r - R_body.

### Step 5: Inclination

```
i = arccos(h_z / |h|)
```

- i = 0: equatorial orbit
- i = 90 deg: polar orbit
- i > 90 deg: retrograde orbit

### Step 6: Node Vector and RAAN

The node vector points toward the ascending node:

```
n = k x h                       (where k = [0, 0, 1])
```

Right Ascension of Ascending Node:

```
RAAN = arccos(n_x / |n|)
if n_y < 0: RAAN = 2*pi - RAAN
```

### Step 7: Argument of Periapsis

```
omega = arccos(n . e / (|n| * |e|))
if e_z < 0: omega = 2*pi - omega
```

### Step 8: True Anomaly

```
nu = arccos(e . r / (|e| * |r|))
if r . v < 0: nu = 2*pi - nu
```

## Orbital Elements Summary

| Element | Symbol | Description | Range |
|---------|--------|-------------|-------|
| Semi-major axis | a | Size of orbit | > 0 (elliptical) |
| Eccentricity | e | Shape of orbit | 0 = circle, 0-1 = ellipse |
| Inclination | i | Tilt from equator | 0 - 180 deg |
| RAAN | Omega | Ascending node angle | 0 - 360 deg |
| Arg of periapsis | omega | Periapsis rotation | 0 - 360 deg |
| True anomaly | nu | Position in orbit | 0 - 360 deg |

## Orbit Types by Eccentricity

| Eccentricity | Orbit Type | Energy |
|-------------|-----------|--------|
| e = 0 | Circular | epsilon < 0 |
| 0 < e < 1 | Elliptical | epsilon < 0 |
| e = 1 | Parabolic | epsilon = 0 |
| e > 1 | Hyperbolic | epsilon > 0 |

## Orbit Achievement Criteria

Titan declares orbit achieved when:

```
periapsis_altitude > 180 km
eccentricity < 0.02
```

This ensures a stable, near-circular Low Earth Orbit that won't decay rapidly due to atmospheric drag.

## Circular Orbital Velocity

For a circular orbit at altitude h:

```
v_circular = sqrt(mu / (R + h))
```

| Altitude | v_circular (m/s) |
|----------|-----------------|
| 200 km | 7,784 |
| 400 km | 7,669 |
| 35,786 km (GEO) | 3,075 |

## Delta-V Budget for LEO

Total delta-v required from surface to LEO at ~200 km:

```
Orbital velocity:    ~7,800 m/s
Gravity losses:      ~1,200 m/s
Drag losses:         ~100-400 m/s
─────────────────────────────────
Total:               ~9,400 m/s
```

## 2D vs 3D Computation

Titan supports both:

- **2D overload**: Position and velocity in the XY plane. Inclination is undefined. Uses scalar angular momentum h = x*vy - y*vx.
- **3D overload**: Full 3D vectors. Computes all six classical elements including inclination, RAAN, and argument of periapsis.

## Predicted Orbit Visualization

The frontend computes predicted orbits from the current state by tracing the Keplerian ellipse:

```
r(theta) = p / (1 + e * cos(theta))
```

Where p = h^2/mu is the semi-latus rectum. Points are rotated by the argument of periapsis to align with the inertial frame.
