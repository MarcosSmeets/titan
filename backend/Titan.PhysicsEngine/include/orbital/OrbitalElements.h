#pragma once

namespace titan::orbital
{
    struct OrbitalElements
    {
        double semiMajorAxis;   // a (meters)
        double eccentricity;    // e
        double specificEnergy;  // epsilon (J/kg)
        double angularMomentum; // h (m^2/s)

        double apoapsis;  // meters
        double periapsis; // meters

        // 3D classical elements
        double inclination;          // i (radians)
        double raan;                 // Omega - Right Ascension of Ascending Node (radians)
        double argumentOfPeriapsis;  // omega (radians)
        double trueAnomaly;          // nu (radians)
    };
}
