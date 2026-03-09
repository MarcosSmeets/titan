namespace Titan.API.Models;

public class RocketPreset
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Manufacturer { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public double Height { get; set; }           // meters
    public double Diameter { get; set; }         // meters
    public double LaunchMass { get; set; }       // kg
    public double PayloadToLEO { get; set; }     // kg
    public double? CostPerLaunch { get; set; }   // USD millions
    public int FirstFlight { get; set; }
    public List<StagePreset> Stages { get; set; } = new();
}

public class StagePreset
{
    public string Name { get; set; } = string.Empty;
    public double DryMass { get; set; }          // kg
    public double FuelMass { get; set; }         // kg
    public double BurnRate { get; set; }         // kg/s
    public double ExhaustVelocity { get; set; }  // m/s (Isp * g0)
    public double Isp { get; set; }              // seconds
    public double ReferenceArea { get; set; }    // m^2
    public double DragCoefficient { get; set; }
}
