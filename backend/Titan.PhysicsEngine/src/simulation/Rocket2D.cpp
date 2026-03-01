#include "simulation/Rocket2D.h"
#include "physics/AtmosphereModel.h"
#include "physics/GravityModel.h"

#include <cmath>
#include <algorithm>

namespace titan::simulation
{
    static constexpr double EarthRadius = 6371000.0;  // meters
    static constexpr double EarthMu = 3.986004418e14; // m^3/s^2

    Rocket2D::Rocket2D(
        double dryMass,
        double fuelMass,
        double burnRate,
        double exhaustVelocity,
        double dragCoefficient,
        double crossSectionArea,
        double gravityTurnStartAltitude)
    {
        this->dryMass = dryMass;
        this->burnRate = burnRate;
        this->exhaustVelocity = exhaustVelocity;
        this->dragCoefficient = dragCoefficient;
        this->crossSectionArea = crossSectionArea;
        this->gravityTurnStartAltitude = gravityTurnStartAltitude;

        state.x = 0.0;
        state.y = EarthRadius; // Start at Earth's surface
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
        Computes acceleration vector including:
        - Thrust
        - Gravity
        - Atmospheric drag
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
        double r = std::sqrt(x * x + y * y);
        double altitude = r - EarthRadius;
        double v = std::sqrt(vx * vx + vy * vy);

        /*
            THRUST VECTOR
            During early ascent: vertical.
            After gravityTurnStartAltitude: align with velocity.
        */
        double thrustX = 0.0;
        double thrustY = 0.0;

        if (state.fuelMass > 0.0)
        {
            double thrust = burnRate * exhaustVelocity;

            double dirX = 0.0;
            double dirY = 1.0;

            if (altitude >= gravityTurnStartAltitude && v > 0.0)
            {
                dirX = vx / v;
                dirY = vy / v;
            }

            thrustX = thrust * dirX;
            thrustY = thrust * dirY;
        }

        /*
            GRAVITY (radial toward Earth's center)
        */
        double gravity = titan::physics::GravityModel::ComputeGravity(altitude);

        double gx = -gravity * (x / r);
        double gy = -gravity * (y / r);

        /*
            ATMOSPHERIC DRAG (opposite velocity)
        */
        double density = titan::physics::AtmosphereModel::GetDensity(altitude);

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
            Net acceleration
        */
        ax = (thrustX + dragX) / mass + gx;
        ay = (thrustY + dragY) / mass + gy;
    }

    void Rocket2D::Update(double dt)
    {
        /*
            Update fuel mass
        */
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

        /*
            RK4 Integration
        */

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

        state.x += dt / 6.0 * (k1_x + 2 * (vx + 0.5 * dt * k1_vx) + 2 * (vx + 0.5 * dt * k2_vx) + (vx + dt * k3_vx));

        state.y += dt / 6.0 * (k1_y + 2 * (vy + 0.5 * dt * k1_vy) + 2 * (vy + 0.5 * dt * k2_vy) + (vy + dt * k3_vy));

        state.vx += dt / 6.0 * (k1_vx + 2 * k2_vx + 2 * k3_vx + k4_vx);
        state.vy += dt / 6.0 * (k1_vy + 2 * k2_vy + 2 * k3_vy + k4_vy);

        /*
            Log trajectory point
        */
        simulationTime += dt;

        trajectory.push_back({simulationTime,
                              state.x,
                              state.y,
                              state.vx,
                              state.vy,
                              state.totalMass});
    }

    /*
        Specific mechanical energy (J/kg)
    */
    double Rocket2D::ComputeSpecificOrbitalEnergy() const
    {
        double r = std::sqrt(state.x * state.x + state.y * state.y);
        double v2 = state.vx * state.vx + state.vy * state.vy;

        return (v2 / 2.0) - (EarthMu / r);
    }

    /*
        Circular orbital velocity at current radius
    */
    double Rocket2D::ComputeOrbitalVelocity() const
    {
        double r = std::sqrt(state.x * state.x + state.y * state.y);
        return std::sqrt(EarthMu / r);
    }

    /*
        Basic orbit detection:
        - Above atmosphere
        - Velocity close to circular velocity
    */
    bool Rocket2D::IsInOrbit() const
    {
        double r = std::sqrt(state.x * state.x + state.y * state.y);
        double altitude = r - EarthRadius;

        if (altitude < 120000.0)
            return false;

        double v = std::sqrt(state.vx * state.vx + state.vy * state.vy);
        double orbitalV = std::sqrt(EarthMu / r);

        double tolerance = 50.0; // m/s

        return std::abs(v - orbitalV) < tolerance;
    }

    const std::vector<TrajectoryPoint> &Rocket2D::GetTrajectory() const
    {
        return trajectory;
    }

    titan::orbital::OrbitalElements Rocket2D::GetOrbitalElements() const
    {
        titan::math::Vector2 position(state.x, state.y);
        titan::math::Vector2 velocity(state.vx, state.vy);

        return titan::orbital::OrbitalMechanics::ComputeOrbitalElements(
            position,
            velocity,
            EarthMu);
    }
}