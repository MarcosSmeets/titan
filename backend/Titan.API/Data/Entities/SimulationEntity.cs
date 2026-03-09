namespace Titan.API.Data.Entities;

public class SimulationEntity
{
    public string Id { get; set; } = string.Empty;
    public string? RocketId { get; set; }
    public string RocketName { get; set; } = string.Empty;
    public double TargetAltitude { get; set; }
    public bool OrbitAchieved { get; set; }
    public double FinalTime { get; set; }
    public double MaxAltitude { get; set; }
    public double MaxVelocity { get; set; }
    public double FinalApoapsis { get; set; }
    public double FinalPeriapsis { get; set; }
    public double FinalEccentricity { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<SimulationTelemetryEntity> Telemetry { get; set; } = new();
    public List<SimulationEventEntity> Events { get; set; } = new();
}

public class SimulationTelemetryEntity
{
    public int Id { get; set; }
    public string SimulationId { get; set; } = string.Empty;
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

public class SimulationEventEntity
{
    public int Id { get; set; }
    public string SimulationId { get; set; } = string.Empty;
    public double Time { get; set; }
    public int PreviousStage { get; set; }
    public int NewStage { get; set; }
    public string Description { get; set; } = string.Empty;
}
