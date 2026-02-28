#pragma once

#include <vector>
#include "simulation/TrajectoryPoint.h"

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
            double gravityTurnStartAltitude);

        RocketState2D GetState() const;

        void Update(double dt);

        double ComputeSpecificOrbitalEnergy() const;
        double ComputeOrbitalVelocity() const;
        bool IsInOrbit() const;

        const std::vector<TrajectoryPoint> &GetTrajectory() const;

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
        double gravityTurnStartAltitude;

        std::vector<TrajectoryPoint> trajectory;
        double simulationTime = 0.0;
    };
}