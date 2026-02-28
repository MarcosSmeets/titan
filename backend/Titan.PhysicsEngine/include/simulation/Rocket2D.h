#pragma once

namespace titan::simulation
{
    struct RocketState2D
    {
        double x;  // horizontal position (m)
        double y;  // vertical position (m)
        double vx; // horizontal velocity (m/s)
        double vy; // vertical velocity (m/s)

        double totalMass; // kg
        double fuelMass;  // kg
    };

    class Rocket2D
    {
    public:
        Rocket2D(
            double dryMass,
            double fuelMass,
            double burnRate,
            double exhaustVelocity,
            double dragCoefficient,
            double crossSectionArea,
            double initialPitchAngleDeg);

        RocketState2D GetState() const;

        void Update(double dt);

    private:
        void ComputeAcceleration(
            double x,
            double y,
            double vx,
            double vy,
            double mass,
            double &ax,
            double &ay) const;

        RocketState2D state;

        double dryMass;
        double burnRate;
        double exhaustVelocity;
        double dragCoefficient;
        double crossSectionArea;

        double pitchAngleRad; // constant pitch angle for now
    };
}