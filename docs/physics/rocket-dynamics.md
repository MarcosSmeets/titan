# Rocket Dynamics – 1D Vertical Model

## Overview

This document describes the physical model used for vertical rocket flight simulation in the Titan Physics Engine.

The system is currently implemented in 1D (vertical axis only) as a foundation before extending to 2D and 3D orbital mechanics.

---

## 1. Governing Equations

The rocket motion is governed by Newton's Second Law:

    F = m * a

For vertical motion:

    F_total = Thrust - Weight + Drag

Therefore:

    a = (Thrust - Weight + Drag) / m

---

## 2. State Variables

The simulation tracks:

- Altitude (h) – meters
- Velocity (v) – m/s
- Total Mass (m) – kg
- Fuel Mass – kg

Differential system:

    dh/dt = v
    dv/dt = a(h, v, m)

---

## 3. Forces Acting on the Rocket

### Thrust

Generated while fuel is available:

    T = burnRate * exhaustVelocity

Where:
- burnRate (kg/s)
- exhaustVelocity (m/s)

---

### Weight

    W = m * g

Where:
- g = 9.81 m/s²

---

### Drag

    D = 0.5 * rho * v² * Cd * A

Direction:
- Always opposite to velocity

---

## 4. Flight Phases

The simulation automatically produces two phases:

### Powered Flight

- Fuel > 0
- Thrust active
- Mass decreasing

### Ballistic Phase

- Fuel = 0
- No thrust
- Gravity and drag only

---

## 5. Engineering Implications

This simplified 1D model allows:

- Apogee estimation
- Burn optimization studies
- Drag sensitivity analysis
- Basic propulsion analysis

It serves as the mathematical base for future 2D and 3D implementations.