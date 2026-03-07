# Gravity Models

## Overview

Titan implements three levels of gravitational modeling, from simple constant gravity to J2-perturbed fields.

## 1. Constant Surface Gravity

Used in the 1D model for quick approximations:

```
g = 9.80665 m/s^2
W = m * g
```

## 2. Inverse-Square Law (Point Mass)

The primary gravity model for orbital simulations:

```
g(h) = GM / (R + h)^2
```

Where:
- G = 6.67430 x 10^-11 m^3/(kg*s^2) (gravitational constant)
- M = 5.972 x 10^24 kg (Earth mass)
- R = 6,371,000 m (Earth radius)
- h = altitude above surface (m)

As a vector force:

```
F = -mu * m / |r|^3 * r
```

Where mu = GM = 3.986004418 x 10^14 m^3/s^2

### Implementation

The `PointMassGravity` class takes mu as constructor parameter:

```cpp
Vector3 ComputeForce(const SimState &state, double time) const {
    double r = state.position.Magnitude();
    return state.position * (-m_mu * state.mass / (r * r * r));
}
```

### Variation with Altitude

| Altitude | g (m/s^2) | % of surface |
|----------|-----------|-------------|
| 0 km | 9.807 | 100% |
| 100 km | 9.504 | 96.9% |
| 200 km | 9.209 | 93.9% |
| 400 km (ISS) | 8.640 | 88.1% |
| 35,786 km (GEO) | 0.224 | 2.3% |

## 3. J2 Oblateness Perturbation

Earth is not a perfect sphere — it bulges at the equator. The J2 coefficient captures the dominant oblateness effect:

```
J2 = 1.08263 x 10^-3
```

The J2 perturbation adds correction terms to the point-mass acceleration:

```
a_J2_x = -3/2 * J2 * mu * Re^2 / r^5 * x * (1 - 5*z^2/r^2)
a_J2_y = -3/2 * J2 * mu * Re^2 / r^5 * y * (1 - 5*z^2/r^2)
a_J2_z = -3/2 * J2 * mu * Re^2 / r^5 * z * (3 - 5*z^2/r^2)
```

Where Re is Earth's equatorial radius and (x, y, z) is the position vector.

### Effects of J2

- **RAAN regression**: The ascending node drifts westward for prograde orbits
- **Argument of periapsis rotation**: Apsidal line precesses
- **Sun-synchronous orbits**: Specific inclination where RAAN drift matches Earth's orbital rate

### Implementation

The `J2Gravity` class extends point-mass gravity:

```cpp
J2Gravity(double mu, double bodyRadius, double J2);
J2Gravity(const CelestialBody &body);  // Uses body.mu, body.radius, body.J2
```

## Celestial Body Parameters

| Body | mu (m^3/s^2) | Radius (m) | J2 |
|------|-------------|-----------|-----|
| Earth | 3.986e14 | 6,371,000 | 1.08263e-3 |
| Moon | 4.905e12 | 1,737,400 | 2.027e-4 |
| Mars | 4.283e13 | 3,389,500 | 1.964e-3 |

## Energy Conservation

For a conservative gravitational field, specific orbital energy is conserved:

```
epsilon = v^2/2 - mu/r = constant
```

This relationship connects velocity and position at any point in an orbit, and is used in orbital element computation.
