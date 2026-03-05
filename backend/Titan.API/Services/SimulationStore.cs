using System.Collections.Concurrent;
using Titan.API.Models;

namespace Titan.API.Services;

public class SavedSimulation
{
    public string Id { get; set; } = string.Empty;
    public string? RocketId { get; set; }
    public string RocketName { get; set; } = string.Empty;
    public double TargetAltitude { get; set; }
    public bool OrbitAchieved { get; set; }
    public double FinalTime { get; set; }
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

public class SimulationStore
{
    private readonly ConcurrentDictionary<string, SavedSimulation> _simulations = new();

    public string Save(SavedSimulation simulation)
    {
        if (string.IsNullOrEmpty(simulation.Id))
            simulation.Id = Guid.NewGuid().ToString("N")[..8];
        simulation.CreatedAt = DateTime.UtcNow;
        _simulations[simulation.Id] = simulation;
        return simulation.Id;
    }

    public SavedSimulation? GetById(string id) =>
        _simulations.TryGetValue(id, out var sim) ? sim : null;

    public IEnumerable<SavedSimulation> GetAll() =>
        _simulations.Values.OrderByDescending(s => s.CreatedAt);

    public bool Delete(string id) =>
        _simulations.TryRemove(id, out _);
}
