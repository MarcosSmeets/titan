#include "simulation/Rocket1D.h"

namespace titan::simulation
{
    Rocket1D::Rocket1D(
        double dryMass,
        double fuelMass,
        double burnRate,
        double exhaustVelocity)
    {
        this->dryMass = dryMass;
        this->burnRate = burnRate;
        this->exhaustVelocity = exhaustVelocity;

        state.altitude = 0.0;
        state.velocity = 0.0;
        state.fuelMass = fuelMass;
        state.totalMass = dryMass + fuelMass;
    }

    RocketState1D Rocket1D::GetState() const
    {
        return state;
    }

    void Rocket1D::Update(double dt)
    {
        double thrust = 0.0;

        if (state.fuelMass > 0.0)
        {
            double fuelConsumed = burnRate * dt;

            if (fuelConsumed > state.fuelMass)
                fuelConsumed = state.fuelMass;

            state.fuelMass -= fuelConsumed;

            thrust = burnRate * exhaustVelocity;
        }

        state.totalMass = dryMass + state.fuelMass;

        double weight = state.totalMass * g;

        double force = thrust - weight;

        double acceleration = force / state.totalMass;

        // Euler
        state.velocity += acceleration * dt;
        state.altitude += state.velocity * dt;
    }
}