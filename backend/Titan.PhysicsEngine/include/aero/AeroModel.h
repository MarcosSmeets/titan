#pragma once
#include <vector>
#include <cmath>
#include <algorithm>
#include <functional>

namespace titan::aero
{
    /// Bilinear interpolation table for aerodynamic coefficients
    /// Indexes: Mach number (columns) x Angle of Attack (rows)
    class AeroTable
    {
    public:
        AeroTable() = default;

        AeroTable(
            const std::vector<double> &machBreaks,
            const std::vector<double> &alphaBreaks,  // radians
            const std::vector<std::vector<double>> &data)
            : m_mach(machBreaks),
              m_alpha(alphaBreaks),
              m_data(data) {}

        /// Bilinear lookup
        double Lookup(double mach, double alpha) const
        {
            if (m_mach.empty() || m_alpha.empty() || m_data.empty())
                return 0.0;

            // Clamp to table bounds
            mach = std::clamp(mach, m_mach.front(), m_mach.back());
            alpha = std::clamp(alpha, m_alpha.front(), m_alpha.back());

            // Find Mach indices
            size_t mi = 0;
            for (size_t i = 0; i + 1 < m_mach.size(); i++)
            {
                if (mach >= m_mach[i] && mach <= m_mach[i + 1])
                {
                    mi = i;
                    break;
                }
                mi = i;
            }

            // Find alpha indices
            size_t ai = 0;
            for (size_t i = 0; i + 1 < m_alpha.size(); i++)
            {
                if (alpha >= m_alpha[i] && alpha <= m_alpha[i + 1])
                {
                    ai = i;
                    break;
                }
                ai = i;
            }

            // Bilinear interpolation
            size_t mi1 = std::min(mi + 1, m_mach.size() - 1);
            size_t ai1 = std::min(ai + 1, m_alpha.size() - 1);

            double machRange = m_mach[mi1] - m_mach[mi];
            double alphaRange = m_alpha[ai1] - m_alpha[ai];

            double tm = (machRange > 1e-15) ? (mach - m_mach[mi]) / machRange : 0.0;
            double ta = (alphaRange > 1e-15) ? (alpha - m_alpha[ai]) / alphaRange : 0.0;

            double c00 = GetSafe(ai, mi);
            double c10 = GetSafe(ai, mi1);
            double c01 = GetSafe(ai1, mi);
            double c11 = GetSafe(ai1, mi1);

            return c00 * (1 - tm) * (1 - ta) +
                   c10 * tm * (1 - ta) +
                   c01 * (1 - tm) * ta +
                   c11 * tm * ta;
        }

    private:
        double GetSafe(size_t row, size_t col) const
        {
            if (row < m_data.size() && col < m_data[row].size())
                return m_data[row][col];
            return 0.0;
        }

        std::vector<double> m_mach;
        std::vector<double> m_alpha;
        std::vector<std::vector<double>> m_data;
    };

    /// Complete aerodynamic coefficient set for a vehicle
    /// Provides Cd (drag), Cl (lift), Cm (pitching moment), and COP
    struct AeroCoefficients
    {
        double Cd = 0.0;  // Drag coefficient
        double Cl = 0.0;  // Lift coefficient (normal force in body frame)
        double Cm = 0.0;  // Pitching moment coefficient
        double Cn = 0.0;  // Yawing moment coefficient
        double COP = 0.0; // Center of pressure (m from nose)
    };

    /// Full aerodynamic model with table lookups
    class AeroModel
    {
    public:
        AeroModel() = default;

        void SetCdTable(const AeroTable &table) { m_cdTable = table; }
        void SetClTable(const AeroTable &table) { m_clTable = table; }
        void SetCmTable(const AeroTable &table) { m_cmTable = table; }

        void SetReferenceArea(double area) { m_refArea = area; }
        void SetReferenceLength(double length) { m_refLength = length; }
        void SetCenterOfMassFromNose(double x) { m_comFromNose = x; }

        /// Get all aero coefficients at given flight conditions
        AeroCoefficients GetCoefficients(double mach, double alpha) const
        {
            AeroCoefficients c;
            c.Cd = m_cdTable.Lookup(mach, std::abs(alpha));
            c.Cl = m_clTable.Lookup(mach, std::abs(alpha));
            if (alpha < 0) c.Cl = -c.Cl; // Lift reverses with alpha
            c.Cm = m_cmTable.Lookup(mach, std::abs(alpha));
            if (alpha < 0) c.Cm = -c.Cm;
            return c;
        }

        /// Compute aerodynamic forces and torques
        /// @param mach Mach number
        /// @param alpha angle of attack (rad)
        /// @param dynamicPressure q = 0.5 * rho * v^2
        /// @param[out] drag drag force (N)
        /// @param[out] lift lift force (N)
        /// @param[out] moment pitching moment (N·m)
        void ComputeForces(
            double mach, double alpha, double dynamicPressure,
            double &drag, double &lift, double &moment) const
        {
            auto c = GetCoefficients(mach, alpha);
            drag = c.Cd * dynamicPressure * m_refArea;
            lift = c.Cl * dynamicPressure * m_refArea;
            moment = c.Cm * dynamicPressure * m_refArea * m_refLength;
        }

        double GetReferenceArea() const { return m_refArea; }
        double GetReferenceLength() const { return m_refLength; }

        // === Preset aero models ===

        /// Generic launch vehicle (slender body, ogive nose)
        static AeroModel GenericLaunchVehicle(double diameter)
        {
            AeroModel model;
            double area = M_PI * diameter * diameter / 4.0;
            model.SetReferenceArea(area);
            model.SetReferenceLength(diameter);

            // Mach breakpoints
            std::vector<double> mach = {0.0, 0.4, 0.8, 1.0, 1.2, 1.5, 2.0, 3.0, 5.0, 10.0};

            // Alpha breakpoints (0 to 15 degrees in radians)
            std::vector<double> alpha;
            for (int i = 0; i <= 15; i++)
                alpha.push_back(i * M_PI / 180.0);

            // Cd table: rows = alpha, cols = mach
            // Based on typical slender launch vehicle data
            std::vector<std::vector<double>> cdData;
            for (size_t ai = 0; ai < alpha.size(); ai++)
            {
                std::vector<double> row;
                double alphaDeg = ai;
                for (size_t mi = 0; mi < mach.size(); mi++)
                {
                    double m = mach[mi];
                    // Base Cd (zero-alpha)
                    double cd0;
                    if (m < 0.8) cd0 = 0.30;
                    else if (m < 1.0) cd0 = 0.30 + 0.35 * (m - 0.8) / 0.2; // transonic rise
                    else if (m < 1.2) cd0 = 0.65; // transonic peak
                    else if (m < 2.0) cd0 = 0.65 - 0.20 * (m - 1.2) / 0.8;
                    else cd0 = 0.45 / std::sqrt(m); // supersonic Prandtl-Glauert

                    // Alpha-dependent increase (crossflow drag)
                    double alphaRad = alpha[ai];
                    double cdAlpha = 1.2 * std::sin(alphaRad) * std::sin(alphaRad);

                    row.push_back(cd0 + cdAlpha);
                }
                cdData.push_back(row);
            }

            // Cl table: lift from angle of attack
            std::vector<std::vector<double>> clData;
            for (size_t ai = 0; ai < alpha.size(); ai++)
            {
                std::vector<double> row;
                double alphaRad = alpha[ai];
                for (size_t mi = 0; mi < mach.size(); mi++)
                {
                    double m = mach[mi];
                    // CN_alpha for slender body (per-radian)
                    double cnAlpha;
                    if (m < 0.8) cnAlpha = 2.0;
                    else if (m < 1.2) cnAlpha = 2.0 + 1.5 * (m - 0.8) / 0.4;
                    else cnAlpha = 3.5 / std::sqrt(m * m - 1.0 + 0.01);

                    row.push_back(cnAlpha * alphaRad);
                }
                clData.push_back(row);
            }

            // Cm table: pitching moment (restoring for stable vehicle)
            std::vector<std::vector<double>> cmData;
            for (size_t ai = 0; ai < alpha.size(); ai++)
            {
                std::vector<double> row;
                double alphaRad = alpha[ai];
                for (size_t mi = 0; mi < mach.size(); mi++)
                {
                    // Negative Cm = statically stable (COP ahead of COM)
                    // Typical launch vehicle is marginally unstable
                    double cmAlpha = 0.5; // positive = unstable
                    row.push_back(cmAlpha * alphaRad);
                }
                cmData.push_back(row);
            }

            model.SetCdTable(AeroTable(mach, alpha, cdData));
            model.SetClTable(AeroTable(mach, alpha, clData));
            model.SetCmTable(AeroTable(mach, alpha, cmData));

            return model;
        }

        /// Falcon 9 first stage (approximate)
        static AeroModel Falcon9FirstStage()
        {
            return GenericLaunchVehicle(3.7); // 3.7m diameter
        }

        /// Starship (approximate)
        static AeroModel Starship()
        {
            return GenericLaunchVehicle(9.0); // 9m diameter
        }

    private:
        AeroTable m_cdTable;
        AeroTable m_clTable;
        AeroTable m_cmTable;

        double m_refArea = 10.75;    // m^2 (Falcon 9 cross-section)
        double m_refLength = 3.7;    // m (Falcon 9 diameter)
        double m_comFromNose = 25.0; // m
    };
}
