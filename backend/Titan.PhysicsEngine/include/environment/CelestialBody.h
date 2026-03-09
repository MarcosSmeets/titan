#pragma once

namespace titan::environment
{
    struct CelestialBody
    {
        double mu;            // gravitational parameter (m^3/s^2)
        double radius;        // mean equatorial radius (m)
        double rotationRate;  // angular velocity (rad/s)
        double J2;            // oblateness coefficient
        double atmosphereScaleHeight; // scale height (m), 0 if no atmosphere
        double surfaceDensity;        // sea-level atmospheric density (kg/m^3)
        double surfacePressure;       // sea-level pressure (Pa)

        static CelestialBody Earth()
        {
            return {
                3.986004418e14,   // mu
                6371000.0,        // radius
                7.2921159e-5,     // rotationRate
                1.08263e-3,       // J2
                8500.0,           // atmosphereScaleHeight
                1.225,            // surfaceDensity
                101325.0          // surfacePressure
            };
        }

        static CelestialBody Moon()
        {
            return {
                4.9048695e12,     // mu
                1737400.0,        // radius
                2.6617e-6,        // rotationRate
                2.027e-4,         // J2
                0.0,              // no atmosphere
                0.0,
                0.0
            };
        }

        static CelestialBody Mars()
        {
            return {
                4.282837e13,      // mu
                3389500.0,        // radius
                7.0882e-5,        // rotationRate
                1.9555e-3,        // J2
                11100.0,          // atmosphereScaleHeight
                0.020,            // surfaceDensity
                636.0             // surfacePressure
            };
        }
    };
}
