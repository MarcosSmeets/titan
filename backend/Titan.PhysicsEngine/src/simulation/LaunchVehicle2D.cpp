#include "simulation/LaunchVehicle2D.h"
#include <cmath>

using namespace titan::math;

namespace titan::simulation
{
    LaunchVehicle2D::LaunchVehicle2D(double earthRadius, double mu, std::unique_ptr<titan::integration::Integrator> integrator)
        : m_earthRadius(earthRadius),
          m_mu(mu),
          m_integrator(std::move(integrator)),
          m_pitchAngle(3.141592653589793 / 2.0) // Start vertical (90 degrees)
    {
        m_state = {0.0, earthRadius, 0.0, 0.0};
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
        return Vector2(m_state.x, m_state.y);
    }

    titan::math::Vector2 LaunchVehicle2D::GetVelocity() const
    {
        return Vector2(m_state.vx, m_state.vy);
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

        double thrustMagnitude = activeStage.GetThrust();

        auto derivativeFunc = [this, totalMass, thrustMagnitude](const titan::integration::State &s)
        {
            titan::integration::Derivative d;

            double r = std::sqrt(s.x * s.x + s.y * s.y);
            double gravityMagnitude = -m_mu / (r * r);

            double gx = gravityMagnitude * (s.x / r);
            double gy = gravityMagnitude * (s.y / r);

            double tx = std::cos(m_pitchAngle) * (thrustMagnitude / totalMass);
            double ty = std::sin(m_pitchAngle) * (thrustMagnitude / totalMass);

            d.dx = s.vx;
            d.dy = s.vy;
            d.dvx = gx + tx;
            d.dvy = gy + ty;

            return d;
        };

        m_state = m_integrator->Step(m_state, dt, derivativeFunc);
    }
}