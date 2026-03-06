#include "simulation/LaunchVehicle2D.h"
#include <cmath>

namespace titan::simulation
{

    static constexpr double g0 = 9.80665;

    LaunchVehicle2D::LaunchVehicle2D(
        double earthRadius,
        double mu,
        std::unique_ptr<titan::integrators::Integrator> integrator,
        std::unique_ptr<titan::guidance::Guidance> guidance)
        : m_earthRadius(earthRadius),
          m_mu(mu),
          m_integrator(std::move(integrator)),
          m_guidance(std::move(guidance)),
          m_impacted(false),
          m_stageIndex(0)
    {
        m_state.x = earthRadius + 1.0;
        m_state.y = 0.0;
        m_state.vx = 0.0;
        m_state.vy = 0.0;
    }

    void LaunchVehicle2D::SetMaxG(double maxG)
    {
        m_maxG = maxG;
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

    void LaunchVehicle2D::Update(double dt)
    {
        if (m_impacted)
            return;

        double totalMass = GetTotalMass();
        if (totalMass <= 0.0)
            return;

        double r = std::sqrt(m_state.x * m_state.x +
                             m_state.y * m_state.y);

        if (r <= m_earthRadius - 1.0)
        {
            m_impacted = true;
            return;
        }

        double altitude = r - m_earthRadius;
        double density = m_atmosphere.GetDensity(altitude);

        double pitch = m_guidance->ComputePitchAngle(
            m_state,
            m_mu);

        double thrustX = 0.0;
        double thrustY = 0.0;

        if (!m_stages.empty() && m_stages.front().HasFuel())
        {
            Stage &stage = m_stages.front();

            double thrust = stage.GetThrust();
            double accel = thrust / totalMass;

            double currentG = accel / g0;

            if (currentG > m_maxG)
            {
                double requiredAccel = m_maxG * g0;
                double requiredThrust = requiredAccel * totalMass;

                double newThrottle =
                    requiredThrust /
                    (stage.GetMass() > 0.0
                         ? stage.GetThrust() / stage.GetMass() * stage.GetMass()
                         : thrust);

                stage.SetThrottle(newThrottle);
            }

            stage.Burn(dt);

            thrust = stage.GetThrust();

            thrustX = thrust * std::cos(pitch);
            thrustY = thrust * std::sin(pitch);
        }

        auto derivativeFunc =
            [&](const titan::integrators::State &state)
            -> titan::integrators::Derivative
        {
            titan::integrators::Derivative d;

            double radius = std::sqrt(state.x * state.x +
                                      state.y * state.y);

            d.dx = state.vx;
            d.dy = state.vy;

            double factor = -m_mu / (radius * radius * radius);

            double ax_gravity = factor * state.x;
            double ay_gravity = factor * state.y;

            double vx = state.vx;
            double vy = state.vy;
            double speed = std::sqrt(vx * vx + vy * vy);

            double ax_drag = 0.0;
            double ay_drag = 0.0;

            if (!m_stages.empty())
            {
                const Stage &stage = m_stages.front();

                double dragForce =
                    0.5 * density *
                    speed * speed *
                    stage.GetDragCoefficient() *
                    stage.GetReferenceArea();

                if (speed > 0.0)
                {
                    ax_drag = -dragForce * (vx / speed) / totalMass;
                    ay_drag = -dragForce * (vy / speed) / totalMass;
                }
            }

            double ax_thrust = thrustX / totalMass;
            double ay_thrust = thrustY / totalMass;

            d.dz = 0.0;
            d.dvx = ax_gravity + ax_thrust + ax_drag;
            d.dvy = ay_gravity + ay_thrust + ay_drag;
            d.dvz = 0.0;

            return d;
        };

        auto result = m_integrator->Step(
            m_state,
            dt,
            derivativeFunc);
        m_state = result.state;

        SeparateStageIfNeeded();
    }

    void LaunchVehicle2D::SeparateStageIfNeeded()
    {
        if (!m_stages.empty() && m_stages.front().IsDepleted())
        {
            m_stages.erase(m_stages.begin());
            m_stageIndex++;
        }
    }

    titan::math::Vector2 LaunchVehicle2D::GetPosition() const
    {
        return {m_state.x, m_state.y};
    }

    titan::math::Vector2 LaunchVehicle2D::GetVelocity() const
    {
        return {m_state.vx, m_state.vy};
    }

    bool LaunchVehicle2D::HasImpacted() const
    {
        return m_impacted;
    }

    int LaunchVehicle2D::GetStageIndex() const
    {
        return m_stageIndex;
    }
}
