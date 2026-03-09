using Microsoft.AspNetCore.SignalR;
using Titan.API.Models;
using Titan.API.Native;
using Titan.API.Services;

namespace Titan.API.Hubs;

public class TelemetryHub : Hub
{
    private const double EarthRadius = 6371000.0;
    private const double Mu = 3.986e14;

    private readonly IServiceProvider _serviceProvider;

    public TelemetryHub(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task RunSimulation(SimulationRequest request)
    {
        var stages = ResolveStages(request);
        if (stages == null || stages.Count == 0)
        {
            await Clients.Caller.SendAsync("OnSimulationComplete", new
            {
                orbitAchieved = false,
                finalTime = 0.0,
                error = "No stages configured"
            });
            return;
        }

        var rocketName = request.RocketId != null
            ? Controllers.RocketsController.FindPreset(request.RocketId)?.Name ?? request.RocketId
            : "Custom Rocket";

        await Clients.Caller.SendAsync("OnSimulationStart", new
        {
            rocketName,
            targetAltitude = request.TargetAltitude,
            duration = request.Duration
        });

        var config = new TitanSimConfig
        {
            TargetAltitude = request.TargetAltitude,
            EarthRadius = EarthRadius,
            Mu = Mu,
            MaxG = request.MaxG,
            Dt = request.Dt,
            IntegratorType = request.IntegratorType,
            GuidanceType = request.GuidanceType,
            Rk45Atol = 1e-8,
            Rk45Rtol = 1e-6,
            Rk45Hmin = 1e-6,
            Rk45Hmax = 10.0
        };

        // Collect telemetry and events for saving
        var savedTelemetry = new List<TelemetryPoint>();
        var savedEvents = new List<StageEventRecord>();

        var sim = TitanInterop.titan_create_simulation(config);
        try
        {
            foreach (var stage in stages)
            {
                TitanInterop.titan_add_stage(sim, new TitanStageConfig
                {
                    DryMass = stage.DryMass,
                    FuelMass = stage.FuelMass,
                    BurnRate = stage.BurnRate,
                    ExhaustVelocity = stage.ExhaustVelocity,
                    ReferenceArea = stage.ReferenceArea,
                    DragCoefficient = stage.DragCoefficient
                });
            }

            int totalSteps = (int)(request.Duration / request.Dt);
            double timeWarp = Math.Max(1.0, request.TimeWarp);

            double pushIntervalSim = 1.0;
            int delayMs = (int)(pushIntervalSim / timeWarp * 1000.0);
            delayMs = Math.Max(16, delayMs);

            int stepsPerPush = Math.Max(1, (int)(pushIntervalSim / request.Dt));

            int prevStage = 0;
            TitanTelemetry lastTel = default;

            for (int i = 0; i < totalSteps; i++)
            {
                lastTel = TitanInterop.titan_step(sim);

                if (lastTel.StageIndex != prevStage)
                {
                    var stageEvent = new StageEventRecord
                    {
                        Time = lastTel.Time,
                        PreviousStage = prevStage,
                        NewStage = lastTel.StageIndex,
                        Description = $"Stage {prevStage + 1} separated"
                    };
                    savedEvents.Add(stageEvent);

                    await Clients.Caller.SendAsync("OnStageEvent", new
                    {
                        time = lastTel.Time,
                        previousStage = prevStage,
                        newStage = lastTel.StageIndex,
                        description = stageEvent.Description
                    });
                    prevStage = lastTel.StageIndex;
                }

                if (i % stepsPerPush == 0)
                {
                    var point = new TelemetryPoint
                    {
                        Time = lastTel.Time,
                        Altitude = lastTel.Altitude,
                        Velocity = lastTel.Velocity,
                        Apoapsis = lastTel.Apoapsis,
                        Periapsis = lastTel.Periapsis,
                        Eccentricity = lastTel.Eccentricity,
                        Inclination = lastTel.Inclination,
                        Raan = lastTel.Raan,
                        SemiMajorAxis = lastTel.SemiMajorAxis,
                        X = lastTel.State.X,
                        Y = lastTel.State.Y,
                        Z = lastTel.State.Z,
                        StageIndex = lastTel.StageIndex
                    };
                    savedTelemetry.Add(point);

                    await Clients.Caller.SendAsync("OnTelemetryUpdate", point);

                    if (delayMs > 0)
                    {
                        await Task.Delay(delayMs, Context.ConnectionAborted);
                    }
                }

                if (lastTel.IsComplete != 0)
                {
                    var finalPoint = new TelemetryPoint
                    {
                        Time = lastTel.Time,
                        Altitude = lastTel.Altitude,
                        Velocity = lastTel.Velocity,
                        Apoapsis = lastTel.Apoapsis,
                        Periapsis = lastTel.Periapsis,
                        Eccentricity = lastTel.Eccentricity,
                        Inclination = lastTel.Inclination,
                        Raan = lastTel.Raan,
                        SemiMajorAxis = lastTel.SemiMajorAxis,
                        X = lastTel.State.X,
                        Y = lastTel.State.Y,
                        Z = lastTel.State.Z,
                        StageIndex = lastTel.StageIndex
                    };
                    savedTelemetry.Add(finalPoint);
                    await Clients.Caller.SendAsync("OnTelemetryUpdate", finalPoint);

                    var simId = SaveSimulation(request.RocketId, rocketName, request.TargetAltitude,
                        true, lastTel.Time, savedTelemetry, savedEvents);

                    await Clients.Caller.SendAsync("OnSimulationComplete", new
                    {
                        orbitAchieved = true,
                        finalTime = lastTel.Time,
                        simulationId = simId
                    });
                    return;
                }
            }

            var failId = SaveSimulation(request.RocketId, rocketName, request.TargetAltitude,
                false, lastTel.Time, savedTelemetry, savedEvents);

            await Clients.Caller.SendAsync("OnSimulationComplete", new
            {
                orbitAchieved = false,
                finalTime = lastTel.Time,
                simulationId = failId
            });
        }
        catch (OperationCanceledException)
        {
            // Client disconnected
        }
        finally
        {
            TitanInterop.titan_destroy(sim);
        }
    }

    private string SaveSimulation(string? rocketId, string rocketName, double targetAltitude,
        bool orbitAchieved, double finalTime, List<TelemetryPoint> telemetry, List<StageEventRecord> events)
    {
        using var scope = _serviceProvider.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<SimulationStore>();
        var saved = new SavedSimulation
        {
            RocketId = rocketId,
            RocketName = rocketName,
            TargetAltitude = targetAltitude,
            OrbitAchieved = orbitAchieved,
            FinalTime = finalTime,
            Telemetry = telemetry,
            Events = events
        };
        return store.Save(saved);
    }

    private static List<StageRequest>? ResolveStages(SimulationRequest request)
    {
        if (request.CustomStages != null && request.CustomStages.Count > 0)
            return request.CustomStages;

        if (string.IsNullOrEmpty(request.RocketId))
            return null;

        var preset = Controllers.RocketsController.FindPreset(request.RocketId);
        if (preset == null)
            return null;

        return preset.Stages.Select(s => new StageRequest
        {
            DryMass = s.DryMass,
            FuelMass = s.FuelMass,
            BurnRate = s.BurnRate,
            ExhaustVelocity = s.ExhaustVelocity,
            ReferenceArea = s.ReferenceArea,
            DragCoefficient = s.DragCoefficient
        }).ToList();
    }
}
