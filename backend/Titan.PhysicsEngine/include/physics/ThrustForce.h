#pragma once
#include "physics/ForceModel.h"
#include "environment/Atmosphere.h"
#include <cmath>
#include <functional>

namespace titan::physics
{
    class ThrustForce : public ForceModel
    {
    public:
        using DirectionFunction = std::function<titan::math::Vector3(
            const titan::simulation::SimState &state)>;

        ThrustForce(
            double thrustMagnitude,
            DirectionFunction directionFunc)
            : m_thrustMagnitude(thrustMagnitude),
              m_directionFunc(std::move(directionFunc)),
              m_ispSeaLevel(0.0),
              m_ispVacuum(0.0),
              m_atmosphere(nullptr),
              m_bodyRadius(0.0),
              m_altitudeIspEnabled(false) {}

        ThrustForce(
            double thrustMagnitude,
            DirectionFunction directionFunc,
            double ispSeaLevel,
            double ispVacuum,
            const titan::environment::Atmosphere *atmosphere,
            double bodyRadius)
            : m_thrustMagnitude(thrustMagnitude),
              m_directionFunc(std::move(directionFunc)),
              m_ispSeaLevel(ispSeaLevel),
              m_ispVacuum(ispVacuum),
              m_atmosphere(atmosphere),
              m_bodyRadius(bodyRadius),
              m_altitudeIspEnabled(true) {}

        void SetThrustMagnitude(double thrust) { m_thrustMagnitude = thrust; }
        void SetDirection(DirectionFunction fn) { m_directionFunc = std::move(fn); }

        /// Enable gimbal-based thrust vector control.
        /// @param gimbalArm Distance from CoM to nozzle pivot (m) — torque = thrust x arm
        void SetGimbalArm(double arm) { m_gimbalArm = arm; }

        titan::math::Vector3 ComputeTorque(
            const titan::simulation::SimState &state,
            double /*time*/) const override
        {
            if (m_thrustMagnitude <= 0.0 || m_gimbalArm <= 0.0)
                return {};

            titan::math::Vector3 direction = m_directionFunc(state);
            double dirMag = direction.Magnitude();
            if (dirMag < 1e-10)
                return {};
            direction = direction / dirMag;

            // Vehicle body axis (nadir-pointing, approximate as -position)
            auto bodyAxis = state.position.Normalized();

            // Torque = gimbalArm * (bodyAxis x thrustDirection) * thrustMagnitude
            // This produces torque proportional to the off-axis angle of thrust
            auto cross = titan::math::Vector3::Cross(bodyAxis, direction);
            double crossMag = cross.Magnitude();
            if (crossMag < 1e-15)
                return {};

            return cross * (m_thrustMagnitude * m_gimbalArm);
        }

        double GetEffectiveIsp(double altitude) const
        {
            if (!m_altitudeIspEnabled || !m_atmosphere)
                return m_ispVacuum > 0.0 ? m_ispVacuum : m_thrustMagnitude;

            double pressure = m_atmosphere->GetPressure(altitude);
            double seaLevelPressure = m_atmosphere->GetPressure(0.0);

            if (seaLevelPressure < 1e-10)
                return m_ispVacuum;

            double pressureRatio = pressure / seaLevelPressure;
            return m_ispVacuum - (m_ispVacuum - m_ispSeaLevel) * pressureRatio;
        }

        titan::math::Vector3 ComputeForce(
            const titan::simulation::SimState &state,
            double /*time*/) const override
        {
            if (m_thrustMagnitude <= 0.0)
                return {};

            titan::math::Vector3 direction = m_directionFunc(state);
            double dirMag = direction.Magnitude();
            if (dirMag < 1e-10)
                return {};

            direction = direction / dirMag;

            double thrust = m_thrustMagnitude;
            if (m_altitudeIspEnabled && m_atmosphere)
            {
                double altitude = state.position.Magnitude() - m_bodyRadius;
                if (altitude < 0.0)
                    altitude = 0.0;

                double effectiveIsp = GetEffectiveIsp(altitude);
                double nominalIsp = m_ispVacuum;
                if (nominalIsp > 0.0)
                    thrust *= effectiveIsp / nominalIsp;
            }

            return direction * thrust;
        }

    private:
        double m_thrustMagnitude;
        DirectionFunction m_directionFunc;
        double m_ispSeaLevel;
        double m_ispVacuum;
        const titan::environment::Atmosphere *m_atmosphere;
        double m_bodyRadius;
        bool m_altitudeIspEnabled;
        double m_gimbalArm = 0.0;
    };
}
