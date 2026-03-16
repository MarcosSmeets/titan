#pragma once
#include "guidance/Guidance.h"
#include "orbital/OrbitalMechanics.h"
#include "math/Vector3.h"
#include <cmath>
#include <algorithm>

namespace titan::guidance
{
    /// Powered Explicit Guidance (PEG)
    ///
    /// Iterative guidance algorithm derived from the Saturn V/Space Shuttle
    /// guidance system. Computes optimal thrust direction in real-time to
    /// achieve a target orbit with minimum propellant.
    ///
    /// The algorithm solves for a linear tangent steering law:
    ///   pitch(t) = atan(A + B * t)
    /// where A and B are updated each guidance cycle based on current state
    /// and desired end conditions.
    ///
    /// Reference: NASA TN D-6783, "Explicit Guidance Equations for
    /// Multistage Boost Trajectories" (1972)
    class PoweredExplicitGuidance : public Guidance
    {
    public:
        struct TargetOrbit
        {
            double periapsis = 200000.0;    // m above surface
            double apoapsis = 200000.0;     // m above surface
            double inclination = 0.0;       // rad
        };

        PoweredExplicitGuidance(
            const TargetOrbit &target,
            double bodyRadius,
            double mu)
            : m_target(target),
              m_bodyRadius(bodyRadius),
              m_mu(mu),
              m_A(0.0),
              m_B(0.0),
              m_T(0.0),
              m_tGo(300.0),
              m_converged(false),
              m_cycleCount(0),
              m_lastUpdateTime(-999.0),
              m_updateInterval(1.0),
              m_exhaustVelocity(3100.0),
              m_thrustAccel(15.0)
        {
            // Compute target orbital parameters
            double rp = m_bodyRadius + m_target.periapsis;
            double ra = m_bodyRadius + m_target.apoapsis;
            m_targetSMA = (rp + ra) / 2.0;
            m_targetEcc = (ra - rp) / (ra + rp);

            // Target velocity at insertion (vis-viva)
            m_targetRadius = rp; // inject at periapsis
            m_targetSpeed = std::sqrt(m_mu * (2.0 / m_targetRadius - 1.0 / m_targetSMA));
        }

        void SetEngineParameters(double exhaustVelocity, double thrustAccel)
        {
            m_exhaustVelocity = exhaustVelocity;
            m_thrustAccel = thrustAccel;
        }

        void SetUpdateInterval(double interval) { m_updateInterval = interval; }

        double ComputePitchAngle(
            const titan::integrators::State &state,
            double mu) override
        {
            titan::math::Vector3 pos(state.x, state.y, state.z);
            titan::math::Vector3 vel(state.vx, state.vy, state.vz);

            double r = pos.Magnitude();
            double altitude = r - m_bodyRadius;

            // Phase 1: Vertical ascent (< 500m or < 10s equivalent)
            if (altitude < 500.0)
                return M_PI_2;

            // Phase 2: Initial pitch-over before PEG converges
            if (!m_converged && altitude < 5000.0)
            {
                double kickAngle = 2.0 * M_PI / 180.0; // 2 degree kick
                return M_PI_2 - kickAngle;
            }

            // Phase 3: PEG guidance
            // Update guidance coefficients periodically
            double currentTime = 0.0; // relative time
            if (m_lastUpdateTime < -900.0 ||
                (currentTime - m_lastUpdateTime) >= m_updateInterval)
            {
                UpdateGuidance(pos, vel);
                m_lastUpdateTime = currentTime;
            }

            // Linear tangent steering law: pitch = atan(A + B * tau)
            // where tau is time-to-go estimate
            double pitch = std::atan(m_A + m_B * 0.0); // at current time (tau=0 relative)

            // Clamp to reasonable range
            pitch = std::clamp(pitch, -10.0 * M_PI / 180.0, M_PI_2);

            return pitch;
        }

        bool IsConverged() const { return m_converged; }
        double GetTimeToGo() const { return m_tGo; }
        double GetTargetSpeed() const { return m_targetSpeed; }

    private:
        void UpdateGuidance(
            const titan::math::Vector3 &pos,
            const titan::math::Vector3 &vel)
        {
            double r = pos.Magnitude();
            double v = vel.Magnitude();

            if (r < m_bodyRadius || v < 1.0)
                return;

            // Current orbital elements
            auto rHat = pos.Normalized();
            double vr = titan::math::Vector3::Dot(vel, rHat);    // radial velocity
            double vh = std::sqrt(v * v - vr * vr);              // horizontal velocity

            // Target conditions at burnout
            double rd = m_targetRadius;
            double vd = m_targetSpeed;
            double vrd = 0.0; // zero radial velocity at periapsis insertion

            // Horizontal velocity needed
            double vhd = std::sqrt(vd * vd - vrd * vrd);

            // Velocity-to-be-gained
            double dvr = vrd - vr;
            double dvh = vhd - vh;
            double dvMag = std::sqrt(dvr * dvr + dvh * dvh);

            if (dvMag < 1.0)
            {
                m_converged = true;
                m_tGo = 0.0;
                return;
            }

            // Estimate time-to-go from rocket equation
            // tgo = Ve/a * (1 - exp(-dv/Ve))
            double ve = m_exhaustVelocity;
            double a0 = m_thrustAccel;

            if (a0 < 0.1)
                a0 = 15.0; // fallback

            // Tsiolkovsky: tgo = Ve/a0 * (1 - exp(-dv/Ve))
            // Simplified for guidance: tgo ≈ dv/a_avg
            double tau = ve / a0; // characteristic time
            m_tGo = tau * (1.0 - std::exp(-dvMag / ve));

            if (m_tGo < 1.0)
                m_tGo = 1.0;

            // PEG coefficients A and B
            // A = unit vector toward desired velocity direction (pitch component)
            // B = rate of change to reach target
            //
            // Simplified PEG: compute steering constants from
            // desired end conditions
            double sinGamma_d = vrd / (vd + 1e-10);
            double cosGamma_d = vhd / (vd + 1e-10);

            // Current flight path angle
            double sinGamma = vr / (v + 1e-10);
            double cosGamma = vh / (v + 1e-10);

            // Linear tangent law: A determines initial pitch, B is pitch rate
            // A = tan(gamma_current) approximately
            // B = (tan(gamma_target) - A) / tgo
            m_A = sinGamma / (cosGamma + 1e-10);
            double tanTarget = sinGamma_d / (cosGamma_d + 1e-10);
            m_B = (tanTarget - m_A) / m_tGo;

            // Gravity losses correction
            // Add a term to compensate for gravity during the burn
            double gLocal = m_mu / (r * r);
            double gravityLoss = gLocal * m_tGo * 0.5; // approximate
            dvMag += gravityLoss * 0.3; // partial correction factor

            // Check convergence
            m_cycleCount++;
            if (m_cycleCount > 5 && dvMag < 100.0)
                m_converged = true;

            m_T = m_tGo;
        }

        TargetOrbit m_target;
        double m_bodyRadius;
        double m_mu;

        // PEG state
        double m_A;         // Steering constant A
        double m_B;         // Steering constant B (rate)
        double m_T;         // Predicted total burn time
        double m_tGo;       // Time to go

        bool m_converged;
        int m_cycleCount;
        double m_lastUpdateTime;
        double m_updateInterval;

        // Engine parameters
        double m_exhaustVelocity;
        double m_thrustAccel;

        // Target orbit parameters (derived)
        double m_targetSMA;
        double m_targetEcc;
        double m_targetRadius;
        double m_targetSpeed;
    };
}
