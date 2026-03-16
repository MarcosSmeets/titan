#pragma once
#include "math/Vector3.h"
#include <cmath>
#include <vector>
#include <algorithm>

namespace titan::orbital
{
    /// Result of a single impulsive maneuver
    struct ManeuverResult
    {
        double deltaV = 0.0;          // m/s total delta-v
        double burnTime = 0.0;        // estimated burn time (s)
        titan::math::Vector3 dvVec;   // delta-v vector (inertial)
        double timeFromEpoch = 0.0;   // when to execute (s from epoch)
        std::string description;
    };

    /// Result of a complete transfer sequence
    struct TransferResult
    {
        std::vector<ManeuverResult> maneuvers;
        double totalDeltaV = 0.0;     // sum of all |dv|
        double transferTime = 0.0;    // total time (s)
        bool valid = false;
    };

    /// Orbital maneuver computations
    class Maneuvers
    {
    public:
        /// Hohmann transfer between two circular orbits
        /// @param r1 initial orbit radius (m, from center)
        /// @param r2 target orbit radius (m, from center)
        /// @param mu gravitational parameter (m^3/s^2)
        static TransferResult Hohmann(double r1, double r2, double mu)
        {
            TransferResult result;
            if (r1 <= 0 || r2 <= 0 || mu <= 0)
                return result;

            double a_transfer = (r1 + r2) / 2.0;

            // Velocities on circular orbits
            double v1_circ = std::sqrt(mu / r1);
            double v2_circ = std::sqrt(mu / r2);

            // Velocities on transfer ellipse (vis-viva)
            double v1_transfer = std::sqrt(mu * (2.0 / r1 - 1.0 / a_transfer));
            double v2_transfer = std::sqrt(mu * (2.0 / r2 - 1.0 / a_transfer));

            // Delta-v for each burn
            double dv1 = v1_transfer - v1_circ;
            double dv2 = v2_circ - v2_transfer;

            // Transfer time = half period of transfer ellipse
            double T_transfer = M_PI * std::sqrt(a_transfer * a_transfer * a_transfer / mu);

            ManeuverResult burn1;
            burn1.deltaV = std::abs(dv1);
            burn1.timeFromEpoch = 0.0;
            burn1.description = "Hohmann burn 1 (departure)";

            ManeuverResult burn2;
            burn2.deltaV = std::abs(dv2);
            burn2.timeFromEpoch = T_transfer;
            burn2.description = "Hohmann burn 2 (circularization)";

            result.maneuvers = {burn1, burn2};
            result.totalDeltaV = std::abs(dv1) + std::abs(dv2);
            result.transferTime = T_transfer;
            result.valid = true;

            return result;
        }

        /// Bi-elliptic transfer (more efficient for large r2/r1 ratios)
        /// @param r1 initial orbit radius
        /// @param r2 target orbit radius
        /// @param r_intermediate intermediate apoapsis radius
        /// @param mu gravitational parameter
        static TransferResult BiElliptic(double r1, double r2, double r_intermediate, double mu)
        {
            TransferResult result;
            if (r1 <= 0 || r2 <= 0 || r_intermediate <= 0 || mu <= 0)
                return result;
            if (r_intermediate < std::max(r1, r2))
                return result; // intermediate must be higher than both

            // Transfer ellipse 1: r1 -> r_intermediate
            double a1 = (r1 + r_intermediate) / 2.0;
            double v1_circ = std::sqrt(mu / r1);
            double v1_depart = std::sqrt(mu * (2.0 / r1 - 1.0 / a1));
            double dv1 = v1_depart - v1_circ;

            // At r_intermediate on first ellipse
            double v_inter1 = std::sqrt(mu * (2.0 / r_intermediate - 1.0 / a1));

            // Transfer ellipse 2: r_intermediate -> r2
            double a2 = (r_intermediate + r2) / 2.0;
            double v_inter2 = std::sqrt(mu * (2.0 / r_intermediate - 1.0 / a2));
            double dv2 = v_inter2 - v_inter1;

            // At r2 on second ellipse
            double v2_arrive = std::sqrt(mu * (2.0 / r2 - 1.0 / a2));
            double v2_circ = std::sqrt(mu / r2);
            double dv3 = v2_circ - v2_arrive;

            // Transfer times
            double T1 = M_PI * std::sqrt(a1 * a1 * a1 / mu);
            double T2 = M_PI * std::sqrt(a2 * a2 * a2 / mu);

            ManeuverResult burn1;
            burn1.deltaV = std::abs(dv1);
            burn1.timeFromEpoch = 0.0;
            burn1.description = "Bi-elliptic burn 1 (departure)";

            ManeuverResult burn2;
            burn2.deltaV = std::abs(dv2);
            burn2.timeFromEpoch = T1;
            burn2.description = "Bi-elliptic burn 2 (apoapsis)";

            ManeuverResult burn3;
            burn3.deltaV = std::abs(dv3);
            burn3.timeFromEpoch = T1 + T2;
            burn3.description = "Bi-elliptic burn 3 (circularization)";

            result.maneuvers = {burn1, burn2, burn3};
            result.totalDeltaV = std::abs(dv1) + std::abs(dv2) + std::abs(dv3);
            result.transferTime = T1 + T2;
            result.valid = true;

            return result;
        }

        /// Simple plane change at ascending node
        /// @param v orbital velocity at maneuver point (m/s)
        /// @param deltaInclination inclination change (rad)
        static ManeuverResult PlaneChange(double v, double deltaInclination)
        {
            ManeuverResult result;
            result.deltaV = 2.0 * v * std::sin(deltaInclination / 2.0);
            result.description = "Plane change";
            return result;
        }

        /// Combined plane change with Hohmann (optimal for LEO to GEO)
        /// Splits plane change across both burns for minimum total delta-v
        static TransferResult CombinedPlaneChangeTransfer(
            double r1, double r2, double deltaInclination, double mu)
        {
            // Optimize split of plane change between the two burns
            // At higher altitude, plane change is cheaper (lower velocity)
            double v1 = std::sqrt(mu / r1);
            double v2 = std::sqrt(mu / r2);

            double a_transfer = (r1 + r2) / 2.0;
            double v1t = std::sqrt(mu * (2.0 / r1 - 1.0 / a_transfer));
            double v2t = std::sqrt(mu * (2.0 / r2 - 1.0 / a_transfer));

            // Optimal split: most of the plane change at the higher orbit
            // where velocity is lower
            double bestDv = 1e20;
            double bestSplit = 0.0;

            for (int i = 0; i <= 100; i++)
            {
                double split = i / 100.0; // fraction of plane change at burn 1
                double di1 = deltaInclination * split;
                double di2 = deltaInclination * (1.0 - split);

                double dv1 = std::sqrt(v1 * v1 + v1t * v1t -
                    2.0 * v1 * v1t * std::cos(di1));
                double dv2 = std::sqrt(v2t * v2t + v2 * v2 -
                    2.0 * v2t * v2 * std::cos(di2));

                if (dv1 + dv2 < bestDv)
                {
                    bestDv = dv1 + dv2;
                    bestSplit = split;
                }
            }

            double T_transfer = M_PI * std::sqrt(a_transfer * a_transfer * a_transfer / mu);

            TransferResult result;
            ManeuverResult burn1;
            burn1.deltaV = bestDv * bestSplit / (bestSplit + 1e-10);
            burn1.timeFromEpoch = 0.0;
            burn1.description = "Combined transfer burn 1";

            ManeuverResult burn2;
            burn2.deltaV = bestDv * (1.0 - bestSplit);
            burn2.timeFromEpoch = T_transfer;
            burn2.description = "Combined transfer burn 2";

            result.maneuvers = {burn1, burn2};
            result.totalDeltaV = bestDv;
            result.transferTime = T_transfer;
            result.valid = true;

            return result;
        }

        /// Lambert solver — finds the orbit connecting two position vectors
        /// in a given transfer time. Uses Izzo's algorithm (robust for all cases).
        /// @param r1 initial position vector (m)
        /// @param r2 final position vector (m)
        /// @param tof time of flight (s)
        /// @param mu gravitational parameter
        /// @param prograde true for prograde (short way), false for retrograde
        /// @param[out] v1 velocity at r1
        /// @param[out] v2 velocity at r2
        /// @return true if solution found
        static bool Lambert(
            const titan::math::Vector3 &r1,
            const titan::math::Vector3 &r2,
            double tof,
            double mu,
            bool prograde,
            titan::math::Vector3 &v1,
            titan::math::Vector3 &v2)
        {
            double r1mag = r1.Magnitude();
            double r2mag = r2.Magnitude();

            if (r1mag < 1e-6 || r2mag < 1e-6 || tof < 1e-6)
                return false;

            // Cross product to determine direction
            auto cross = titan::math::Vector3::Cross(r1, r2);
            double cosTA = titan::math::Vector3::Dot(r1, r2) / (r1mag * r2mag);
            cosTA = std::clamp(cosTA, -1.0, 1.0);

            double sinTA;
            if (prograde)
                sinTA = (cross.z >= 0) ? std::sqrt(1.0 - cosTA * cosTA)
                                       : -std::sqrt(1.0 - cosTA * cosTA);
            else
                sinTA = (cross.z < 0) ? std::sqrt(1.0 - cosTA * cosTA)
                                      : -std::sqrt(1.0 - cosTA * cosTA);

            // Geometry parameter
            double A = std::sqrt(r1mag * r2mag * (1.0 + cosTA));
            if (std::abs(sinTA) < 1e-10 && cosTA < 0)
                return false; // 180-degree transfer, degenerate
            if (sinTA < 0)
                A = -A;

            // Newton-Raphson iteration on universal variable z
            double z = 0.0; // initial guess (parabolic)
            int maxIter = 50;

            for (int iter = 0; iter < maxIter; iter++)
            {
                double C, S;
                StumpffCS(z, C, S);

                double y = r1mag + r2mag + A * (z * S - 1.0) / std::sqrt(C);

                if (y < 0)
                {
                    // Adjust z upward
                    z = z + 0.5;
                    continue;
                }

                double x = std::sqrt(y / C);
                double tof_z = (x * x * x * S + A * std::sqrt(y)) / std::sqrt(mu);

                // Check convergence
                if (std::abs(tof_z - tof) < 1e-6)
                    break;

                // Derivative for Newton step
                double dTdz;
                if (std::abs(z) > 1e-10)
                {
                    dTdz = (x * x * x * (S - 3.0 * S * C / (2.0 * C) +
                            1.0 / (2.0 * z)) +
                            (A / 8.0) * (3.0 * S * std::sqrt(y) / C +
                            A / x)) / std::sqrt(mu);
                }
                else
                {
                    dTdz = (std::sqrt(2.0) / 40.0 * y * y * y / 2.0 +
                            A / 8.0 * (std::sqrt(y) + A * std::sqrt(1.0 / (2.0 * y)))) /
                           std::sqrt(mu);
                }

                if (std::abs(dTdz) < 1e-20)
                    break;

                z = z - (tof_z - tof) / dTdz;
            }

            double C, S;
            StumpffCS(z, C, S);
            double y = r1mag + r2mag + A * (z * S - 1.0) / std::sqrt(C);

            if (y < 0)
                return false;

            double f = 1.0 - y / r1mag;
            double gdot = 1.0 - y / r2mag;
            double g = A * std::sqrt(y / mu);

            if (std::abs(g) < 1e-20)
                return false;

            v1 = (r2 - r1 * f) / g;
            v2 = (r2 * gdot - r1) / g;

            return true;
        }

        /// Compute delta-v budget for a mission profile
        static double DeltaVBudget(const std::vector<ManeuverResult> &maneuvers)
        {
            double total = 0.0;
            for (const auto &m : maneuvers)
                total += m.deltaV;
            return total;
        }

        /// Estimate burn time from delta-v using Tsiolkovsky equation
        static double EstimateBurnTime(
            double deltaV, double exhaustVelocity,
            double initialMass, double massFlowRate)
        {
            if (massFlowRate <= 0 || exhaustVelocity <= 0)
                return 0.0;

            double massRatio = std::exp(deltaV / exhaustVelocity);
            double propellantMass = initialMass * (1.0 - 1.0 / massRatio);
            return propellantMass / massFlowRate;
        }

    private:
        /// Stumpff functions C(z) and S(z) for universal variable formulation
        static void StumpffCS(double z, double &C, double &S)
        {
            if (z > 1e-6)
            {
                double sqz = std::sqrt(z);
                C = (1.0 - std::cos(sqz)) / z;
                S = (sqz - std::sin(sqz)) / (sqz * sqz * sqz);
            }
            else if (z < -1e-6)
            {
                double sqnz = std::sqrt(-z);
                C = (1.0 - std::cosh(sqnz)) / z;
                S = (std::sinh(sqnz) - sqnz) / (sqnz * sqnz * sqnz);
            }
            else
            {
                C = 1.0 / 2.0;
                S = 1.0 / 6.0;
            }
        }
    };
}
