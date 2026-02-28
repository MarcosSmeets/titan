#include "simulation/LaunchVehicle2D.h"
#include <cmath>

using namespace titan::math;

namespace titan::simulation
{
    LaunchVehicle2D::LaunchVehicle2D(double earthRadius, double mu)
        : m_earthRadius(earthRadius),
          m_mu(mu),
          m_pitchAngle(3.141592653589793 / 2.0) // Start vertical (90 degrees)
    {
        // Initial position at Earth's surface
        m_position = Vector2(0.0, earthRadius);

        // Initial velocity is zero
        m_velocity = Vector2(0.0, 0.0);
    }

    void LaunchVehicle2D::AddStage(const Stage &stage)
    {
        m_stages.push_back(stage);
    }

    double LaunchVehicle2D::GetTotalMass() const
    {
        double total = 0.0;

        for (const auto &stage : m_stages)
            total += stage.GetMass();

        return total;
    }

    titan::math::Vector2 LaunchVehicle2D::GetPosition() const
    {
        return m_position;
    }

    titan::math::Vector2 LaunchVehicle2D::GetVelocity() const
    {
        return m_velocity;
    }

    void LaunchVehicle2D::SeparateStageIfNeeded()
    {
        if (!m_stages.empty() && m_stages.front().IsDepleted())
        {
            // Remove empty stage (stage separation event)
            m_stages.erase(m_stages.begin());
        }
    }

    void LaunchVehicle2D::Update(double dt)
    {
        if (m_stages.empty())
            return;

        Stage &activeStage = m_stages.front();

        // Burn fuel
        activeStage.Burn(dt);

        // Separate if empty
        SeparateStageIfNeeded();

        double totalMass = GetTotalMass();

        // Compute gravitational acceleration (1/r²)
        double r = m_position.Magnitude();
        double gravityMagnitude = -m_mu / (r * r);

        Vector2 gravityDir = m_position.Normalized();
        Vector2 gravity = gravityDir * gravityMagnitude;

        // Thrust direction based on pitch angle
        Vector2 thrustDir(std::cos(m_pitchAngle),
                          std::sin(m_pitchAngle));

        double thrustMagnitude = activeStage.GetThrust();
        Vector2 thrust = thrustDir * (thrustMagnitude / totalMass);

        // Total acceleration
        Vector2 acceleration = gravity + thrust;

        // Simple Euler integration (temporary, will abstract later)
        m_velocity += acceleration * dt;
        m_position += m_velocity * dt;
    }
}