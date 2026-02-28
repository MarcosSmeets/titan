#include "orbital/OrbitalMechanics.h"
#include <cmath>

namespace titan::orbital
{

    OrbitalElements OrbitalMechanics::ComputeOrbitalElements(
        const math::Vector2 &position,
        const math::Vector2 &velocity,
        double mu)
    {
        OrbitalElements elements{};

        double r = position.Magnitude();
        double v = velocity.Magnitude();

        // Prevent division by zero or extremely small radius
        if (r <= 0.0 || r < 1.0)
            return {0.0, 0.0, 0.0, 0.0};

        // Specific orbital energy
        double energy = (v * v) / 2.0 - mu / r;

        // Semi-major axis
        if (std::abs(energy) > 1e-10)
            elements.semiMajorAxis = -mu / (2.0 * energy);
        else
            elements.semiMajorAxis = 0.0;

        // Angular momentum (2D scalar magnitude)
        double h = position.x * velocity.y -
                   position.y * velocity.x;

        // Compute eccentricity safely
        double inside = 1.0 +
                        (2.0 * energy * h * h) / (mu * mu);

        // Clamp small negative values caused by floating point error
        if (inside < 0.0)
            inside = 0.0;

        elements.eccentricity = std::sqrt(inside);

        // Compute apoapsis and periapsis
        if (elements.eccentricity < 1.0 && elements.semiMajorAxis > 0.0)
        {
            elements.apoapsis =
                elements.semiMajorAxis *
                (1.0 + elements.eccentricity);

            elements.periapsis =
                elements.semiMajorAxis *
                (1.0 - elements.eccentricity);
        }
        else
        {
            // Hyperbolic or invalid orbit
            elements.apoapsis = 0.0;
            elements.periapsis = 0.0;
        }

        return elements;
    }

}