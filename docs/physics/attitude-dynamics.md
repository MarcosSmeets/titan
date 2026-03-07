# Attitude Dynamics (6DOF)

## Overview

Titan's high-fidelity `Simulation` class implements full 6-degree-of-freedom (6DOF) dynamics: 3 translational (position) and 3 rotational (attitude). This document describes the rotational dynamics and control systems.

## Quaternion Representation

Attitude is represented using unit quaternions to avoid gimbal lock:

```
q = w + xi + yj + zk
|q| = 1
```

Where (w, x, y, z) are the quaternion components.

### Advantages over Euler Angles

- No gimbal lock at any orientation
- Smooth interpolation (SLERP)
- Efficient rotation composition (quaternion multiplication)
- Compact (4 values vs 3x3 rotation matrix)

### Key Operations

| Operation | Formula |
|-----------|---------|
| Rotation composition | q_total = q1 * q2 |
| Vector rotation | v' = q * v * q^-1 |
| Conjugate/Inverse | q^-1 = (w, -x, -y, -z) for unit quaternion |
| Identity | q = (1, 0, 0, 0) |

### Euler Angle Conversion

For display and analysis, quaternions are converted to Euler angles:

```
roll  = atan2(2(wx + yz), 1 - 2(x^2 + y^2))
pitch = asin(2(wy - zx))
yaw   = atan2(2(wz + xy), 1 - 2(y^2 + z^2))
```

## Kinematic Equation

Quaternion rate of change from angular velocity:

```
dq/dt = 0.5 * q * omega_q
```

Where omega_q is the angular velocity as a pure quaternion:

```
omega_q = (0, omega_x, omega_y, omega_z)
```

This is integrated alongside the translational state at each timestep.

## Euler's Rotation Equation

Angular velocity evolves according to:

```
I * d(omega)/dt = tau - omega x (I * omega)
```

Where:
- I = moment of inertia tensor (3x3, diagonal for principal axes)
- tau = total external torque vector
- omega = angular velocity vector
- x = cross product

The `omega x (I * omega)` term is the gyroscopic coupling torque.

## Moment of Inertia

Each stage can specify its inertia tensor:

```cpp
stage.SetInertia(Ixx, Iyy, Izz);
```

Default approximation models the stage as a cylinder:

```
Ixx = (1/12) * m * (3*r^2 + h^2)    (roll)
Iyy = (1/12) * m * (3*r^2 + h^2)    (pitch)
Izz = (1/2) * m * r^2                (yaw/spin)
```

## Torque Sources

### Thrust Misalignment

If thrust vector doesn't pass through center of mass, it generates a torque. Modeled via `ForceModel::ComputeTorque()`.

### Aerodynamic Torques

Drag at different points on the vehicle creates pitching moments. Especially significant during Max-Q.

### Control Torques

From reaction wheels or thrust vectoring.

## Reaction Wheel Control

Titan implements momentum-exchange attitude control via reaction wheels:

### Configuration

```cpp
simulation.AddReactionWheel(
    axis,           // Spin axis direction (e.g., {1,0,0} for X-axis)
    maxTorque,      // Maximum torque output (N*m)
    maxMomentum,    // Saturation limit (N*m*s)
    wheelInertia    // Wheel moment of inertia (kg*m^2)
);
```

### Physics

Angular momentum stored in wheels:

```
H_wheel = I_wheel * omega_wheel
```

Torque applied to spacecraft:

```
tau_control = -d(H_wheel)/dt
```

When a wheel accelerates, the spacecraft rotates in the opposite direction (conservation of angular momentum).

### Saturation

Wheels have finite momentum capacity:

```
if |H_wheel| >= H_max:
    wheel is saturated, cannot provide more torque in that direction
```

Saturation monitoring is available in telemetry:

```
saturation_pct = |H_wheel| / H_max * 100%
```

### Telemetry Output

The simulation streams wheel state:
- `wheelSpeed[]` - angular velocity of each wheel (rad/s)
- `wheelMomentum[]` - stored momentum (N*m*s)
- `wheelCount` - number of configured wheels

## Pointing Modes

The `PointingMode` interface defines desired attitude targets:

```cpp
class PointingMode {
    virtual Quaternion GetTargetAttitude(const SimState &state) const = 0;
};
```

Combined with a `Controller` that computes the torque command to achieve the target attitude.

## State Vector

The complete 6DOF state integrated at each step:

| Component | Dimensions | Description |
|-----------|-----------|-------------|
| Position | 3 | x, y, z (meters, Earth-centered) |
| Velocity | 3 | vx, vy, vz (m/s) |
| Quaternion | 4 | w, x, y, z (unit quaternion) |
| Angular velocity | 3 | omega_x, omega_y, omega_z (rad/s) |
| Mass | 1 | Total vehicle mass (kg) |

Total: 14 state variables integrated per timestep.

## NavBall Visualization

The frontend displays attitude using a KSP-style NavBall:

- **Pitch**: drives horizon line offset (sky/ground split)
- **Roll**: rotates the entire ball interior
- **Yaw**: positions cardinal direction labels (N/E/S/W)
- Digital readouts show exact degree values
