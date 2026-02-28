#pragma once

namespace titan::simulation
{
    /*
        Stores a snapshot of the rocket state
        at a specific simulation time.
    */
    struct TrajectoryPoint
    {
        double time; // seconds
        double x;    // meters
        double y;    // meters
        double vx;   // m/s
        double vy;   // m/s
        double mass; // kg
    };
}