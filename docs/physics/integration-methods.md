# Integration Methods in Titan Physics Engine

## Overview

This document explains the transition from the Euler integration method to the Runge-Kutta 4th Order (RK4) method in the Titan Physics Engine.

The purpose of this change was to improve numerical accuracy and stability in the rocket flight simulation.

---

## 1. The Initial Approach: Euler Method

The Euler method is the simplest numerical integration technique for solving Ordinary Differential Equations (ODEs).

For a system:

    dy/dt = f(y, t)

Euler updates the state using:

    y_next = y + f(y, t) * dt

### Advantages

- Very simple to implement
- Computationally cheap
- Good for quick prototypes

### Limitations

- First-order accuracy (O(dt))
- Accumulates error quickly
- Poor stability for larger time steps
- Inaccurate apogee prediction in rocket simulations

In the rocket case:

    dh/dt = v
    dv/dt = a

Euler would approximate motion linearly between time steps, which leads to significant energy drift.

---

## 2. Why Euler Is Insufficient for Rocket Simulation

Rocket flight involves:

- Rapid acceleration changes
- Nonlinear drag force (proportional to v²)
- Mass variation during burn

These nonlinearities amplify numerical error when using Euler integration.

As a result:

- Peak altitude becomes inaccurate
- Velocity curves become distorted
- Simulation may become unstable for larger dt

For aerospace-grade simulation, this is unacceptable.

---

## 3. Runge-Kutta 4th Order (RK4)

RK4 improves accuracy by sampling the slope four times per time step.

For:

    dy/dt = f(y, t)

RK4 computes:

    k1 = f(y, t)
    k2 = f(y + 0.5*dt*k1, t + 0.5*dt)
    k3 = f(y + 0.5*dt*k2, t + 0.5*dt)
    k4 = f(y + dt*k3, t + dt)

Final update:

    y_next = y + (dt/6) * (k1 + 2k2 + 2k3 + k4)

### Advantages

- Fourth-order accuracy (O(dt⁴))
- Much lower accumulated error
- Stable for moderately large time steps
- Better conservation of system behavior

---

## 4. Application in Titan Rocket Simulation

The system being solved:

    dh/dt = v
    dv/dt = (Thrust - Weight + Drag) / m

RK4 allows:

- Accurate apogee prediction
- Stable ballistic phase after burnout
- Correct handling of nonlinear drag
- Smooth velocity and altitude curves

---

## 5. Engineering Impact

Switching from Euler to RK4:

- Improved numerical stability
- Reduced integration error significantly
- Allowed larger dt without instability
- Increased realism of rocket trajectory

This change moves the Titan Physics Engine closer to aerospace-grade simulation standards.

---

## 6. Future Improvements

Potential future upgrades:

- Adaptive time step RK45
- Symplectic integrators for orbital mechanics
- Variable gravity model (1/r²)
- Coupled 2D and 3D dynamics

---

## Conclusion

The transition from Euler to RK4 represents a fundamental upgrade in numerical robustness.

This change marks the transition from a prototype-level simulation to a scientifically credible physics engine suitable for aerospace experimentation.