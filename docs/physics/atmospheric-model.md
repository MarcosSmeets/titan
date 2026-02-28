# Atmospheric Model

## Overview

The Titan Physics Engine uses an exponential atmospheric density model for drag computation.

This model provides a computationally efficient approximation suitable for preliminary aerospace simulations.

---

## 1. Density Model

Density is calculated using:

    rho(h) = rho0 * exp(-h / H)

Where:

- rho0 = 1.225 kg/m³ (sea level density)
- H = 8500 m (scale height)
- h = altitude in meters

---

## 2. Assumptions

- Isothermal atmosphere
- Constant scale height
- No temperature variation modeling
- Valid up to ~20 km for rough approximations

---

## 3. Why Exponential Model?

Advantages:

- Computationally cheap
- Smooth function
- Good first-order approximation
- Widely used in aerospace preliminary simulations

---

## 4. Limitations

- Not suitable for high-altitude orbital reentry
- Does not model stratified atmospheric layers
- Ignores temperature gradients

---

## 5. Future Improvements

Potential upgrades:

- Standard Atmosphere (ISA) model
- Layered atmosphere model
- Temperature-dependent density
- Wind modeling

---

## Conclusion

The exponential model balances realism and computational simplicity, making it suitable for early-stage rocket trajectory simulations.