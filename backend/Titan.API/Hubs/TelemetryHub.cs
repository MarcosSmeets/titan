using Microsoft.AspNetCore.SignalR;
using Titan.API.Models;
using Titan.API.Native;

namespace Titan.API.Hubs;

public class TelemetryHub : Hub
{
    private const double EarthRadius = 6371000.0;
    private const double Mu = 3.986e14;

    public async Task RunSimulation(SimulationRequest request)
    {
        var stages = ResolveStages(request);
        if (stages == null || stages.Count == 0)
        {
            await Clients.Caller.SendAsync("OnSimulationComplete", new { error = "No stages configured" });
            return;
        }

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
            int telemetryInterval = Math.Max(1, (int)(1.0 / request.Dt)); // every 1s for real-time
            int prevStage = 0;

            for (int i = 0; i < totalSteps; i++)
            {
                var tel = TitanInterop.titan_step(sim);

                // Notify stage events
                if (tel.StageIndex != prevStage)
                {
                    await Clients.Caller.SendAsync("OnStageEvent", new
                    {
                        time = tel.Time,
                        previousStage = prevStage,
                        newStage = tel.StageIndex
                    });
                    prevStage = tel.StageIndex;
                }

                if (i % telemetryInterval == 0)
                {
                    await Clients.Caller.SendAsync("OnTelemetryUpdate", new TelemetryPoint
                    {
                        Time = tel.Time,
                        Altitude = tel.Altitude,
                        Velocity = tel.Velocity,
                        Apoapsis = tel.Apoapsis,
                        Periapsis = tel.Periapsis,
                        Eccentricity = tel.Eccentricity,
                        Inclination = tel.Inclination,
                        Raan = tel.Raan,
                        SemiMajorAxis = tel.SemiMajorAxis,
                        X = tel.State.X,
                        Y = tel.State.Y,
                        Z = tel.State.Z,
                        StageIndex = tel.StageIndex
                    });
                }

                if (tel.IsComplete != 0)
                {
                    await Clients.Caller.SendAsync("OnSimulationComplete", new
                    {
                        orbitAchieved = true,
                        finalTime = tel.Time
                    });
                    return;
                }
            }

            await Clients.Caller.SendAsync("OnSimulationComplete", new
            {
                orbitAchieved = false,
                finalTime = request.Duration
            });
        }
        finally
        {
            TitanInterop.titan_destroy(sim);
        }
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
