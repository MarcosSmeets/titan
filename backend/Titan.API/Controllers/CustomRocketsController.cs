using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Titan.API.Data;
using Titan.API.Data.Entities;

namespace Titan.API.Controllers;

[ApiController]
[Route("api/custom-rockets")]
public class CustomRocketsController : ControllerBase
{
    private readonly TitanDbContext _db;

    public CustomRocketsController(TitanDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<object>>> GetAll()
    {
        var rockets = await _db.CustomRockets
            .Include(r => r.Stages)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.CreatedAt,
                StageCount = r.Stages.Count,
                Stages = r.Stages.OrderBy(s => s.StageIndex).Select(s => new
                {
                    s.StageIndex,
                    s.DryMass,
                    s.FuelMass,
                    s.BurnRate,
                    s.ExhaustVelocity,
                    s.Isp,
                    s.ReferenceArea,
                    s.DragCoefficient,
                }).ToList()
            })
            .ToListAsync();

        return Ok(rockets);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(string id)
    {
        var rocket = await _db.CustomRockets
            .Include(r => r.Stages)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (rocket == null) return NotFound();

        return Ok(new
        {
            rocket.Id,
            rocket.Name,
            rocket.CreatedAt,
            Stages = rocket.Stages.OrderBy(s => s.StageIndex).Select(s => new
            {
                s.StageIndex,
                s.DryMass,
                s.FuelMass,
                s.BurnRate,
                s.ExhaustVelocity,
                s.Isp,
                s.ReferenceArea,
                s.DragCoefficient,
            }).ToList()
        });
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateCustomRocketRequest request)
    {
        var id = Guid.NewGuid().ToString("N")[..8];
        var entity = new CustomRocketEntity
        {
            Id = id,
            Name = request.Name,
            CreatedAt = DateTime.UtcNow,
            Stages = request.Stages.Select((s, i) => new CustomRocketStageEntity
            {
                RocketId = id,
                StageIndex = i,
                DryMass = s.DryMass,
                FuelMass = s.FuelMass,
                BurnRate = s.BurnRate,
                ExhaustVelocity = s.ExhaustVelocity,
                Isp = s.Isp,
                ReferenceArea = s.ReferenceArea,
                DragCoefficient = s.DragCoefficient,
            }).ToList()
        };

        _db.CustomRockets.Add(entity);
        await _db.SaveChangesAsync();

        return Ok(new { id, request.Name });
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(string id)
    {
        var rocket = await _db.CustomRockets
            .Include(r => r.Stages)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (rocket == null) return NotFound();

        _db.CustomRockets.Remove(rocket);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateCustomRocketRequest
{
    public string Name { get; set; } = string.Empty;
    public List<CustomStageRequest> Stages { get; set; } = new();
}

public class CustomStageRequest
{
    public double DryMass { get; set; }
    public double FuelMass { get; set; }
    public double BurnRate { get; set; }
    public double ExhaustVelocity { get; set; }
    public double Isp { get; set; }
    public double ReferenceArea { get; set; }
    public double DragCoefficient { get; set; }
}
