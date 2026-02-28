#include "simulation/LaunchVehicle2D.h"
#include <cmath>
#include <iostream>
#include <cstdlib>

namespace titan::simulation
{

    LaunchVehicle2D::LaunchVehicle2D(
        double earthRadius,
        double mu,
        std::unique_ptr<titan::integrators::Integrator> integrator,
        std::unique_ptr<titan::guidance::Guidance> guidance)
        : m_earthRadius(earthRadius),
          m_mu(mu),
          m_integrator(std::move(integrator)),
          m_guidance(std::move(guidance))
    {
        // Initialize rocket at Earth's surface
        m_state.x = earthRadius + 1.0; // 1 meter above surface
        m_state.y = 0.0;
        m_state.vx = 0.0;
        m_state.vy = 0.0;
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
        double r = std::sqrt(m_state.x * m_state.x +
                             m_state.y * m_state.y);

        if (r <= m_earthRadius - 1.0)
        {
            std::cout << "Rocket impacted Earth.\n";
            std::exit(0);
        }

        double totalMass = GetTotalMass();

        if (totalMass <= 0.0)
        {
            std::cout << "All stages depleted. Simulation stopping.\n";
            std::exit(0);
        }

        double pitch = m_guidance->ComputePitchAngle(
            m_state,
            m_mu);

        double thrustX = 0.0;
        double thrustY = 0.0;

        if (!m_stages.empty() && m_stages.front().HasFuel())
        {
            m_stages.front().Burn(dt);
            double thrust = m_stages.front().GetThrust();

            thrustX = thrust * std::cos(pitch);
            thrustY = thrust * std::sin(pitch);
        }

        // ---- Physics integration using generic integrator ----

        auto derivativeFunc =
            [&](const titan::integrators::State &state)
            -> titan::integrators::Derivative
        {
            titan::integrators::Derivative d;

            double radius = std::sqrt(state.x * state.x +
                                      state.y * state.y);

            // Position derivatives
            d.dx = state.vx;
            d.dy = state.vy;

            // Gravitational acceleration
            double factor = -m_mu / (radius * radius * radius);

            double ax_gravity = factor * state.x;
            double ay_gravity = factor * state.y;

            // Thrust acceleration
            double ax_thrust = thrustX / totalMass;
            double ay_thrust = thrustY / totalMass;

            d.dvx = ax_gravity + ax_thrust;
            d.dvy = ay_gravity + ay_thrust;

            return d;
        };

        m_state = m_integrator->Step(
            m_state,
            dt,
            derivativeFunc);

        SeparateStageIfNeeded();
    }

    void LaunchVehicle2D::SeparateStageIfNeeded()
    {
        if (!m_stages.empty() && m_stages.front().IsDepleted())
        {
            std::cout << "Stage separation.\n";
            m_stages.erase(m_stages.begin());
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

}