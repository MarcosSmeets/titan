#include "simulation/LaunchVehicle3D.h"
#include <cmath>
#include <iostream>

namespace titan::simulation
{
    static constexpr double g0 = 9.80665;

    LaunchVehicle3D::LaunchVehicle3D(
        double earthRadius,
        double mu,
        std::unique_ptr<titan::integrators::Integrator> integrator,
        std::unique_ptr<titan::guidance::Guidance> guidance)
        : m_earthRadius(earthRadius),
          m_mu(mu),
          m_integrator(std::move(integrator)),
          m_guidance(std::move(guidance))
    {
        m_state = {
            earthRadius + 1.0, 0.0, 0.0,
            0.0, 0.0, 0.0};
    }

    void LaunchVehicle3D::SetMaxG(double maxG)
    {
        m_maxG = maxG;
    }

    void LaunchVehicle3D::AddStage(const Stage &stage)
    {
        m_stages.push_back(stage);
    }

    double LaunchVehicle3D::GetTotalMass() const
    {
        double total = 0.0;
        for (const auto &s : m_stages)
            total += s.GetMass();
        return total;
    }

    void LaunchVehicle3D::Update(double dt)
    {
        double totalMass = GetTotalMass();
        if (totalMass <= 0.0)
            return;

        titan::math::Vector3 thrustDir =
            m_guidance->ComputeThrustDirection(m_state, m_mu)
                .Normalized();

        double thrustMagnitude = 0.0;

        if (!m_stages.empty() && m_stages.front().HasFuel())
        {
            Stage &stage = m_stages.front();

            double thrust = stage.GetThrust();
            double accel = thrust / totalMass;

            if (accel / g0 > m_maxG)
            {
                double limitedThrust = m_maxG * g0 * totalMass;
                stage.SetThrottle(limitedThrust / thrust);
            }

            stage.Burn(dt);
            thrustMagnitude = stage.GetThrust();
        }

        // Capturar valores por cópia para evitar problemas de escopo
        double mu = m_mu;
        double mass = totalMass;
        titan::math::Vector3 direction = thrustDir;
        double magnitude = thrustMagnitude;

        auto derivativeFunc =
            [mu, mass, direction, magnitude](const titan::integrators::State &s)
            -> titan::integrators::Derivative
        {
            titan::integrators::Derivative d;

            titan::math::Vector3 pos(s.x, s.y, s.z);
            titan::math::Vector3 vel(s.vx, s.vy, s.vz);

            double r = pos.Magnitude();

            if (r == 0.0)
                return d; // Retornar derivada nula se posição é zero

            d.dx = s.vx;
            d.dy = s.vy;
            d.dz = s.vz;

            double factor = -mu / (r * r * r);

            titan::math::Vector3 gravity = pos * factor;
            titan::math::Vector3 thrust = direction * (magnitude / mass);
            titan::math::Vector3 acc = gravity + thrust;

            d.dvx = acc.x;
            d.dvy = acc.y;
            d.dvz = acc.z;

            return d;
        };

        m_state = m_integrator->Step(m_state, dt, derivativeFunc);

        SeparateStageIfNeeded();
    }

    void LaunchVehicle3D::SeparateStageIfNeeded()
    {
        if (!m_stages.empty() && m_stages.front().IsDepleted())
            m_stages.erase(m_stages.begin());
    }

    titan::math::Vector3 LaunchVehicle3D::GetPosition() const
    {
        return {m_state.x, m_state.y, m_state.z};
    }

    titan::math::Vector3 LaunchVehicle3D::GetVelocity() const
    {
        return {m_state.vx, m_state.vy, m_state.vz};
    }
}