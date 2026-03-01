# Titan Physics Engine

## Overview

Titan Physics Engine is a modular C++ aerospace simulation framework focused on rocket dynamics and orbital mechanics.

The current implementation supports:

- 1D vertical rocket simulation
- Mass variation during burn
- Atmospheric drag modeling
- RK4 numerical integration

This project is being built with long-term goals of supporting:

- 2D and 3D orbital mechanics
- Satellite propagation
- Collision prediction
- Telemetry integration

---

## Features Implemented

- Newtonian mechanics
- Variable mass propulsion
- Exponential atmosphere model
- Runge-Kutta 4th order integrator

---

## Architecture

- `core` → Math primitives and constants
- `physics` → Physical models (gravity, atmosphere)
- `simulation` → Rocket dynamics
- `integrators` → Numerical solvers

---

## Build Instructions (Linux – Ubuntu)

```bash
mkdir build
cd build
cmake ..
cmake --build .
./TitanTest
```

Requires:

- CMake 3.16+
- C++20 compatible compiler

---

## Roadmap

- Variable gravity model (1/r²)
- 2D trajectory with pitch angle
- Orbital mechanics module
- Satellite tracking
- REST API layer
- Real-time visualization frontend

---

## Purpose

This engine is being developed as a structured aerospace simulation platform designed for learning, experimentation, and professional-level engineering portfolio development.