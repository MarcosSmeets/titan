#include "simulation/Rocket1D.h"
#include "physics/AtmosphereModel.h"
#include "physics/GravityModel.h"
#include <algorithm>

namespace titan::simulation
{
    Rocket1D::Rocket1D(
        double dryMass,
        double fuelMass,
        double burnRate,
        double exhaustVelocity,
        double dragCoefficient,
        double crossSectionArea)
    {
        this->dryMass = dryMass;
        this->burnRate = burnRate;
        this->exhaustVelocity = exhaustVelocity;
        this->dragCoefficient = dragCoefficient;
        this->crossSectionArea = crossSectionArea;

        state.altitude = 0.0;
        state.velocity = 0.0;
        state.fuelMass = fuelMass;
        state.totalMass = dryMass + fuelMass;
    }

    RocketState1D Rocket1D::GetState() const
    {
        return state;
    }

    /*
        Computes acceleration using:

            F = Thrust - Weight + Drag

        Where:
            Weight = m * g(h)
            g(h) = GM / (R + h)^2

        Returns acceleration in m/s².
    */
    double Rocket1D::ComputeAcceleration(double altitude,
                                         double velocity,
                                         double mass) const
    {
        double thrust = 0.0;

        // Generate thrust only if fuel remains
        if (state.fuelMass > 0.0)
        {
            thrust = burnRate * exhaustVelocity;
        }

        /*
            Compute gravity at current altitude.
            This replaces the constant 9.81 m/s² model.
        */
        double gravity = titan::physics::GravityModel::ComputeGravity(altitude);

        double weight = mass * gravity;

        /*
            Compute atmospheric drag.
        */
        double density = titan::physics::AtmosphereModel::GetDensity(altitude);

        double drag = 0.5 * density *
                      velocity * velocity *
                      dragCoefficient *
                      crossSectionArea;

        // Drag always opposes velocity direction
        if (velocity > 0.0)
            drag = -drag;

        /*
            Net force:
                Thrust - Weight + Drag
        */
        double force = thrust - weight + drag;

        return force / mass;
    }

    /*
        RK4 integration of altitude and velocity.
    */
    void Rocket1D::Update(double dt)
    {
        // Burn fuel
        if (state.fuelMass > 0.0)
        {
            double fuelConsumed = burnRate * dt;
            fuelConsumed = std::min(fuelConsumed, state.fuelMass);
            state.fuelMass -= fuelConsumed;
        }

        state.totalMass = dryMass + state.fuelMass;

        double h = state.altitude;
        double v = state.velocity;
        double m = state.totalMass;

        // k1
        double k1_h = v;
        double k1_v = ComputeAcceleration(h, v, m);

        // k2
        double k2_h = v + 0.5 * dt * k1_v;
        double k2_v = ComputeAcceleration(
            h + 0.5 * dt * k1_h,
            v + 0.5 * dt * k1_v,
            m);

        // k3
        double k3_h = v + 0.5 * dt * k2_v;
        double k3_v = ComputeAcceleration(
            h + 0.5 * dt * k2_h,
            v + 0.5 * dt * k2_v,
            m);

        // k4
        double k4_h = v + dt * k3_v;
        double k4_v = ComputeAcceleration(
            h + dt * k3_h,
            v + dt * k3_v,
            m);

        state.altitude += (dt / 6.0) *
                          (k1_h + 2.0 * k2_h + 2.0 * k3_h + k4_h);

        state.velocity += (dt / 6.0) *
                          (k1_v + 2.0 * k2_v + 2.0 * k3_v + k4_v);
    }
}