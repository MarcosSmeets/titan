# Mass Variation in Rocket Propulsion

## Overview

Unlike most vehicles, rockets experience continuous mass variation during flight.

This document describes how mass reduction due to fuel consumption is implemented in the Titan Physics Engine.

---

## 1. Why Mass Variation Matters

From Newton's Second Law:

    a = F / m

If mass decreases:

- Acceleration increases (for constant thrust)
- Thrust-to-weight ratio changes dynamically
- Flight behavior becomes nonlinear

This is fundamental to rocket physics.

---

## 2. Fuel Burn Model

Fuel consumption is modeled as:

    fuelConsumed = burnRate * dt

Where:

- burnRate (kg/s)
- dt = simulation timestep

Fuel mass is reduced until:

    fuelMass = 0

---

## 3. Total Mass

    totalMass = dryMass + fuelMass

Dry mass remains constant.
Fuel mass decreases over time.

---

## 4. Thrust Model

While fuel is available:

    Thrust = burnRate * exhaustVelocity

After burnout:

    Thrust = 0

---

## 5. Relation to Tsiolkovsky Equation

The continuous mass reduction is the physical basis for the Tsiolkovsky rocket equation:

    Δv = ve * ln(m0 / mf)

While the engine integrates motion numerically, the mass variation implemented here aligns with classical rocket theory.

---

## 6. Engineering Significance

Mass variation:

- Increases realism
- Creates nonlinear acceleration profile
- Enables multi-stage modeling in future

---

## Conclusion

Mass variation transforms the simulation from a basic physics demo into a true rocket propulsion model.