# Aerodynamic Models

## Overview

Titan models atmospheric drag forces acting on the rocket during ascent. Drag is critical in the lower atmosphere and becomes negligible above ~100 km.

## Drag Force

The fundamental drag equation:

```
D = 0.5 * rho * v^2 * Cd * A
```

Where:
- rho = air density at current altitude (kg/m^3)
- v = airspeed (m/s)
- Cd = drag coefficient (dimensionless)
- A = reference area (cross-sectional area, m^2)

Drag direction is always opposite to the velocity vector:

```
F_drag = -D * v_hat
```

## Dynamic Pressure

Dynamic pressure (q) represents the aerodynamic load on the vehicle:

```
q = 0.5 * rho * v^2   (Pa)
```

**Max-Q** is the point of maximum aerodynamic stress during ascent. For typical orbital launches, max-Q occurs around 11-14 km altitude and Mach 1.2-1.5.

| Vehicle | Typical Max-Q |
|---------|-------------|
| Falcon 9 | ~30 kPa |
| Saturn V | ~33 kPa |
| Space Shuttle | ~35 kPa |

## Mach-Dependent Drag Coefficient

Real rockets experience varying drag coefficients with Mach number due to compressibility effects:

```
Cd(M) varies as:
  - Subsonic (M < 0.8):     Cd ~ constant (base value)
  - Transonic (0.8 < M < 1.2): Cd increases sharply (wave drag)
  - Supersonic (M > 1.2):   Cd decreases gradually
```

Titan implements a default Mach-Cd function:

```cpp
static CdFunction DefaultMachCd(double subsonicCd) {
    return [subsonicCd](double mach) -> double {
        if (mach < 0.8) return subsonicCd;
        if (mach < 1.2) return subsonicCd * (1 + 0.5 * (mach - 0.8) / 0.4);
        return subsonicCd * 1.2 / mach;  // gradual decrease
    };
}
```

## Mach Number Computation

```
M = v / a
```

Where `a` is the speed of sound, approximated from atmospheric temperature:

```
a = sqrt(gamma * R * T)
```

- gamma = 1.4 (ratio of specific heats for air)
- R = 287.05 J/(kg*K) (specific gas constant for air)
- T = temperature at altitude (from atmosphere model)

## Drag Coefficient Guidelines

| Cd Range | Vehicle Type |
|---------|-------------|
| 0.15 - 0.25 | Streamlined, low-drag (missile-like) |
| 0.25 - 0.40 | Typical launch vehicle |
| 0.40 - 0.60 | Blunt or wide payload fairing |
| > 0.60 | Unconventional shapes |

## Impact on Delta-V

Drag losses for typical orbital launches:

```
delta_v_drag = integral(D / m * dt) ~ 100-400 m/s
```

This is relatively small compared to gravity losses (~1,200 m/s) but significant enough to affect orbit insertion.

Strategies to minimize drag losses:
- **Slim vehicles**: Lower reference area and Cd
- **Fast ascent through lower atmosphere**: Higher TWR in stage 1
- **Altitude before speed**: Reach thin atmosphere before accelerating horizontally

## Atmospheric Density Profile

Drag decreases exponentially with altitude because density falls off:

| Altitude | Density (kg/m^3) | % of sea level |
|----------|-------------------|---------------|
| 0 km | 1.225 | 100% |
| 5 km | 0.736 | 60.1% |
| 10 km | 0.414 | 33.8% |
| 20 km | 0.089 | 7.3% |
| 50 km | 0.001 | 0.08% |
| 100 km | 5.6 x 10^-7 | ~0% |

Above ~80 km, drag is negligible for all practical purposes.
