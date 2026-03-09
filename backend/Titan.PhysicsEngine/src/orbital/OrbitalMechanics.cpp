#include "orbital/OrbitalMechanics.h"
#include <cmath>
#include <algorithm>

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

        if (r <= 0.0 || r < 1.0)
            return elements;

        double energy = (v * v) / 2.0 - mu / r;

        if (std::abs(energy) > 1e-10)
            elements.semiMajorAxis = -mu / (2.0 * energy);
        else
            elements.semiMajorAxis = 0.0;

        double h = position.x * velocity.y -
                   position.y * velocity.x;

        double inside = 1.0 +
                        (2.0 * energy * h * h) / (mu * mu);

        if (inside < 0.0)
            inside = 0.0;

        elements.eccentricity = std::sqrt(inside);
        elements.specificEnergy = energy;
        elements.angularMomentum = std::abs(h);

        if (elements.eccentricity < 1.0 && elements.semiMajorAxis > 0.0)
        {
            elements.apoapsis =
                elements.semiMajorAxis *
                (1.0 + elements.eccentricity);

            elements.periapsis =
                elements.semiMajorAxis *
                (1.0 - elements.eccentricity);
        }

        // 2D orbit: inclination and RAAN are zero
        elements.inclination = 0.0;
        elements.raan = 0.0;
        elements.argumentOfPeriapsis = 0.0;
        elements.trueAnomaly = 0.0;

        return elements;
    }

    OrbitalElements OrbitalMechanics::ComputeOrbitalElements(
        const math::Vector3 &position,
        const math::Vector3 &velocity,
        double mu)
    {
        OrbitalElements elements{};

        double r = position.Magnitude();
        double v = velocity.Magnitude();

        if (r < 1.0)
            return elements;

        // Specific orbital energy
        double energy = (v * v) / 2.0 - mu / r;
        elements.specificEnergy = energy;

        // Angular momentum vector: h = r x v
        math::Vector3 hVec = math::Vector3::Cross(position, velocity);
        double hMag = hVec.Magnitude();
        elements.angularMomentum = hMag;

        if (hMag < 1e-10)
            return elements;

        // Semi-major axis
        if (std::abs(energy) > 1e-10)
            elements.semiMajorAxis = -mu / (2.0 * energy);
        else
            elements.semiMajorAxis = 0.0;

        // Node vector: n = K x h (K = z-axis unit vector)
        math::Vector3 K(0.0, 0.0, 1.0);
        math::Vector3 nVec = math::Vector3::Cross(K, hVec);
        double nMag = nVec.Magnitude();

        // Eccentricity vector: e = (v x h)/mu - r_hat
        math::Vector3 eVec =
            math::Vector3::Cross(velocity, hVec) / mu -
            position / r;
        elements.eccentricity = eVec.Magnitude();

        // Apoapsis and periapsis
        if (elements.eccentricity < 1.0 && elements.semiMajorAxis > 0.0)
        {
            elements.apoapsis =
                elements.semiMajorAxis *
                (1.0 + elements.eccentricity);
            elements.periapsis =
                elements.semiMajorAxis *
                (1.0 - elements.eccentricity);
        }

        // Inclination: i = acos(h_z / |h|)
        elements.inclination = std::acos(
            std::clamp(hVec.z / hMag, -1.0, 1.0));

        // Right Ascension of Ascending Node (RAAN)
        if (nMag > 1e-10)
        {
            elements.raan = std::acos(
                std::clamp(nVec.x / nMag, -1.0, 1.0));
            if (nVec.y < 0.0)
                elements.raan = 2.0 * M_PI - elements.raan;
        }

        // Argument of periapsis
        if (nMag > 1e-10 && elements.eccentricity > 1e-10)
        {
            double dotNE = math::Vector3::Dot(nVec, eVec);
            elements.argumentOfPeriapsis = std::acos(
                std::clamp(dotNE / (nMag * elements.eccentricity), -1.0, 1.0));
            if (eVec.z < 0.0)
                elements.argumentOfPeriapsis =
                    2.0 * M_PI - elements.argumentOfPeriapsis;
        }

        // True anomaly
        if (elements.eccentricity > 1e-10)
        {
            double dotER = math::Vector3::Dot(eVec, position);
            elements.trueAnomaly = std::acos(
                std::clamp(dotER / (elements.eccentricity * r), -1.0, 1.0));

            double rdotv = math::Vector3::Dot(position, velocity);
            if (rdotv < 0.0)
                elements.trueAnomaly =
                    2.0 * M_PI - elements.trueAnomaly;
        }

        return elements;
    }

}
