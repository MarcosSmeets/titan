using Microsoft.AspNetCore.Mvc;
using Titan.API.Models;
using Titan.API.Native;

namespace Titan.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SimulationsController : ControllerBase
{
    private const double EarthRadius = 6371000.0;
    private const double Mu = 3.986e14;

    [HttpPost]
    public ActionResult<SimulationResult> RunSimulation([FromBody] SimulationRequest request)
    {
        var stages = ResolveStages(request);
        if (stages == null || stages.Count == 0)
            return BadRequest("No stages configured. Provide a rocketId or customStages.");

        var rocketName = request.RocketId != null
            ? RocketsController.FindPreset(request.RocketId)?.Name ?? request.RocketId
            : "Custom Rocket";

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

            var result = new SimulationResult
            {
                Id = Guid.NewGuid().ToString("N")[..8],
                RocketName = rocketName
            };

            int totalSteps = (int)(request.Duration / request.Dt);
            int telemetryInterval = Math.Max(1, (int)(5.0 / request.Dt)); // every 5s

            for (int i = 0; i < totalSteps; i++)
            {
                var tel = TitanInterop.titan_step(sim);

                if (i % telemetryInterval == 0)
                {
                    result.Telemetry.Add(new TelemetryPoint
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
                    result.OrbitAchieved = true;
                    result.FinalTime = tel.Time;
                    break;
                }
            }

            if (!result.OrbitAchieved)
                result.FinalTime = request.Duration;

            return Ok(result);
        }
        finally
        {
            TitanInterop.titan_destroy(sim);
        }
    }

    [HttpPost("compare")]
    public ActionResult<CompareResult> Compare([FromBody] CompareRequest request)
    {
        var compareResult = new CompareResult();

        foreach (var rocketId in request.RocketIds)
        {
            var simRequest = new SimulationRequest
            {
                RocketId = rocketId,
                TargetAltitude = request.TargetAltitude
            };

            var actionResult = RunSimulation(simRequest);
            if (actionResult.Result is OkObjectResult ok && ok.Value is SimulationResult simResult)
            {
                compareResult.Simulations.Add(simResult);
            }
        }

        return Ok(compareResult);
    }

    private static List<StageRequest>? ResolveStages(SimulationRequest request)
    {
        if (request.CustomStages != null && request.CustomStages.Count > 0)
            return request.CustomStages;

        if (string.IsNullOrEmpty(request.RocketId))
            return null;

        var preset = RocketsController.FindPreset(request.RocketId);
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
