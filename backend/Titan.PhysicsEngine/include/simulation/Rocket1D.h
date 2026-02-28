#pragma once

namespace titan::simulation
{
    struct RocketState1D
    {
        double altitude;
        double velocity;
        double totalMass;
        double fuelMass;
    };

    class Rocket1D
    {
    public:
        Rocket1D(
            double dryMass,
            double fuelMass,
            double burnRate,
            double exhaustVelocity);

        RocketState1D GetState() const;

        void Update(double dt);

    private:
        RocketState1D state;

        double dryMass;
        double burnRate;        // kg/s
        double exhaustVelocity; // m/s

        const double g = 9.81;
    };
}