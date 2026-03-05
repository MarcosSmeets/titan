using Microsoft.EntityFrameworkCore;
using Titan.API.Data.Entities;

namespace Titan.API.Data;

public class TitanDbContext : DbContext
{
    public DbSet<SimulationEntity> Simulations => Set<SimulationEntity>();
    public DbSet<SimulationTelemetryEntity> SimulationTelemetry => Set<SimulationTelemetryEntity>();
    public DbSet<SimulationEventEntity> SimulationEvents => Set<SimulationEventEntity>();
    public DbSet<CustomRocketEntity> CustomRockets => Set<CustomRocketEntity>();
    public DbSet<CustomRocketStageEntity> CustomRocketStages => Set<CustomRocketStageEntity>();

    public TitanDbContext(DbContextOptions<TitanDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SimulationEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasMany(x => x.Telemetry).WithOne().HasForeignKey(x => x.SimulationId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Events).WithOne().HasForeignKey(x => x.SimulationId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SimulationTelemetryEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.SimulationId);
        });

        modelBuilder.Entity<SimulationEventEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.SimulationId);
        });

        modelBuilder.Entity<CustomRocketEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasMany(x => x.Stages).WithOne().HasForeignKey(x => x.RocketId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CustomRocketStageEntity>(e =>
        {
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.RocketId);
        });
    }
}
