#pragma once
#include <cmath>
#include <algorithm>
#include <string>

namespace titan::propulsion
{
    /// Propellant pair with mixture ratio tracking
    struct PropellantState
    {
        double oxidizerMass = 0.0;  // kg (e.g. LOX)
        double fuelMass = 0.0;     // kg (e.g. RP-1, LCH4)
        double mixtureRatio = 2.56; // O/F ratio (Merlin: 2.36, Raptor: 3.6)

        double TotalMass() const { return oxidizerMass + fuelMass; }

        bool HasPropellant() const
        {
            return oxidizerMass > 0.01 && fuelMass > 0.01;
        }

        /// Burns propellant at given total mass flow rate
        void Burn(double massFlowRate, double dt)
        {
            double totalFlow = massFlowRate * dt;
            double oxFlow = totalFlow * mixtureRatio / (1.0 + mixtureRatio);
            double fuelFlow = totalFlow / (1.0 + mixtureRatio);

            oxidizerMass = std::max(0.0, oxidizerMass - oxFlow);
            fuelMass = std::max(0.0, fuelMass - fuelFlow);
        }
    };

    /// Engine operating state for startup/shutdown transients
    enum class EngineState
    {
        Off,
        Starting,   // Thrust ramp-up (turbopump spin-up)
        Running,
        Shutdown,   // Thrust ramp-down
    };

    /// High-fidelity rocket engine model
    /// Models: variable Isp with altitude, deep throttling, startup/shutdown
    /// transients, and per-propellant consumption tracking.
    class Engine
    {
    public:
        struct Config
        {
            std::string name = "engine";

            // Thrust (vacuum)
            double thrustVacuum = 845000.0;     // N (Merlin 1D Vacuum ~934 kN)

            // Specific impulse
            double ispSeaLevel = 282.0;         // s (Merlin 1D: 282s SL)
            double ispVacuum = 311.0;           // s (Merlin 1D: 311s Vac)

            // Throttle range
            double minThrottle = 0.40;          // Falcon 9: ~40% minimum
            double maxThrottle = 1.0;

            // Mass flow
            double massFlowRateMax = 0.0;       // kg/s (computed from thrust/Isp if 0)

            // Nozzle
            double nozzleExitArea = 0.95;       // m^2
            double nozzleExitPressure = 0.0;    // Pa (0 = optimized for vacuum)
            double chamberPressure = 9.7e6;     // Pa (Merlin: 9.7 MPa)
            double expansionRatio = 16.0;       // Ae/At

            // Transients
            double startupTime = 3.0;           // seconds to reach full thrust
            double shutdownTime = 1.0;          // seconds to reach zero thrust

            // Gimbal
            double maxGimbalAngle = 5.0;        // degrees
            double gimbalRate = 20.0;           // deg/s

            // Engine count (for multi-engine stages)
            int engineCount = 1;
        };

        explicit Engine(const Config &config)
            : m_config(config),
              m_state(EngineState::Off),
              m_throttle(0.0),
              m_commandedThrottle(0.0),
              m_transientProgress(0.0),
              m_gimbalAngle(0.0, 0.0)
        {
            // Compute mass flow from thrust and Isp if not specified
            if (m_config.massFlowRateMax <= 0.0)
            {
                m_config.massFlowRateMax = m_config.thrustVacuum /
                    (m_config.ispVacuum * g0);
            }
        }

        /// Start the engine (begins startup transient)
        void Ignite()
        {
            if (m_state == EngineState::Off)
            {
                m_state = EngineState::Starting;
                m_transientProgress = 0.0;
            }
        }

        /// Command engine shutdown
        void Shutdown()
        {
            if (m_state == EngineState::Running || m_state == EngineState::Starting)
            {
                m_state = EngineState::Shutdown;
                m_transientProgress = 0.0;
            }
        }

        /// Set commanded throttle (clamped to engine's throttle range)
        void SetThrottle(double throttle)
        {
            m_commandedThrottle = std::clamp(throttle,
                m_config.minThrottle, m_config.maxThrottle);
        }

        /// Update engine state (call each timestep)
        /// @param dt timestep in seconds
        /// @param ambientPressure atmospheric pressure at current altitude (Pa)
        /// @param propellant propellant state to consume from
        void Update(double dt, double ambientPressure, PropellantState &propellant)
        {
            // State machine for transients
            switch (m_state)
            {
            case EngineState::Off:
                m_throttle = 0.0;
                break;

            case EngineState::Starting:
                m_transientProgress += dt / m_config.startupTime;
                if (m_transientProgress >= 1.0)
                {
                    m_transientProgress = 1.0;
                    m_state = EngineState::Running;
                }
                // Smooth ramp using cubic Hermite
                m_throttle = m_commandedThrottle * SmoothStep(m_transientProgress);
                break;

            case EngineState::Running:
                m_throttle = m_commandedThrottle;
                break;

            case EngineState::Shutdown:
                m_transientProgress += dt / m_config.shutdownTime;
                if (m_transientProgress >= 1.0)
                {
                    m_transientProgress = 1.0;
                    m_state = EngineState::Off;
                    m_throttle = 0.0;
                    break;
                }
                m_throttle = m_commandedThrottle * (1.0 - SmoothStep(m_transientProgress));
                break;
            }

            // Check propellant
            if (!propellant.HasPropellant())
            {
                m_throttle = 0.0;
                m_state = EngineState::Off;
                return;
            }

            // Consume propellant
            double massFlow = GetMassFlowRate();
            if (massFlow > 0.0)
                propellant.Burn(massFlow, dt);

            // Cache ambient pressure for thrust computation
            m_ambientPressure = ambientPressure;
        }

        /// Current thrust (N) accounting for altitude (pressure) effects
        /// Thrust = mdot * Ve + (Pe - Pa) * Ae
        /// Simplified: T = T_vac - Pa * Ae (for optimized nozzle where Pe ≈ 0)
        double GetThrust() const
        {
            if (m_throttle <= 0.0)
                return 0.0;

            double thrustVac = m_throttle * m_config.thrustVacuum * m_config.engineCount;

            // Pressure thrust loss: ΔT = (P_exit - P_ambient) * A_exit
            // For vacuum-optimized nozzle, P_exit ≈ 0, so loss = -Pa * Ae
            double pressureLoss = m_ambientPressure * m_config.nozzleExitArea
                                  * m_config.engineCount;

            return std::max(0.0, thrustVac - pressureLoss);
        }

        /// Effective Isp at current conditions (seconds)
        double GetEffectiveIsp() const
        {
            double massFlow = GetMassFlowRate();
            if (massFlow < 1e-10)
                return m_config.ispVacuum;

            return GetThrust() / (massFlow * g0);
        }

        /// Isp interpolated between sea level and vacuum by pressure ratio
        double GetIspAtAltitude(double ambientPressure, double seaLevelPressure) const
        {
            if (seaLevelPressure < 1e-10)
                return m_config.ispVacuum;

            double ratio = std::clamp(ambientPressure / seaLevelPressure, 0.0, 1.0);
            return m_config.ispVacuum - (m_config.ispVacuum - m_config.ispSeaLevel) * ratio;
        }

        /// Current total mass flow rate (kg/s)
        double GetMassFlowRate() const
        {
            return m_throttle * m_config.massFlowRateMax * m_config.engineCount;
        }

        /// Current throttle (0-1)
        double GetThrottle() const { return m_throttle; }

        /// Engine state
        EngineState GetState() const { return m_state; }
        bool IsRunning() const { return m_state == EngineState::Running; }
        bool IsOff() const { return m_state == EngineState::Off; }

        /// Gimbal angle (pitch, yaw) in radians
        void SetGimbalCommand(double pitch, double yaw)
        {
            double maxRad = m_config.maxGimbalAngle * M_PI / 180.0;
            m_gimbalAngle.x = std::clamp(pitch, -maxRad, maxRad);
            m_gimbalAngle.y = std::clamp(yaw, -maxRad, maxRad);
        }

        struct Vec2 { double x = 0.0, y = 0.0; };
        Vec2 GetGimbalAngle() const { return m_gimbalAngle; }

        const Config &GetConfig() const { return m_config; }

        // === Preset engine configurations ===

        static Config Merlin1D()
        {
            Config c;
            c.name = "Merlin 1D";
            c.thrustVacuum = 981000.0;
            c.ispSeaLevel = 282.0;
            c.ispVacuum = 311.0;
            c.minThrottle = 0.40;
            c.chamberPressure = 9.7e6;
            c.nozzleExitArea = 0.95;
            c.expansionRatio = 16.0;
            c.startupTime = 3.0;
            c.shutdownTime = 1.0;
            c.maxGimbalAngle = 5.0;
            c.engineCount = 1;
            return c;
        }

        static Config Merlin1DVac()
        {
            Config c;
            c.name = "Merlin 1D Vacuum";
            c.thrustVacuum = 981000.0;
            c.ispSeaLevel = 282.0;
            c.ispVacuum = 348.0;
            c.minThrottle = 0.40;
            c.chamberPressure = 9.7e6;
            c.nozzleExitArea = 3.6;
            c.expansionRatio = 165.0;
            c.startupTime = 4.0;
            c.shutdownTime = 1.5;
            c.maxGimbalAngle = 5.0;
            c.engineCount = 1;
            return c;
        }

        static Config Raptor2()
        {
            Config c;
            c.name = "Raptor 2";
            c.thrustVacuum = 2550000.0;
            c.ispSeaLevel = 327.0;
            c.ispVacuum = 350.0;
            c.minThrottle = 0.20;  // Raptor can throttle very deep
            c.chamberPressure = 30.0e6;
            c.nozzleExitArea = 1.3;
            c.expansionRatio = 40.0;
            c.startupTime = 2.5;
            c.shutdownTime = 0.8;
            c.maxGimbalAngle = 15.0;
            c.engineCount = 1;
            return c;
        }

        static Config RaptorVac()
        {
            Config c;
            c.name = "Raptor Vacuum";
            c.thrustVacuum = 2550000.0;
            c.ispSeaLevel = 327.0;
            c.ispVacuum = 380.0;
            c.minThrottle = 0.20;
            c.chamberPressure = 30.0e6;
            c.nozzleExitArea = 4.0;
            c.expansionRatio = 80.0;
            c.startupTime = 3.0;
            c.shutdownTime = 1.0;
            c.maxGimbalAngle = 0.0; // Fixed nozzle
            c.engineCount = 1;
            return c;
        }

        static Config RS25()
        {
            Config c;
            c.name = "RS-25 (SSME)";
            c.thrustVacuum = 2279000.0;
            c.ispSeaLevel = 366.0;
            c.ispVacuum = 452.0;
            c.minThrottle = 0.67;
            c.chamberPressure = 20.6e6;
            c.nozzleExitArea = 4.17;
            c.expansionRatio = 77.5;
            c.startupTime = 6.0;
            c.shutdownTime = 2.0;
            c.maxGimbalAngle = 10.5;
            c.engineCount = 1;
            return c;
        }

        static Config RD180()
        {
            Config c;
            c.name = "RD-180";
            c.thrustVacuum = 4152000.0;
            c.ispSeaLevel = 311.0;
            c.ispVacuum = 338.0;
            c.minThrottle = 0.47;
            c.chamberPressure = 26.7e6;
            c.nozzleExitArea = 2.4;
            c.expansionRatio = 36.87;
            c.startupTime = 2.5;
            c.shutdownTime = 1.2;
            c.maxGimbalAngle = 8.0;
            c.engineCount = 1;
            return c;
        }

    private:
        static constexpr double g0 = 9.80665;

        static double SmoothStep(double t)
        {
            t = std::clamp(t, 0.0, 1.0);
            return t * t * (3.0 - 2.0 * t); // Hermite interpolation
        }

        Config m_config;
        EngineState m_state;
        double m_throttle;
        double m_commandedThrottle;
        double m_transientProgress;
        double m_ambientPressure = 101325.0;
        Vec2 m_gimbalAngle;
    };
}
