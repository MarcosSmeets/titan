#pragma once
#include "math/Vector3.h"
#include "simulation/SimState.h"
#include <cmath>
#include <algorithm>

namespace titan::landing
{
    /// Flight phase for booster recovery
    enum class RecoveryPhase
    {
        Ascent,         // Still attached or ascending
        Separation,     // Just separated, coasting
        Boostback,      // Flipping and burning to reverse trajectory
        Coasting,       // Ballistic arc after boostback
        EntryBurn,      // Supersonic retropropulsion (3-engine)
        Aero,           // Aerodynamic deceleration (grid fins)
        LandingBurn,    // Final hoverslam (1-engine)
        Landed,         // Touchdown
        Failed          // Off-nominal
    };

    /// Boostback burn guidance
    /// Computes thrust direction to target a specific landing site
    struct BoostbackGuidance
    {
        titan::math::Vector3 landingTarget; // target position (inertial)
        double bodyRadius = 6371000.0;

        /// Compute thrust direction for boostback
        /// Points thrust opposite to the velocity component that takes
        /// us away from the landing site
        titan::math::Vector3 ComputeThrustDirection(
            const titan::math::Vector3 &position,
            const titan::math::Vector3 &velocity) const
        {
            // Vector from current position to landing target (along surface)
            auto toTarget = landingTarget - position;

            // Project velocity onto target direction
            double toTargetMag = toTarget.Magnitude();
            if (toTargetMag < 1.0)
                return -velocity.Normalized(); // Already at target, just kill velocity

            auto targetDir = toTarget.Normalized();
            double vAlongTarget = titan::math::Vector3::Dot(velocity, targetDir);

            // We want to cancel the "away from target" component of velocity
            // and build up "toward target" component
            // Thrust opposite to current velocity vector with bias toward target
            auto vUnwanted = velocity - targetDir * vAlongTarget;

            // Blend: mostly retrograde early, more toward-target later
            double blend = std::clamp(vAlongTarget / 500.0, -1.0, 1.0);
            auto thrustDir = (-vUnwanted.Normalized()) * (1.0 - std::abs(blend) * 0.5)
                           + targetDir * (blend > 0 ? 0.0 : 0.3);

            double mag = thrustDir.Magnitude();
            return (mag > 1e-10) ? thrustDir / mag : -velocity.Normalized();
        }

        /// Check if boostback is complete (velocity points toward target)
        bool IsComplete(
            const titan::math::Vector3 &position,
            const titan::math::Vector3 &velocity) const
        {
            auto toTarget = landingTarget - position;
            double dot = titan::math::Vector3::Dot(velocity.Normalized(),
                                                    toTarget.Normalized());
            // Complete when velocity is mostly toward target
            // and we have enough horizontal velocity reversed
            return dot > 0.85;
        }
    };

    /// Entry burn guidance (supersonic retropropulsion)
    /// Burns 3 engines at high altitude to reduce velocity before
    /// entering thick atmosphere
    struct EntryBurnGuidance
    {
        double targetSpeed = 700.0;    // m/s — target speed after entry burn
        double startAltitude = 70000.0; // m — altitude to begin entry burn
        double startSpeed = 1500.0;     // m/s — speed threshold

        /// Should entry burn start?
        bool ShouldStart(double altitude, double speed) const
        {
            return altitude < startAltitude && speed > startSpeed;
        }

        /// Should entry burn end?
        bool ShouldEnd(double speed) const
        {
            return speed < targetSpeed;
        }

        /// Thrust direction: retrograde (opposite velocity)
        titan::math::Vector3 ComputeThrustDirection(
            const titan::math::Vector3 &velocity) const
        {
            double v = velocity.Magnitude();
            if (v < 1e-10)
                return titan::math::Vector3(0, 0, 1);
            return -velocity.Normalized();
        }
    };

    /// Landing burn guidance (hoverslam / suicide burn)
    /// Single-engine precision landing at minimum fuel cost.
    /// Computes optimal ignition altitude for zero-velocity touchdown.
    ///
    /// Based on the SpaceX approach: compute when to ignite so that
    /// constant-thrust deceleration reaches v=0 at h=0 simultaneously.
    struct LandingBurnGuidance
    {
        double bodyRadius = 6371000.0;
        double thrustToWeight = 0.0; // T/W at landing mass (computed)

        /// Compute optimal ignition altitude for hoverslam
        /// @param speed current speed (m/s)
        /// @param altitude current altitude (m)
        /// @param mass vehicle mass (kg)
        /// @param maxThrust available thrust (N)
        /// @param g local gravity (m/s^2)
        /// @return altitude at which to ignite (m)
        double ComputeIgnitionAltitude(
            double speed, double altitude,
            double mass, double maxThrust, double g) const
        {
            if (maxThrust <= 0 || mass <= 0)
                return 0.0;

            double T_W = maxThrust / (mass * g);
            double decel = g * (T_W - 1.0); // net deceleration

            if (decel <= 0.0)
                return altitude; // Can't decel, burn now!

            // Kinematic: v^2 = 2 * decel * h_burn
            // h_burn = v^2 / (2 * decel)
            double h_burn = speed * speed / (2.0 * decel);

            // Add safety margin (10%)
            return h_burn * 1.10;
        }

        /// Should landing burn start?
        bool ShouldIgnite(
            double altitude, double speed, double verticalSpeed,
            double mass, double maxThrust, double g) const
        {
            // Only consider when descending
            if (verticalSpeed > 0)
                return false;

            double ignitionAlt = ComputeIgnitionAltitude(
                std::abs(verticalSpeed), altitude, mass, maxThrust, g);

            return altitude <= ignitionAlt;
        }

        /// Compute throttle for constant-deceleration landing
        /// Aims for zero velocity at zero altitude
        double ComputeThrottle(
            double altitude, double speed,
            double mass, double maxThrust, double g) const
        {
            if (altitude < 0.5)
                return 0.0; // Landed

            if (maxThrust <= 0 || mass <= 0)
                return 0.0;

            // Desired deceleration to reach v=0 at h=0
            // v^2 = v0^2 - 2*a*h → a = v^2 / (2*h)
            double desiredDecel = speed * speed / (2.0 * altitude + 1.0);

            // Required thrust: T = m * (a + g)
            double requiredThrust = mass * (desiredDecel + g);

            // Throttle = required / max
            double throttle = requiredThrust / maxThrust;

            return std::clamp(throttle, 0.3, 1.0);
        }

        /// Thrust direction: retrograde with position correction
        /// Steers toward landing site while decelerating
        titan::math::Vector3 ComputeThrustDirection(
            const titan::math::Vector3 &position,
            const titan::math::Vector3 &velocity,
            const titan::math::Vector3 &targetPosition) const
        {
            double speed = velocity.Magnitude();
            if (speed < 1e-10)
                return position.Normalized(); // Hover: point up

            // Primary: retrograde
            auto retrograde = -velocity.Normalized();

            // Secondary: lateral correction toward target
            auto toTarget = targetPosition - position;
            double lateralDist = toTarget.Magnitude();

            if (lateralDist < 10.0 || speed < 10.0)
                return retrograde;

            // Blend in lateral correction (max 15 degrees off retrograde)
            auto lateral = toTarget.Normalized();
            double correctionGain = std::clamp(lateralDist / 1000.0, 0.0, 0.26);

            auto thrustDir = retrograde + lateral * correctionGain;
            return thrustDir.Normalized();
        }

        /// Check if vehicle has landed
        bool HasLanded(double altitude, double speed) const
        {
            return altitude < 1.0 && speed < 2.0;
        }
    };

    /// Complete booster recovery controller
    /// Manages all phases from separation to touchdown
    class BoosterRecovery
    {
    public:
        BoosterRecovery()
            : m_phase(RecoveryPhase::Ascent) {}

        void SetLandingTarget(const titan::math::Vector3 &target)
        {
            m_boostback.landingTarget = target;
        }

        void SetBodyRadius(double r)
        {
            m_boostback.bodyRadius = r;
            m_landingBurn.bodyRadius = r;
        }

        void Separate()
        {
            m_phase = RecoveryPhase::Separation;
            m_phaseTime = 0.0;
        }

        struct GuidanceCommand
        {
            titan::math::Vector3 thrustDirection;
            double throttle = 0.0;
            int engineCount = 0; // 0=coast, 1=landing, 3=entry, 9=boostback
            bool ignite = false;
            bool shutdown = false;
        };

        /// Update recovery guidance
        GuidanceCommand Update(
            const titan::math::Vector3 &position,
            const titan::math::Vector3 &velocity,
            double mass, double maxThrustPerEngine,
            double dt)
        {
            GuidanceCommand cmd;
            double r = position.Magnitude();
            double altitude = r - m_boostback.bodyRadius;
            double speed = velocity.Magnitude();
            double g = 3.986e14 / (r * r);

            // Vertical speed (positive = ascending)
            double vVert = titan::math::Vector3::Dot(
                velocity, position.Normalized());

            m_phaseTime += dt;

            switch (m_phase)
            {
            case RecoveryPhase::Ascent:
                break;

            case RecoveryPhase::Separation:
                // Wait briefly after separation before flipping
                if (m_phaseTime > 3.0)
                {
                    m_phase = RecoveryPhase::Boostback;
                    m_phaseTime = 0.0;
                    cmd.ignite = true;
                }
                break;

            case RecoveryPhase::Boostback:
                cmd.engineCount = 3; // 3 engines for boostback (Falcon 9)
                cmd.throttle = 1.0;
                cmd.thrustDirection = m_boostback.ComputeThrustDirection(
                    position, velocity);

                if (m_boostback.IsComplete(position, velocity) ||
                    m_phaseTime > 60.0) // timeout
                {
                    m_phase = RecoveryPhase::Coasting;
                    m_phaseTime = 0.0;
                    cmd.shutdown = true;
                }
                break;

            case RecoveryPhase::Coasting:
                // Ballistic arc — wait for entry burn conditions
                if (m_entryBurn.ShouldStart(altitude, speed) && vVert < 0)
                {
                    m_phase = RecoveryPhase::EntryBurn;
                    m_phaseTime = 0.0;
                    cmd.ignite = true;
                }
                break;

            case RecoveryPhase::EntryBurn:
                cmd.engineCount = 3;
                cmd.throttle = 1.0;
                cmd.thrustDirection = m_entryBurn.ComputeThrustDirection(velocity);

                if (m_entryBurn.ShouldEnd(speed) || m_phaseTime > 30.0)
                {
                    m_phase = RecoveryPhase::Aero;
                    m_phaseTime = 0.0;
                    cmd.shutdown = true;
                }
                break;

            case RecoveryPhase::Aero:
            {
                // Aerodynamic deceleration phase (grid fins)
                // Wait for landing burn conditions
                double thrustSingle = maxThrustPerEngine;
                if (m_landingBurn.ShouldIgnite(
                    altitude, std::abs(vVert), vVert,
                    mass, thrustSingle, g))
                {
                    m_phase = RecoveryPhase::LandingBurn;
                    m_phaseTime = 0.0;
                    cmd.ignite = true;
                }
                break;
            }

            case RecoveryPhase::LandingBurn:
            {
                cmd.engineCount = 1; // Single engine for landing
                double thrustSingle = maxThrustPerEngine;
                cmd.throttle = m_landingBurn.ComputeThrottle(
                    altitude, std::abs(vVert), mass, thrustSingle, g);
                cmd.thrustDirection = m_landingBurn.ComputeThrustDirection(
                    position, velocity, m_boostback.landingTarget);

                if (m_landingBurn.HasLanded(altitude, speed))
                {
                    m_phase = RecoveryPhase::Landed;
                    cmd.shutdown = true;
                    cmd.throttle = 0.0;
                }
                break;
            }

            case RecoveryPhase::Landed:
            case RecoveryPhase::Failed:
                cmd.throttle = 0.0;
                break;
            }

            return cmd;
        }

        RecoveryPhase GetPhase() const { return m_phase; }

        const char* GetPhaseString() const
        {
            switch (m_phase)
            {
                case RecoveryPhase::Ascent:      return "Ascent";
                case RecoveryPhase::Separation:   return "Separation";
                case RecoveryPhase::Boostback:    return "Boostback";
                case RecoveryPhase::Coasting:     return "Coasting";
                case RecoveryPhase::EntryBurn:    return "Entry Burn";
                case RecoveryPhase::Aero:         return "Aero Braking";
                case RecoveryPhase::LandingBurn:  return "Landing Burn";
                case RecoveryPhase::Landed:       return "Landed";
                case RecoveryPhase::Failed:       return "Failed";
            }
            return "Unknown";
        }

    private:
        RecoveryPhase m_phase;
        double m_phaseTime = 0.0;
        BoostbackGuidance m_boostback;
        EntryBurnGuidance m_entryBurn;
        LandingBurnGuidance m_landingBurn;
    };
}
