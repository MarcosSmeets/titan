#include "simulation/Rocket1D.h"

namespace titan::simulation
{
    Rocket1D::Rocket1D(double mass, double thrust)
    {
        state.altitude = 0.0;
        state.velocity = 0.0;
        state.mass = mass;
        this->thrust = thrust;
    }

    RocketState1D Rocket1D::GetState() const
    {
        return state;
    }

    void Rocket1D::Update(double dt)
    {
        // total thrust
        double force = thrust - (state.mass * g);

        double acceleration = force / state.mass;

        // Euler
        state.velocity += acceleration * dt;
        state.altitude += state.velocity * dt;
    }
}