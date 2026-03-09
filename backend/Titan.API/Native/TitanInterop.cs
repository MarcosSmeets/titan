using System.Runtime.InteropServices;

namespace Titan.API.Native;

[StructLayout(LayoutKind.Sequential)]
public struct TitanVec6
{
    public double X, Y, Z;
    public double Vx, Vy, Vz;
}

[StructLayout(LayoutKind.Sequential)]
public struct TitanSimConfig
{
    public double TargetAltitude;
    public double EarthRadius;
    public double Mu;
    public double MaxG;
    public double Dt;
    public int IntegratorType;   // 0=RK4, 1=Euler, 2=RK45
    public int GuidanceType;     // 0=OrbitalCircularization, 1=TargetApoapsis
    public double Rk45Atol;
    public double Rk45Rtol;
    public double Rk45Hmin;
    public double Rk45Hmax;
}

[StructLayout(LayoutKind.Sequential)]
public struct TitanStageConfig
{
    public double DryMass;
    public double FuelMass;
    public double BurnRate;
    public double ExhaustVelocity;
    public double ReferenceArea;
    public double DragCoefficient;
}

[StructLayout(LayoutKind.Sequential)]
public struct TitanTelemetry
{
    public double Time;
    public TitanVec6 State;
    public double Altitude;
    public double Velocity;
    public double Apoapsis;
    public double Periapsis;
    public double Eccentricity;
    public double Inclination;
    public double Raan;
    public double ArgumentOfPeriapsis;
    public double TrueAnomaly;
    public double SemiMajorAxis;
    public int StageIndex;
    public int IsComplete;
}

public static class TitanInterop
{
    private const string LibName = "TitanPhysicsEngine";

    [DllImport(LibName, CallingConvention = CallingConvention.Cdecl)]
    public static extern IntPtr titan_create_simulation(TitanSimConfig config);

    [DllImport(LibName, CallingConvention = CallingConvention.Cdecl)]
    public static extern void titan_add_stage(IntPtr sim, TitanStageConfig stage);

    [DllImport(LibName, CallingConvention = CallingConvention.Cdecl)]
    public static extern TitanTelemetry titan_step(IntPtr sim);

    [DllImport(LibName, CallingConvention = CallingConvention.Cdecl)]
    public static extern TitanTelemetry titan_get_telemetry(IntPtr sim);

    [DllImport(LibName, CallingConvention = CallingConvention.Cdecl)]
    public static extern void titan_destroy(IntPtr sim);
}
