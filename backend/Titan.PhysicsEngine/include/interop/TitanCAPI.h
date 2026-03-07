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

        // Completion criteria (configurable per mission)
        double completionMinPeriapsis;    // meters, default 180000
        double completionMaxEccentricity; // default 0.02

        // Physics options
        int useJ2;                   // 0 = point mass, 1 = J2 perturbation
        int useUSStandardAtmosphere; // 0 = exponential, 1 = US Standard 1976
        int useEarthRotation;        // 0 = no rotation, 1 = include rotation
        int useMachCd;               // 0 = constant Cd, 1 = Mach-dependent Cd
    } TitanSimConfig;

    typedef struct
    {
        double dryMass;
        double fuelMass;
        double burnRate;
        double exhaustVelocity;
        double referenceArea;
        double dragCoefficient;

        // Altitude-dependent Isp (optional, set to 0 to disable)
        double ispSeaLevel;  // seconds
        double ispVacuum;    // seconds
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
        int status; // 0 = running, 1 = completed, 2 = impact, 3 = error

        // 6DOF attitude data
        double attitude_w, attitude_x, attitude_y, attitude_z;
        double angularVelocity_x, angularVelocity_y, angularVelocity_z;
        double dynamicPressure, machNumber;

        // Reaction wheel state
        double wheelSpeed[4];
        double wheelMomentum[4];
        int wheelCount;
    } TitanTelemetry;

    // Event types matching titan::events::EventType
    typedef struct
    {
        double time;
        int type;
        char description[256];
    } TitanEvent;

    typedef struct TitanSim TitanSim;

    // Event callback
    typedef void (*TitanEventCallback)(TitanEvent event, void *userData);

    // Telemetry callback
    typedef void (*TitanTelemetryCallback)(const char *channel, double time,
                                           double value, void *userData);

    TITAN_API TitanSim *titan_create_simulation(TitanSimConfig config);
    TITAN_API void titan_add_stage(TitanSim *sim, TitanStageConfig stage);
    TITAN_API TitanTelemetry titan_step(TitanSim *sim);
    TITAN_API TitanTelemetry titan_get_telemetry(TitanSim *sim);
    TITAN_API void titan_destroy(TitanSim *sim);

    // Event and telemetry callbacks
    TITAN_API void titan_set_event_callback(TitanSim *sim,
                                            TitanEventCallback cb,
                                            void *userData);
    TITAN_API void titan_set_telemetry_callback(TitanSim *sim,
                                                TitanTelemetryCallback cb,
                                                void *userData);

    // Error handling
    TITAN_API int titan_get_last_error(TitanSim *sim, char *buffer, int bufferSize);

    // 6DOF attitude control
    TITAN_API void titan_set_initial_attitude(TitanSim *sim,
                                              double w, double x, double y, double z);
    TITAN_API void titan_add_reaction_wheel(TitanSim *sim,
                                             double ax, double ay, double az,
                                             double maxTorque, double maxMomentum,
                                             double wheelInertia);
    TITAN_API void titan_set_pointing_mode(TitanSim *sim, int mode);
    // mode: 0=none, 1=inertial, 2=nadir, 3=sun

    // Data export
    TITAN_API int titan_export_csv(TitanSim *sim, const char *filename);
    TITAN_API int titan_export_json(TitanSim *sim, const char *filename);

#ifdef __cplusplus
}
#endif
