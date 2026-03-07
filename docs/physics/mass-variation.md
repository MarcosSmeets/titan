# Mass Variation in Rocket Propulsion

## Overview

Mass variation is the defining characteristic of rocket propulsion. Unlike aircraft or cars, rockets carry both fuel and oxidizer, and continuously eject mass to generate thrust. This creates fundamentally nonlinear dynamics.

## The Tsiolkovsky Rocket Equation

The most important equation in rocketry:

```
delta_v = v_e * ln(m_0 / m_f)
```

Where:
- delta_v = achievable velocity change (m/s)
- v_e = effective exhaust velocity (m/s) = Isp * g0
- m_0 = initial mass (dry + fuel) (kg)
- m_f = final mass (dry only) (kg)
- ln = natural logarithm

### Implications

The logarithmic relationship means:
- Doubling fuel does NOT double delta-v
- High mass ratios yield diminishing returns
- Exhaust velocity is the most impactful parameter

### Example

For a stage with Isp = 311 s (v_e = 3,050 m/s) and mass ratio 10:1:

```
delta_v = 3050 * ln(10) = 3050 * 2.303 = 7,024 m/s
```

## Mass Model Implementation

### Fuel Consumption

```
fuel_consumed = burn_rate * throttle * dt
fuel_remaining = max(0, fuel_mass - fuel_consumed)
```

### Total Mass

```
total_mass = dry_mass + fuel_remaining
```

Dry mass includes:
- Structural mass (tanks, fairings, interstage)
- Engine mass
- Avionics, guidance systems
- Payload

### Thrust

```
thrust = burn_rate * v_exhaust * throttle    (while fuel > 0)
thrust = 0                                    (after burnout)
```

## Dynamic Effects

### Acceleration Profile

With constant thrust and decreasing mass:

```
a(t) = T / m(t)
```

Since m(t) decreases linearly, acceleration increases hyperbolically:

```
a(t) = T / (m_0 - burn_rate * t)
```

For a stage with TWR 1.5 at ignition:
- At 25% fuel consumed: TWR ~ 1.8
- At 50% fuel consumed: TWR ~ 2.2
- At 75% fuel consumed: TWR ~ 3.0
- At burnout: TWR ~ 6.0 (or limited by max-G)

### G-Load Increase

The increasing acceleration is why Titan implements G-load limiting:

```
if acceleration > max_G * g0:
    throttle = max_G * g0 * mass / max_thrust
```

Typical max-G limits:
- Crewed missions: 3.0 - 4.0 g
- Cargo missions: 6.0 - 10.0 g
- Military missiles: 10+ g

## Multi-Stage Mass Budget

### Stage Mass Terminology

```
m_payload   = mass above this stage (includes all upper stages + payload)
m_structural = dry mass of this stage only
m_propellant = fuel mass of this stage
m_gross     = m_structural + m_propellant + m_payload
```

### Structural Coefficient

```
epsilon = m_structural / (m_structural + m_propellant)
```

| Technology | epsilon | Typical Vehicle |
|-----------|---------|----------------|
| 0.15-0.20 | Modern composites | Falcon 9 upper stage |
| 0.10-0.15 | Advanced aluminum | Atlas V |
| 0.06-0.10 | Stainless steel | Starship |
| 0.05-0.08 | Balloon tanks | Centaur |

### Payload Ratio

```
lambda = m_payload / m_gross
```

Lower structural coefficient = higher payload ratio = more efficient stage.

## Numerical Integration Considerations

Mass variation complicates numerical integration:

1. **Step-limited burn**: Fuel may run out mid-timestep. Titan clamps consumption to available fuel.
2. **Discontinuous acceleration**: At burnout, thrust drops to zero instantly.
3. **Stage separation events**: Mass changes discontinuously when a stage is dropped.

RK4 and RK45 handle these nonlinearities well due to their multi-point sampling within each timestep.

## Real-World Mass Budgets

| Rocket | m_0 (kg) | m_payload (kg) | Payload Fraction |
|--------|---------|---------------|-----------------|
| Falcon 9 | 549,054 | 22,800 | 4.15% |
| Saturn V | 2,970,000 | 140,000 | 4.71% |
| Electron | 12,550 | 300 | 2.39% |
| Starship | 5,000,000 | 150,000 | 3.00% |

The payload fraction to LEO is remarkably consistent at 2-5% across all rocket sizes, a consequence of the exponential nature of the rocket equation.
