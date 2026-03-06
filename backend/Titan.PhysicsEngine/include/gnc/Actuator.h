#pragma once
#include "simulation/SimState.h"
#include "math/Vector3.h"

namespace titan::gnc
{
    class Actuator
    {
    public:
        virtual ~Actuator() = default;

        virtual titan::math::Vector3 ComputeTorque(
            double command,
            const titan::simulation::SimState &state) const = 0;

        virtual titan::math::Vector3 ComputeForce(
            double command,
            const titan::simulation::SimState &state) const = 0;
    };

    class ReactionWheel : public Actuator
    {
    public:
        ReactionWheel(titan::math::Vector3 axis, double maxTorque)
            : m_axis(axis.Normalized()), m_maxTorque(maxTorque) {}

        titan::math::Vector3 ComputeTorque(
            double command,
            const titan::simulation::SimState & /*state*/) const override
        {
            double torque = command * m_maxTorque;
            return m_axis * torque;
        }

        titan::math::Vector3 ComputeForce(
            double /*command*/,
            const titan::simulation::SimState & /*state*/) const override
        {
            return {}; // Reaction wheels produce no net force
        }

    private:
        titan::math::Vector3 m_axis;
        double m_maxTorque;
    };

    class Thruster : public Actuator
    {
    public:
        Thruster(titan::math::Vector3 direction, titan::math::Vector3 offset,
                 double maxThrust)
            : m_direction(direction.Normalized()),
              m_offset(offset),
              m_maxThrust(maxThrust) {}

        titan::math::Vector3 ComputeTorque(
            double command,
            const titan::simulation::SimState & /*state*/) const override
        {
            titan::math::Vector3 force = m_direction * (command * m_maxThrust);
            return titan::math::Vector3::Cross(m_offset, force);
        }

        titan::math::Vector3 ComputeForce(
            double command,
            const titan::simulation::SimState & /*state*/) const override
        {
            return m_direction * (command * m_maxThrust);
        }

    private:
        titan::math::Vector3 m_direction;
        titan::math::Vector3 m_offset;
        double m_maxThrust;
    };
}
