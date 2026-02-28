#include "orbital/OrbitalMechanics.h"
#include <cmath>

using namespace titan::math;

namespace titan::orbital
{
    OrbitalElements OrbitalMechanics::ComputeOrbitalElements(
        const Vector2 &rVec,
        const Vector2 &vVec,
        double mu)
    {
        OrbitalElements elements{};

        double r = rVec.Magnitude();
        double v = vVec.Magnitude();

        // Specific orbital energy
        double energy = (v * v) / 2.0 - mu / r;
        elements.specificEnergy = energy;

        // Semi-major axis
        elements.semiMajorAxis = -mu / (2.0 * energy);

        // Angular momentum (scalar in 2D: r x v)
        double h = rVec.x * vVec.y - rVec.y * vVec.x;
        elements.angularMomentum = h;

        // Eccentricity
        double e = std::sqrt(1.0 + (2.0 * energy * h * h) / (mu * mu));
        elements.eccentricity = e;

        // Apoapsis and periapsis
        elements.apoapsis = elements.semiMajorAxis * (1.0 + e);
        elements.periapsis = elements.semiMajorAxis * (1.0 - e);

        return elements;
    }
}