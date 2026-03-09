using Microsoft.EntityFrameworkCore;
using Titan.API.Data;
using Titan.API.Data.Entities;
using Titan.API.Models;

namespace Titan.API.Services;

public class SimulationStore
{
    private readonly IServiceProvider _serviceProvider;

    public SimulationStore(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    private TitanDbContext CreateContext()
    {
        var scope = _serviceProvider.CreateScope();
        return scope.ServiceProvider.GetRequiredService<TitanDbContext>();
    }

    public string Save(SavedSimulation simulation)
    {
        using var db = CreateContext();

        if (string.IsNullOrEmpty(simulation.Id))
            simulation.Id = Guid.NewGuid().ToString("N")[..8];

        var maxAlt = simulation.Telemetry.Count > 0 ? simulation.Telemetry.Max(t => t.Altitude) : 0;
        var maxVel = simulation.Telemetry.Count > 0 ? simulation.Telemetry.Max(t => t.Velocity) : 0;
        var last = simulation.Telemetry.LastOrDefault();

        var entity = new SimulationEntity
        {
            Id = simulation.Id,
            RocketId = simulation.RocketId,
            RocketName = simulation.RocketName,
            TargetAltitude = simulation.TargetAltitude,
            OrbitAchieved = simulation.OrbitAchieved,
            FinalTime = simulation.FinalTime,
            MaxAltitude = maxAlt,
            MaxVelocity = maxVel,
            FinalApoapsis = last?.Apoapsis ?? 0,
            FinalPeriapsis = last?.Periapsis ?? 0,
            FinalEccentricity = last?.Eccentricity ?? 0,
            CreatedAt = DateTime.UtcNow,
            Telemetry = simulation.Telemetry.Select(t => new SimulationTelemetryEntity
            {
                SimulationId = simulation.Id,
                Time = t.Time,
                Altitude = t.Altitude,
                Velocity = t.Velocity,
                Apoapsis = t.Apoapsis,
                Periapsis = t.Periapsis,
                Eccentricity = t.Eccentricity,
                Inclination = t.Inclination,
                Raan = t.Raan,
                SemiMajorAxis = t.SemiMajorAxis,
                X = t.X,
                Y = t.Y,
                Z = t.Z,
                StageIndex = t.StageIndex,
            }).ToList(),
            Events = simulation.Events.Select(e => new SimulationEventEntity
            {
                SimulationId = simulation.Id,
                Time = e.Time,
                PreviousStage = e.PreviousStage,
                NewStage = e.NewStage,
                Description = e.Description,
            }).ToList(),
        };

        db.Simulations.Add(entity);
        db.SaveChanges();
        return simulation.Id;
    }

    public SavedSimulation? GetById(string id)
    {
        using var db = CreateContext();
        var entity = db.Simulations
            .Include(s => s.Telemetry)
            .Include(s => s.Events)
            .FirstOrDefault(s => s.Id == id);
        if (entity == null) return null;
        return ToModel(entity);
    }

    public IEnumerable<SavedSimulation> GetAll()
    {
        using var db = CreateContext();
        return db.Simulations
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SavedSimulation
            {
                Id = s.Id,
                RocketId = s.RocketId,
                RocketName = s.RocketName,
                TargetAltitude = s.TargetAltitude,
                OrbitAchieved = s.OrbitAchieved,
                FinalTime = s.FinalTime,
                MaxAltitude = s.MaxAltitude,
                MaxVelocity = s.MaxVelocity,
                FinalApoapsis = s.FinalApoapsis,
                FinalPeriapsis = s.FinalPeriapsis,
                FinalEccentricity = s.FinalEccentricity,
                CreatedAt = s.CreatedAt,
            })
            .ToList();
    }

    public bool Delete(string id)
    {
        using var db = CreateContext();
        var entity = db.Simulations
            .Include(s => s.Telemetry)
            .Include(s => s.Events)
            .FirstOrDefault(s => s.Id == id);
        if (entity == null) return false;
        db.Simulations.Remove(entity);
        db.SaveChanges();
        return true;
    }

    private static SavedSimulation ToModel(SimulationEntity entity)
    {
        return new SavedSimulation
        {
            Id = entity.Id,
            RocketId = entity.RocketId,
            RocketName = entity.RocketName,
            TargetAltitude = entity.TargetAltitude,
            OrbitAchieved = entity.OrbitAchieved,
            FinalTime = entity.FinalTime,
            MaxAltitude = entity.MaxAltitude,
            MaxVelocity = entity.MaxVelocity,
            FinalApoapsis = entity.FinalApoapsis,
            FinalPeriapsis = entity.FinalPeriapsis,
            FinalEccentricity = entity.FinalEccentricity,
            CreatedAt = entity.CreatedAt,
            Telemetry = entity.Telemetry.OrderBy(t => t.Time).Select(t => new TelemetryPoint
            {
                Time = t.Time,
                Altitude = t.Altitude,
                Velocity = t.Velocity,
                Apoapsis = t.Apoapsis,
                Periapsis = t.Periapsis,
                Eccentricity = t.Eccentricity,
                Inclination = t.Inclination,
                Raan = t.Raan,
                SemiMajorAxis = t.SemiMajorAxis,
                X = t.X,
                Y = t.Y,
                Z = t.Z,
                StageIndex = t.StageIndex,
            }).ToList(),
            Events = entity.Events.OrderBy(e => e.Time).Select(e => new StageEventRecord
            {
                Time = e.Time,
                PreviousStage = e.PreviousStage,
                NewStage = e.NewStage,
                Description = e.Description,
            }).ToList(),
        };
    }
}

public class SavedSimulation
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
    public List<TelemetryPoint> Telemetry { get; set; } = new();
    public List<StageEventRecord> Events { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class StageEventRecord
{
    public double Time { get; set; }
    public int PreviousStage { get; set; }
    public int NewStage { get; set; }
    public string Description { get; set; } = string.Empty;
}
