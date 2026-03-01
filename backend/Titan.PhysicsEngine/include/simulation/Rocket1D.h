#pragma once

namespace titan::simulation
{
    struct RocketState1D
    {
        double altitude;  // meters
        double velocity;  // m/s
        double totalMass; // kg
        double fuelMass;  // kg
    };

    class Rocket1D
    {
    public:
        Rocket1D(
            double dryMass,
            double fuelMass,
            double burnRate,
            double exhaustVelocity,
            double dragCoefficient,
            double crossSectionArea);

        RocketState1D GetState() const;

        void Update(double dt);

    private:
        // Computes acceleration at a given state
        double ComputeAcceleration(double altitude,
                                   double velocity,
                                   double mass) const;

        RocketState1D state;

        double dryMass;
        double burnRate;        // kg/s
        double exhaustVelocity; // m/s

        double dragCoefficient;
        double crossSectionArea;

        const double g = 9.81; // m/s²
    };
}