#pragma once
#include "environment/CelestialBody.h"

namespace titan::core::constants
{
    // Canonical constants from CelestialBody::Earth()
    constexpr double G = 6.67430e-11;
    constexpr double EarthMass = 5.972e24;
    constexpr double EarthRadius = 6371000.0;
    constexpr double EarthMu = 3.986004418e14;
    constexpr double EarthRotationRate = 7.2921159e-5;
    constexpr double EarthJ2 = 1.08263e-3;
}
