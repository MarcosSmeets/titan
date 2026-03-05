namespace Titan.API.Models;

public class SimulationRequest
{
    public string? RocketId { get; set; }
    public double TargetAltitude { get; set; } = 200000.0;
    public double MaxG { get; set; } = 4.0;
    public double Dt { get; set; } = 0.05;
    public double Duration { get; set; } = 900.0;
    public int IntegratorType { get; set; } = 2; // RK45 default
    public int GuidanceType { get; set; } = 0;
    public double TimeWarp { get; set; } = 50.0; // Simulation seconds per real second
    public List<StageRequest>? CustomStages { get; set; }
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
    public int StageIndex { get; set; }
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
