namespace Titan.API.Data.Entities;

public class CustomRocketEntity
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<CustomRocketStageEntity> Stages { get; set; } = new();
}

public class CustomRocketStageEntity
{
    public int Id { get; set; }
    public string RocketId { get; set; } = string.Empty;
    public int StageIndex { get; set; }
    public double DryMass { get; set; }
    public double FuelMass { get; set; }
    public double BurnRate { get; set; }
    public double ExhaustVelocity { get; set; }
    public double Isp { get; set; }
    public double ReferenceArea { get; set; }
    public double DragCoefficient { get; set; }
}
