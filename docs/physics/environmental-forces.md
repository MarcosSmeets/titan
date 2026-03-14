# Environmental Forces

## Overview

Beyond gravity and atmospheric drag, Titan models additional environmental forces that affect spacecraft trajectories and attitudes. These forces are most significant for high-fidelity simulations and long-duration orbital propagation.

## Coriolis Force

When simulating in a rotating reference frame (Earth-fixed coordinates), the Coriolis and centrifugal pseudo-forces must be accounted for.

### Physics

In a frame rotating with angular velocity **omega**:

```
F_coriolis = -2m * (omega x v)      Coriolis acceleration
F_centrifugal = -m * omega x (omega x r)   Centrifugal acceleration
```

Where:
- **omega** = Earth's rotation vector (7.2921e-5 rad/s about the polar axis)
- **v** = velocity in the rotating frame
- **r** = position in the rotating frame
- m = vehicle mass

### Effects

- **Trajectory deflection**: eastward deflection during ascent (Coriolis)
- **Launch site advantage**: eastward launch gains ~460 m/s from Earth's rotation at the equator
- **Orbital mechanics**: affects inclination and RAAN of the resulting orbit

### Implementation

```cpp
class CoriolisForce : public ForceModel {
    CoriolisForce(Vector3 omega);  // Earth rotation vector

    Vector3 ComputeForce(const SimState &state, double time) const override {
        Vector3 coriolis = omega.Cross(state.velocity) * (-2.0 * state.mass);
        Vector3 centrifugal = omega.Cross(omega.Cross(state.position)) * (-state.mass);
        return coriolis + centrifugal;
    }
};
```

### Activation

Earth rotation is enabled via the `useEarthRotation` flag in the simulation configuration (C API: `TitanSimConfig.useEarthRotation`). When enabled, the `CoriolisForce` model is automatically added to the force pipeline.

## Wind Models

Wind affects the rocket's aerodynamic forces by changing the relative airflow direction and speed. Titan provides two wind model implementations.

### Interface

```cpp
class WindModel {
    virtual Vector3 GetWind(double altitude, double time) const = 0;
};
```

### ConstantWind

Returns the same wind vector at all altitudes and times:

```cpp
ConstantWind(Vector3 windVelocity);
// e.g., ConstantWind({10.0, 0.0, 0.0})  → 10 m/s eastward
```

Useful for sensitivity analysis and worst-case wind loading studies.

### WindShearProfile

Models a realistic wind profile with altitude:

```
Surface to jet stream:   Linear interpolation from surface wind to jet stream wind
Jet stream altitude:     Peak wind speed (typically 200 m/s at ~10-12 km)
Above jet stream:        Exponential decay with scale height
```

Parameters:
- Surface wind velocity
- Jet stream wind velocity and altitude
- Scale height for decay above jet stream

This captures the key feature of real atmospheric wind profiles: relatively calm near the surface, strong jet stream in the upper troposphere, and decreasing winds in the stratosphere.

### Effect on Drag

Wind modifies the aerodynamic velocity used in drag calculations:

```
v_aero = v_vehicle - v_wind
D = 0.5 * rho * |v_aero|^2 * Cd * A
F_drag = -D * v_aero / |v_aero|
```

This means headwinds increase drag and crosswinds change the drag direction.

## Solar Radiation Pressure

Solar radiation exerts a small but continuous force on spacecraft surfaces. This is negligible during atmospheric ascent but significant for orbital propagation.

### Physics

The solar radiation pressure at 1 AU:

```
P_sr = 4.56e-6 N/m^2
```

The force on a flat surface:

```
F_srp = P_sr * Cr * A * sun_hat
```

Where:
- **Cr** = reflectivity coefficient (1.0 = absorbing, 2.0 = perfectly reflecting)
- **A** = cross-sectional area facing the sun (m^2)
- **sun_hat** = unit vector from sun to spacecraft

### Implementation

```cpp
class SolarRadiationPressure : public ForceModel {
    SolarRadiationPressure(double area, double reflectivity, Vector3 sunDirection);

    Vector3 ComputeForce(const SimState &state, double time) const override {
        double r = state.position.Magnitude();
        if (r < m_bodyRadius)  // Below surface
            return {};
        return m_sunDirection * (m_pressure * m_reflectivity * m_area);
    }
};
```

The implementation includes shadow detection — when the spacecraft is behind the planet (in eclipse), SRP force is zero.

### Typical Values

| Parameter | Typical Value |
|-----------|--------------|
| P_sr (1 AU) | 4.56e-6 N/m^2 |
| Cr (solar panels) | 1.4 |
| Cr (MLI blankets) | 1.8 |
| Cr (mirror) | 2.0 |
| Area (small satellite) | 1-10 m^2 |
| Area (large satellite) | 10-100 m^2 |

### Effects

- **Orbit perturbation**: slow eccentricity and semi-major axis changes
- **Attitude torque**: if the center of pressure differs from center of mass
- **Magnitude**: ~1e-6 to 1e-4 m/s^2 for typical spacecraft (much smaller than drag in LEO)

## Force Comparison

For a typical LEO spacecraft (400 km, 1000 kg):

| Force | Magnitude (N) | Notes |
|-------|--------------|-------|
| Gravity | ~8,600 | Dominant |
| Drag (400 km) | ~0.001 | Altitude dependent |
| J2 perturbation | ~0.01 | Latitude dependent |
| Solar radiation | ~0.00005 | Sun-facing area dependent |
| Coriolis (rotating frame) | varies | Velocity dependent |

Gravity and drag dominate during ascent. SRP and J2 matter for long-duration orbit propagation.
