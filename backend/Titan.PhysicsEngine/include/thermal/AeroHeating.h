#pragma once
#include <cmath>
#include <algorithm>

namespace titan::thermal
{
    /// Aerothermal heating model for reentry vehicles
    /// Implements Sutton-Graves convective heating correlation and
    /// radiative heating estimates for high-velocity reentry.
    class AeroHeating
    {
    public:
        struct Config
        {
            double noseRadius = 1.0;        // m (effective nose radius)
            double emissivity = 0.85;        // surface emissivity (TPS)
            double absorptivity = 0.90;      // solar absorptivity
            double specificHeat = 1000.0;    // J/(kg·K) TPS material
            double tpsMass = 500.0;          // kg total TPS mass
            double maxTemperature = 1900.0;  // K (material limit, e.g. PICA-X: ~1900K)
        };

        struct HeatingState
        {
            double convectiveHeatFlux = 0.0;  // W/m^2
            double radiativeHeatFlux = 0.0;   // W/m^2
            double totalHeatFlux = 0.0;       // W/m^2
            double totalHeatLoad = 0.0;       // J/m^2 (integrated)
            double surfaceTemperature = 300.0; // K
            double maxHeatFlux = 0.0;         // W/m^2 (peak during reentry)
            bool overheated = false;
        };

        AeroHeating() : m_config() {}

        explicit AeroHeating(const Config &config)
            : m_config(config) {}

        /// Update heating state for current flight conditions
        /// @param density atmospheric density (kg/m^3)
        /// @param velocity vehicle speed (m/s)
        /// @param dt timestep (s)
        void Update(double density, double velocity, double dt)
        {
            // Sutton-Graves convective heating correlation
            // q_conv = K * sqrt(rho / R_n) * V^3
            // K = 1.7415e-4 for Earth (W·s^3/(kg^0.5·m^3))
            double K_earth = 1.7415e-4;

            double sqrtRhoOverRn = 0.0;
            if (density > 1e-15 && m_config.noseRadius > 0.01)
                sqrtRhoOverRn = std::sqrt(density / m_config.noseRadius);

            m_state.convectiveHeatFlux = K_earth * sqrtRhoOverRn *
                                         velocity * velocity * velocity;

            // Radiative heating (significant above ~8 km/s)
            // q_rad ≈ C * rho^1.22 * R_n^0.49 * V^8.5 (Tauber-Sutton)
            // Only significant for high-energy reentry (>10 km/s)
            if (velocity > 8000.0)
            {
                double C_rad = 4.736e-39; // empirical constant
                m_state.radiativeHeatFlux = C_rad *
                    std::pow(density, 1.22) *
                    std::pow(m_config.noseRadius, 0.49) *
                    std::pow(velocity, 8.5);
            }
            else
            {
                m_state.radiativeHeatFlux = 0.0;
            }

            m_state.totalHeatFlux = m_state.convectiveHeatFlux +
                                    m_state.radiativeHeatFlux;

            // Track peak
            if (m_state.totalHeatFlux > m_state.maxHeatFlux)
                m_state.maxHeatFlux = m_state.totalHeatFlux;

            // Integrate total heat load
            m_state.totalHeatLoad += m_state.totalHeatFlux * dt;

            // Surface temperature (radiative equilibrium)
            // q_in = epsilon * sigma * T^4  →  T = (q / (eps * sigma))^0.25
            if (m_state.totalHeatFlux > 0.0)
            {
                double sigma = 5.670374e-8; // Stefan-Boltzmann constant
                double T_eq = std::pow(
                    m_state.totalHeatFlux / (m_config.emissivity * sigma),
                    0.25);

                // Thermal inertia: temperature lags behind equilibrium
                double tau = m_config.tpsMass * m_config.specificHeat /
                             (m_config.emissivity * sigma *
                              std::pow(m_state.surfaceTemperature, 3) + 1.0);
                tau = std::clamp(tau, 1.0, 1000.0);

                double alpha = dt / (dt + tau);
                m_state.surfaceTemperature += alpha * (T_eq - m_state.surfaceTemperature);
            }
            else
            {
                // Cooling by radiation only
                double sigma = 5.670374e-8;
                double radiatedPower = m_config.emissivity * sigma *
                    std::pow(m_state.surfaceTemperature, 4);
                double dT = radiatedPower * dt /
                    (m_config.tpsMass * m_config.specificHeat + 1.0);
                m_state.surfaceTemperature = std::max(200.0,
                    m_state.surfaceTemperature - dT);
            }

            // Check thermal limit
            m_state.overheated = m_state.surfaceTemperature > m_config.maxTemperature;
        }

        /// Reset heating state
        void Reset()
        {
            m_state = HeatingState();
        }

        const HeatingState &GetState() const { return m_state; }
        const Config &GetConfig() const { return m_config; }

        // === Preset TPS configurations ===

        static Config PICAX()
        {
            Config c;
            c.noseRadius = 1.3;
            c.emissivity = 0.85;
            c.specificHeat = 1260.0;
            c.tpsMass = 300.0;
            c.maxTemperature = 1900.0;
            return c;
        }

        static Config StarshipTiles()
        {
            Config c;
            c.noseRadius = 4.5;
            c.emissivity = 0.80;
            c.specificHeat = 850.0;
            c.tpsMass = 8000.0;
            c.maxTemperature = 1500.0;
            return c;
        }

        static Config ShuttleTiles()
        {
            Config c;
            c.noseRadius = 1.0;
            c.emissivity = 0.85;
            c.specificHeat = 1050.0;
            c.tpsMass = 7700.0;
            c.maxTemperature = 1650.0;
            return c;
        }

    private:
        Config m_config;
        HeatingState m_state;
    };
}
