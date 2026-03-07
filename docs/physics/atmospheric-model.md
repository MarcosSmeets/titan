# Atmospheric Models

## Overview

Titan provides two atmospheric models for density, pressure, and temperature computation. These feed into drag calculations and ISP variation with altitude.

## 1. Exponential Model (Default)

A single-equation approximation assuming an isothermal atmosphere:

### Density

```
rho(h) = rho0 * exp(-h / H)
```

Where:
- rho0 = 1.225 kg/m^3 (sea-level density)
- H = 8,500 m (scale height)
- h = altitude in meters

### Pressure

```
P(h) = P0 * exp(-h / H)
```

Where P0 = 101,325 Pa (sea-level pressure).

### Temperature

Simple lapse rate approximation:

```
T(h) = T0 - 0.0065 * h     for h < 11,000 m
T(h) = T0 - 0.0065 * 11000  for h >= 11,000 m (tropopause)
```

Where T0 = 288.15 K (15 C at sea level).

### Validity

- Good for altitudes 0-20 km for rough approximations
- Computationally cheap (single exp evaluation)
- Smooth and differentiable
- Widely used in preliminary aerospace analysis

### Limitations

- Does not model atmospheric layers
- Overestimates density above ~20 km
- No temperature inversion at tropopause
- No wind modeling

## 2. US Standard Atmosphere 1976

A piecewise model that accurately represents Earth's atmosphere through distinct layers:

### Atmospheric Layers

| Layer | Altitude Range | Lapse Rate (K/km) | Base Temp (K) |
|-------|---------------|-------------------|---------------|
| Troposphere | 0 - 11 km | -6.5 | 288.15 |
| Tropopause | 11 - 20 km | 0.0 | 216.65 |
| Stratosphere 1 | 20 - 32 km | +1.0 | 216.65 |
| Stratosphere 2 | 32 - 47 km | +2.8 | 228.65 |
| Mesosphere 1 | 47 - 51 km | 0.0 | 270.65 |
| Mesosphere 2 | 51 - 71 km | -2.8 | 270.65 |
| Mesosphere 3 | 71 - 86 km | -2.0 | 214.65 |

### Temperature

Piecewise linear within each layer:

```
T(h) = T_base + lambda * (h - h_base)
```

Where lambda is the lapse rate for that layer.

### Pressure

For layers with non-zero lapse rate:

```
P(h) = P_base * (T(h) / T_base) ^ (-g0 / (lambda * R))
```

For isothermal layers (lambda = 0):

```
P(h) = P_base * exp(-g0 * (h - h_base) / (R * T_base))
```

Where:
- g0 = 9.80665 m/s^2
- R = 287.05 J/(kg*K) (specific gas constant for air)

### Density

From the ideal gas law:

```
rho(h) = P(h) / (R * T(h))
```

### Accuracy

The US Standard Atmosphere 1976 is the international reference model for:
- Aircraft performance analysis
- Launch vehicle trajectory design
- Reentry heating calculations
- Atmospheric research

## Comparison

| Property | Exponential | US Standard 1976 |
|----------|-----------|-----------------|
| Accuracy | Approximate | High (reference standard) |
| Computation | O(1) - single exp | O(1) - layer lookup + formula |
| Layers | None | 7 distinct layers |
| Temperature | Simple lapse | Piecewise accurate |
| Valid range | 0-20 km (rough) | 0-86 km (accurate) |
| Use case | Quick estimates | Production simulations |

## Atmosphere and Drag

The atmospheric density directly controls drag force:

```
F_drag = 0.5 * rho(h) * v^2 * Cd * A
```

Since rho decreases exponentially, drag is dominant only in the lower atmosphere:
- 99% of atmospheric mass is below 30 km
- Drag is negligible above ~80 km
- Max-Q typically occurs around 11-14 km

## Configuration

The `Atmosphere` class can be configured per celestial body:

| Body | rho0 (kg/m^3) | Scale Height (m) | Surface Pressure (Pa) |
|------|--------------|-----------------|---------------------|
| Earth | 1.225 | 8,500 | 101,325 |
| Mars | 0.020 | 11,100 | 636 |
| Moon | 0 | 0 | 0 (no atmosphere) |
