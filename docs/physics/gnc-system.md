# GNC System

## Overview

The GNC (Guidance, Navigation, Control) subsystem provides closed-loop attitude control for 6DOF simulations. It lives in the `titan::gnc` namespace and integrates with the `Simulation` class to compute attitude commands and apply them through actuators.

## Architecture

```
Simulation Loop
    │
    ▼
Navigator (estimate state)
    │
    ▼
PointingMode (desired attitude)
    │
    ▼
Controller (compute torque commands)
    │
    ▼
Actuators (apply torques)
    │
    ▼
Attitude Integration (quaternion + angular velocity)
```

## Navigator

The Navigator estimates the vehicle's current state. In real spacecraft, this would fuse sensor data (IMU, star trackers, GPS). Titan provides an ideal implementation for simulation.

### Interface

```cpp
class Navigator {
    virtual SimState EstimateState(const SimState &trueState) = 0;
};
```

### IdealNavigator

Returns the true simulation state with no errors or noise:

```cpp
SimState EstimateState(const SimState &trueState) override {
    return trueState;  // Perfect knowledge
}
```

This is appropriate for trajectory optimization and guidance development where navigation errors are not the focus.

## Controller

The Controller computes actuator commands (torques, thrust direction, throttle) from the current and desired states.

### Interface

```cpp
struct ActuatorCommands {
    Vector3 thrustDirection;
    double throttle;
    Vector3 torqueCommand;
};

class Controller {
    virtual ActuatorCommands Compute(const SimState &estimated,
                                      const SimState &desired) = 0;
};
```

### PIDAttitudeController

A 3-axis PID controller that computes torque commands to drive the vehicle's attitude toward the desired orientation.

**Gains:**

```cpp
struct PIDGains {
    double Kp;           // Proportional gain
    double Ki;           // Integral gain
    double Kd;           // Derivative gain
    double maxIntegral;  // Anti-windup clamp
};
```

Gains are specified per-axis (roll, pitch, yaw), allowing different response characteristics for each axis.

**Operation:**

1. Compute quaternion error between current and desired attitude using `Quaternion::ErrorTo()`
2. Use short-path rotation (ensures error takes the shortest path on the unit sphere)
3. Apply PID law per axis:
   ```
   torque_axis = Kp * error + Ki * integral(error) + Kd * d(error)/dt
   ```
4. Clamp integral term to `maxIntegral` to prevent windup during sustained errors

**Anti-windup:** The integral term is clamped to `[-maxIntegral, +maxIntegral]` per axis. This prevents the integrator from accumulating large values during periods when actuators are saturated (e.g., reaction wheel momentum saturation), which would cause overshoot when the error reduces.

## Actuators

### ReactionWheel

Momentum exchange device for fine attitude control:

```cpp
struct ReactionWheel {
    Vector3 axis;           // Spin axis (unit vector)
    double maxTorque;       // Maximum torque output (N*m)
    double maxMomentum;     // Momentum capacity (N*m*s)
    double wheelInertia;    // Moment of inertia (kg*m^2)
    double currentSpeed;    // Current spin rate (rad/s)
    double currentMomentum; // Current stored momentum (N*m*s)
};
```

Properties:
- Produces torque by changing wheel spin speed
- Limited by maximum torque (rate of momentum change) and maximum momentum (total capacity)
- When momentum approaches saturation, torque capability is reduced
- Desaturation requires external torques (not modeled — in real spacecraft this uses thrusters or magnetic torquers)

### Thruster

For attitude control via thrust. Used as a torque source when reaction wheels are insufficient or absent.

## Pointing Modes

Pointing modes define the desired attitude as a function of the current state. Each mode implements:

```cpp
class PointingMode {
    virtual Quaternion DesiredAttitude(const SimState &state) = 0;
};
```

### InertialHold

Maintains a fixed target quaternion regardless of orbital position:

```cpp
Quaternion DesiredAttitude(const SimState &) override {
    return m_targetQuaternion;  // Constant
}
```

Use cases: calibration, specific observation pointing, communication antenna alignment.

### NadirPointing

Points the vehicle's body -Z axis toward the planet center, with body X along the velocity (along-track) direction:

```
body -Z → nadir (toward planet center)
body +X → along-track (velocity direction)
body +Y → cross-track (completes right-hand frame)
```

Use cases: Earth observation, gravity gradient stabilization, typical LEO satellite orientation.

### SunPointing

Points the vehicle's body +X axis toward the sun direction:

```
body +X → sun direction
```

Use cases: solar panel alignment, thermal control, solar observation.

## Integration with Simulation

The GNC loop runs once per simulation step, after force and torque computation:

```
1. Navigator estimates state from true state
2. PointingMode computes desired attitude quaternion
3. Controller computes torque command from attitude error
4. Torque command is applied to reaction wheels
5. Reaction wheel torques feed into rotational dynamics
6. Quaternion and angular velocity are integrated
```

### C API Configuration

GNC is configured through the C API:

```c
// Set initial attitude quaternion
titan_set_initial_attitude(sim, w, x, y, z);

// Add reaction wheels (one per axis typically)
titan_add_reaction_wheel(sim, ax, ay, az, maxTorque, maxMomentum, wheelInertia);

// Set pointing mode
titan_set_pointing_mode(sim, mode);
// mode: 0=none, 1=inertial, 2=nadir, 3=sun
```

## Typical Configuration

A 3-axis stabilized satellite:

```cpp
// Three orthogonal reaction wheels
sim.AddReactionWheel({1,0,0}, 0.01, 1.0, 0.001);  // Roll
sim.AddReactionWheel({0,1,0}, 0.01, 1.0, 0.001);  // Pitch
sim.AddReactionWheel({0,0,1}, 0.01, 1.0, 0.001);  // Yaw

// PID controller with moderate gains
PIDGains gains = {0.1, 0.001, 0.05, 1.0};
sim.SetController(make_unique<PIDAttitudeController>(gains, gains, gains));

// Nadir pointing for Earth observation
sim.SetPointingMode(make_unique<NadirPointing>());
```
