using Microsoft.AspNetCore.Mvc;
using Titan.API.Models;
using System.Text.Json;

namespace Titan.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RocketsController : ControllerBase
{
    private static readonly Lazy<List<RocketPreset>> _presets = new(() =>
    {
        var json = System.IO.File.ReadAllText(
            Path.Combine(AppContext.BaseDirectory, "Data", "RocketPresets.json"));
        return JsonSerializer.Deserialize<List<RocketPreset>>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
    });

    [HttpGet]
    public ActionResult<List<RocketPreset>> GetAll()
    {
        return Ok(_presets.Value.Select(r => new
        {
            r.Id,
            r.Name,
            r.Manufacturer,
            r.Country,
            r.PayloadToLEO,
            r.LaunchMass,
            r.CostPerLaunch,
            StageCount = r.Stages.Count
        }));
    }

    [HttpGet("{id}")]
    public ActionResult<RocketPreset> GetById(string id)
    {
        var rocket = _presets.Value.FirstOrDefault(r => r.Id == id);
        if (rocket == null)
            return NotFound();
        return Ok(rocket);
    }

    public static RocketPreset? FindPreset(string id) =>
        _presets.Value.FirstOrDefault(r => r.Id == id);
}
