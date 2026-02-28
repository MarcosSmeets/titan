#include "simulation/Rocket1D.h"
#include "physics/AtmosphereModel.h"

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

        double density = titan::physics::AtmosphereModel::GetDensity(state.altitude);

        double drag = 0.5 * density * state.velocity * state.velocity * dragCoefficient * crossSectionArea;

        // drag
        if (state.velocity > 0)
            drag = -drag;
        else
            drag = drag;

        double weight = state.totalMass * g;

        double force = thrust - weight + drag;

        double acceleration = force / state.totalMass;

        // Euler
        state.velocity += acceleration * dt;
        state.altitude += state.velocity * dt;
    }
}