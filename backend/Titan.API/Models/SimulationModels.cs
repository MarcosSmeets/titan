namespace Titan.API.Models;

public class SimulationRequest
{
    public string? RocketId { get; set; }
    public string? RocketName { get; set; }
    public double TargetAltitude { get; set; } = 200000.0;
    public double MaxG { get; set; } = 4.0;
    public double Dt { get; set; } = 0.05;
    public double Duration { get; set; } = 900.0;
    public int IntegratorType { get; set; } = 2; // RK45 default
    public int GuidanceType { get; set; } = 0;
    public double TimeWarp { get; set; } = 50.0; // Simulation seconds per real second
    public List<StageRequest>? CustomStages { get; set; }
    public int? PointingMode { get; set; } // null=default nadir, 0=none, 1=inertial, 2=nadir, 3=sun
    public bool Enable6DOF { get; set; } = true;
}

public class StageRequest
{
    public double DryMass { get; set; }
    public double FuelMass { get; set; }
    public double BurnRate { get; set; }
    public double ExhaustVelocity { get; set; }
    public double ReferenceArea { get; set; }
    public double DragCoefficient { get; set; }
}

public class SimulationResult
{
    public string Id { get; set; } = string.Empty;
    public string RocketName { get; set; } = string.Empty;
    public bool OrbitAchieved { get; set; }
    public double FinalTime { get; set; }
    public List<TelemetryPoint> Telemetry { get; set; } = new();
}

public class TelemetryPoint
{
    public double Time { get; set; }
    public double Altitude { get; set; }
    public double Velocity { get; set; }
    public double Apoapsis { get; set; }
    public double Periapsis { get; set; }
    public double Eccentricity { get; set; }
    public double Inclination { get; set; }
    public double Raan { get; set; }
    public double SemiMajorAxis { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
    public double Z { get; set; }
    public double Vx { get; set; }
    public double Vy { get; set; }
    public double Vz { get; set; }
    public int StageIndex { get; set; }

    // 6DOF attitude
    public double AttitudeW { get; set; } = 1.0;
    public double AttitudeX { get; set; }
    public double AttitudeY { get; set; }
    public double AttitudeZ { get; set; }
    public double AngularVelocityX { get; set; }
    public double AngularVelocityY { get; set; }
    public double AngularVelocityZ { get; set; }

    // Aerodynamics
    public double DynamicPressure { get; set; }
    public double MachNumber { get; set; }

    // Reaction wheels
    public double[]? WheelSpeed { get; set; }
    public double[]? WheelMomentum { get; set; }
    public int WheelCount { get; set; }
}

public class CompareRequest
{
    public List<string> RocketIds { get; set; } = new();
    public double TargetAltitude { get; set; } = 200000.0;
}

public class CompareResult
{
    public List<SimulationResult> Simulations { get; set; } = new();
}
