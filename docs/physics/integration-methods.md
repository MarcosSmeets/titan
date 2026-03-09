# Numerical Integration Methods

## Overview

Titan solves ordinary differential equations (ODEs) governing rocket motion using numerical integrators. Three methods are available, offering different tradeoffs between accuracy, stability, and computational cost.

## The Problem

Rocket flight is governed by coupled ODEs:

```
dr/dt = v                           (position evolves by velocity)
dv/dt = F_total / m                 (velocity evolves by acceleration)
dm/dt = -burn_rate                  (mass decreases during burn)
```

For 6DOF attitude dynamics:

```
dq/dt = 0.5 * q * omega            (quaternion kinematic equation)
d(omega)/dt = I^-1 * (tau - omega x I*omega)   (Euler's rotation equation)
```

These equations have no closed-form solution due to nonlinear forces (drag ~ v^2, gravity ~ 1/r^2, mass variation).

## 1. Euler Method (1st Order)

The simplest explicit integrator:

```
y(t + dt) = y(t) + dt * f(y(t), t)
```

### Properties

- **Order**: O(dt) - first order accuracy
- **Cost**: 1 function evaluation per step
- **Stability**: Poor for stiff systems

### Limitations for Rocket Simulation

- Significant energy drift over long simulations
- Inaccurate apogee prediction
- Requires very small dt for acceptable accuracy
- Unsuitable for orbital propagation

### When to Use

- Quick prototyping only
- Verifying that a simulation runs before switching to RK4/RK45

## 2. Runge-Kutta 4th Order (RK4)

The classical 4th-order method, sampling the derivative four times per step:

```
k1 = f(y, t)
k2 = f(y + 0.5*dt*k1, t + 0.5*dt)
k3 = f(y + 0.5*dt*k2, t + 0.5*dt)
k4 = f(y + dt*k3, t + dt)

y(t + dt) = y(t) + (dt/6) * (k1 + 2*k2 + 2*k3 + k4)
```

### Properties

- **Order**: O(dt^4) - fourth order accuracy
- **Cost**: 4 function evaluations per step
- **Stability**: Good for moderate step sizes

### Advantages

- Excellent accuracy-to-cost ratio
- Handles nonlinear forces well
- Stable for rocket trajectory timescales
- Industry standard for many aerospace applications

### Typical Step Sizes

| Application | dt |
|------------|-----|
| Ascent (high dynamics) | 0.01 - 0.1 s |
| Coast (low dynamics) | 0.1 - 1.0 s |
| Orbital propagation | 1.0 - 10.0 s |

## 3. RK45 Dormand-Prince (Adaptive 5th Order)

An embedded Runge-Kutta method with automatic step size control:

```
Uses 7 function evaluations to compute:
  - 5th order estimate (used as the solution)
  - 4th order estimate (used for error estimation)

error = |y5 - y4|
```

### Step Size Control

```
if error > tolerance:
    reject step, reduce dt
    dt_new = dt * safety * (tolerance / error)^(1/5)
else:
    accept step, possibly increase dt
    dt_new = dt * safety * (tolerance / error)^(1/5)
```

Safety factor = 0.9 (conservative to avoid oscillation).

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| atol | 1e-8 | Absolute tolerance |
| rtol | 1e-6 | Relative tolerance |
| h_min | 1e-6 s | Minimum step size |
| h_max | 10.0 s | Maximum step size |

### Advantages

- Automatically adapts step size to dynamics
- Small steps during burns, large steps during coast
- Guaranteed error bounds
- Most efficient for long simulations with varying dynamics

### Disadvantages

- More complex implementation
- 7 function evaluations per step (vs 4 for RK4)
- Step rejection wastes computation

## Comparison

| Method | Order | Evaluations | Adaptive | Recommended Use |
|--------|-------|------------|----------|----------------|
| Euler | 1 | 1 | No | Prototyping only |
| RK4 | 4 | 4 | No | Fixed-step simulations |
| RK45 | 5 | 7 | Yes | Production simulations |

## Error Analysis

For a step size dt:

| Method | Local Error | Global Error |
|--------|-----------|-------------|
| Euler | O(dt^2) | O(dt) |
| RK4 | O(dt^5) | O(dt^4) |
| RK45 | O(dt^6) | O(dt^5) |

### Practical Impact

For a 900-second launch simulation with dt = 0.05s:

| Method | Altitude Error | Velocity Error |
|--------|--------------|---------------|
| Euler | ~1-10 km | ~100-500 m/s |
| RK4 | ~0.001 km | ~0.01 m/s |
| RK45 | ~0.0001 km | ~0.001 m/s |

## State Vector Integration

Titan integrates a state vector of 6 components (3 position + 3 velocity) for translation, plus 7 components for attitude (4 quaternion + 3 angular velocity):

```cpp
struct State {
    double x, y, z;       // position
    double vx, vy, vz;    // velocity
};
```

The integrator is agnostic to the physical meaning — it operates on generic vectors, making it reusable across different physics problems.

## Titan Default Configuration

The API defaults to RK45 with:
- dt = 0.05s (initial step size, adaptive)
- atol = 1e-8, rtol = 1e-6
- h_min = 1e-6s, h_max = 10.0s

This provides high accuracy with automatic efficiency optimization.
