#pragma once

namespace titan::simulation
{
    struct RocketState1D
    {
        double altitude; // m
        double velocity; // m/s
        double mass;     // kg
    };

    class Rocket1D
    {
    public:
        Rocket1D(double mass, double thrust);

        RocketState1D GetState() const;

        void Update(double dt);

    private:
        RocketState1D state;
        double thrust;         // Newtons
        const double g = 9.81; // m/s²
    };
}