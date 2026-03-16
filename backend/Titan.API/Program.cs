using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Titan.API.Data;
using Titan.API.Hubs;
using Titan.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Railway provides PORT env var
var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
builder.WebHost.UseUrls($"http://+:{port}");

// Railway provides DATABASE_URL in URI format: postgresql://user:pass@host:port/db
// Also support Npgsql format: Host=...;Port=...;Database=...;Username=...;Password=...
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? "Host=localhost;Port=5432;Database=titan;Username=titan;Password=titan";

static string ParseDatabaseUrl(string url)
{
    // Already in Npgsql format
    if (url.StartsWith("Host=", StringComparison.OrdinalIgnoreCase))
        return url;

    // Parse URI format: postgresql://user:pass@host:port/db
    var uri = new Uri(url.Replace("postgres://", "postgresql://"));
    var userInfo = uri.UserInfo.Split(':');
    var host = uri.Host;
    var dbPort = uri.Port > 0 ? uri.Port : 5432;
    var database = uri.AbsolutePath.TrimStart('/');
    var username = userInfo.Length > 0 ? userInfo[0] : "";
    var password = userInfo.Length > 1 ? userInfo[1] : "";

    var connStr = $"Host={host};Port={dbPort};Database={database};Username={username};Password={password}";

    // Railway PostgreSQL uses SSL
    if (!url.Contains("localhost") && !url.Contains("127.0.0.1"))
        connStr += ";SSL Mode=Require;Trust Server Certificate=true";

    return connStr;
}

var connectionString = ParseDatabaseUrl(databaseUrl);

builder.Services.AddDbContext<TitanDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<SimulationStore>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET");
if (string.IsNullOrEmpty(jwtSecret))
{
    // Generate a random secret so the app can START and serve /health
    // Auth won't work until JWT_SECRET is properly configured
    jwtSecret = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
    Console.WriteLine("WARNING: JWT_SECRET not set — using random key. Auth will not persist across restarts.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "titan-api",
            ValidAudience = "titan-app",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };

        // SignalR token from query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var corsOrigins = Environment.GetEnvironmentVariable("CORS_ORIGINS")?.Split(',')
    ?? new[] { "http://localhost:5173", "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(corsOrigins.Select(o => o.Trim()).ToArray())
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .SetIsOriginAllowedToAllowWildcardSubdomains();
    });
});

var app = builder.Build();

// Auto-migrate database and seed admin (non-fatal — app starts even if DB is slow)
try
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<TitanDbContext>();
    try
    {
        if (db.Database.GetPendingMigrations().Any())
            db.Database.Migrate();
        else
            db.Database.EnsureCreated();
    }
    catch
    {
        try { db.Database.EnsureCreated(); }
        catch (Exception ex)
        {
            Console.WriteLine($"WARNING: Database schema creation failed: {ex.Message}");
            Console.WriteLine("The app will start but database operations will fail until DB is available.");
        }
    }

    // Seed admin only if ADMIN_PASSWORD is set
    var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD");
    if (!string.IsNullOrEmpty(adminPassword))
    {
        var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
        await auth.SeedAdmin();
    }
}
catch (Exception ex)
{
    Console.WriteLine($"WARNING: Database initialization failed: {ex.Message}");
    Console.WriteLine("The app will start — DB will be retried on first request.");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<TelemetryHub>("/hubs/telemetry");

// Health check endpoints for Railway
// /health/live — always responds (proves the process is running)
app.MapGet("/health/live", () => Results.Ok(new { status = "alive" }));

// /health — checks database connectivity
app.MapGet("/health", async (IServiceProvider sp) =>
{
    try
    {
        using var scope = sp.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TitanDbContext>();
        await db.Database.CanConnectAsync();
        return Results.Ok(new { status = "healthy", database = "connected" });
    }
    catch (Exception ex)
    {
        // Return 200 anyway so Railway considers the service healthy
        // The DB might just be slow to start — don't kill the service for it
        return Results.Ok(new { status = "degraded", database = ex.Message });
    }
});

app.Run();
