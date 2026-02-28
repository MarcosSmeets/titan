#include "simulation/Rocket2D.h"
#include "physics/AtmosphereModel.h"
#include "physics/GravityModel.h"
#include <cmath>
#include <algorithm>

namespace titan::simulation
{
    static constexpr double EarthRadius = 6371000.0;

    Rocket2D::Rocket2D(
        double dryMass,
        double fuelMass,
        double burnRate,
        double exhaustVelocity,
        double dragCoefficient,
        double crossSectionArea,
        double initialPitchAngleDeg)
    {
        this->dryMass = dryMass;
        this->burnRate = burnRate;
        this->exhaustVelocity = exhaustVelocity;
        this->dragCoefficient = dragCoefficient;
        this->crossSectionArea = crossSectionArea;

        pitchAngleRad = initialPitchAngleDeg * M_PI / 180.0;

        state.x = 0.0;
        state.y = EarthRadius; // start at surface
        state.vx = 0.0;
        state.vy = 0.0;
        state.fuelMass = fuelMass;
        state.totalMass = dryMass + fuelMass;
    }

    RocketState2D Rocket2D::GetState() const
    {
        return state;
    }

    /*
        Computes acceleration components (ax, ay)
        including gravity, thrust and drag.
    */
    void Rocket2D::ComputeAcceleration(
        double x,
        double y,
        double vx,
        double vy,
        double mass,
        double &ax,
        double &ay) const
    {
        double thrustX = 0.0;
        double thrustY = 0.0;

        if (state.fuelMass > 0.0)
        {
            double thrust = burnRate * exhaustVelocity;

            thrustX = thrust * std::cos(pitchAngleRad);
            thrustY = thrust * std::sin(pitchAngleRad);
        }

        /*
            Compute distance from Earth's center.
        */
        double r = std::sqrt(x * x + y * y);

        /*
            Gravity magnitude.
        */
        double gravity = titan::physics::GravityModel::ComputeGravity(r - EarthRadius);

        /*
            Gravity direction (toward center).
        */
        double gx = -gravity * (x / r);
        double gy = -gravity * (y / r);

        /*
            Atmospheric drag.
        */
        double altitude = r - EarthRadius;
        double density = titan::physics::AtmosphereModel::GetDensity(altitude);

        double v = std::sqrt(vx * vx + vy * vy);

        double dragX = 0.0;
        double dragY = 0.0;

        if (v > 0.0)
        {
            double drag = 0.5 * density * v * v *
                          dragCoefficient * crossSectionArea;

            dragX = -drag * (vx / v);
            dragY = -drag * (vy / v);
        }

        /*
            Net force divided by mass.
        */
        ax = (thrustX / mass) + gx + (dragX / mass);
        ay = (thrustY / mass) + gy + (dragY / mass);
    }

    void Rocket2D::Update(double dt)
    {
        if (state.fuelMass > 0.0)
        {
            double fuelConsumed = burnRate * dt;
            fuelConsumed = std::min(fuelConsumed, state.fuelMass);
            state.fuelMass -= fuelConsumed;
        }

        state.totalMass = dryMass + state.fuelMass;

        double x = state.x;
        double y = state.y;
        double vx = state.vx;
        double vy = state.vy;
        double m = state.totalMass;

        double k1_x = vx;
        double k1_y = vy;

        double k1_vx, k1_vy;
        ComputeAcceleration(x, y, vx, vy, m, k1_vx, k1_vy);

        double k2_vx, k2_vy;
        ComputeAcceleration(
            x + 0.5 * dt * k1_x,
            y + 0.5 * dt * k1_y,
            vx + 0.5 * dt * k1_vx,
            vy + 0.5 * dt * k1_vy,
            m,
            k2_vx,
            k2_vy);

        double k3_vx, k3_vy;
        ComputeAcceleration(
            x + 0.5 * dt * (vx + 0.5 * dt * k1_vx),
            y + 0.5 * dt * (vy + 0.5 * dt * k1_vy),
            vx + 0.5 * dt * k2_vx,
            vy + 0.5 * dt * k2_vy,
            m,
            k3_vx,
            k3_vy);

        double k4_vx, k4_vy;
        ComputeAcceleration(
            x + dt * (vx + 0.5 * dt * k2_vx),
            y + dt * (vy + 0.5 * dt * k2_vy),
            vx + dt * k3_vx,
            vy + dt * k3_vy,
            m,
            k4_vx,
            k4_vy);

        state.x += (dt / 6.0) * (k1_x + 2 * (vx + 0.5 * dt * k1_vx) + 2 * (vx + 0.5 * dt * k2_vx) + (vx + dt * k3_vx));

        state.y += (dt / 6.0) * (k1_y + 2 * (vy + 0.5 * dt * k1_vy) + 2 * (vy + 0.5 * dt * k2_vy) + (vy + dt * k3_vy));

        state.vx += (dt / 6.0) * (k1_vx + 2 * k2_vx + 2 * k3_vx + k4_vx);
        state.vy += (dt / 6.0) * (k1_vy + 2 * k2_vy + 2 * k3_vy + k4_vy);
    }
}