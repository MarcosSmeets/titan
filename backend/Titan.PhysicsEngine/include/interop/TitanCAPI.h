#pragma once

#ifdef __cplusplus
extern "C"
{
#endif

#ifdef _WIN32
#define TITAN_API __declspec(dllexport)
#else
#define TITAN_API __attribute__((visibility("default")))
#endif

    typedef struct
    {
        double x, y, z;
        double vx, vy, vz;
    } TitanVec6;

    typedef struct
    {
        double targetAltitude;    // meters
        double earthRadius;       // meters
        double mu;                // gravitational parameter
        double maxG;              // max g-load
        double dt;                // integration time step
        int integratorType;       // 0 = RK4, 1 = Euler, 2 = RK45
        int guidanceType;         // 0 = OrbitalCircularization, 1 = TargetApoapsis

        // RK45 parameters (only used if integratorType == 2)
        double rk45_atol;
        double rk45_rtol;
        double rk45_hmin;
        double rk45_hmax;
    } TitanSimConfig;

    typedef struct
    {
        double dryMass;
        double fuelMass;
        double burnRate;
        double exhaustVelocity;
        double referenceArea;
        double dragCoefficient;
    } TitanStageConfig;

    typedef struct
    {
        double time;
        TitanVec6 state;
        double altitude;
        double velocity;
        double apoapsis;
        double periapsis;
        double eccentricity;
        double inclination;
        double raan;
        double argumentOfPeriapsis;
        double trueAnomaly;
        double semiMajorAxis;
        int stageIndex;
        int isComplete;
    } TitanTelemetry;

    typedef struct TitanSim TitanSim;

    TITAN_API TitanSim *titan_create_simulation(TitanSimConfig config);
    TITAN_API void titan_add_stage(TitanSim *sim, TitanStageConfig stage);
    TITAN_API TitanTelemetry titan_step(TitanSim *sim);
    TITAN_API TitanTelemetry titan_get_telemetry(TitanSim *sim);
    TITAN_API void titan_destroy(TitanSim *sim);

#ifdef __cplusplus
}
#endif
