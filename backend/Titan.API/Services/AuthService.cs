using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Titan.API.Data;
using Titan.API.Data.Entities;
using Titan.API.Models;

namespace Titan.API.Services;

public class AuthService
{
    private readonly TitanDbContext _db;
    private readonly string _jwtSecret;

    public AuthService(TitanDbContext db, IConfiguration configuration)
    {
        _db = db;
        _jwtSecret = Environment.GetEnvironmentVariable("JWT_SECRET")
            ?? configuration.GetValue<string>("JwtSecret")
            ?? throw new InvalidOperationException(
                "JWT_SECRET environment variable is required. Set it in .env or appsettings.");
    }

    public async Task<AuthResponse?> Register(string email, string username, string password)
    {
        // Password complexity validation
        if (password.Length < 8)
            throw new ArgumentException("Password must be at least 8 characters long.");
        if (!Regex.IsMatch(password, @"[A-Z]"))
            throw new ArgumentException("Password must contain at least one uppercase letter.");
        if (!Regex.IsMatch(password, @"[a-z]"))
            throw new ArgumentException("Password must contain at least one lowercase letter.");
        if (!Regex.IsMatch(password, @"[0-9]"))
            throw new ArgumentException("Password must contain at least one digit.");

        if (await _db.Users.AnyAsync(u => u.Email == email))
            return null;
        if (await _db.Users.AnyAsync(u => u.Username == username))
            return null;

        var user = new UserEntity
        {
            Id = Guid.NewGuid().ToString("N")[..8],
            Email = email,
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = "user",
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return new AuthResponse
        {
            Token = GenerateJwtToken(user),
            Username = user.Username,
            Email = user.Email,
            Role = user.Role
        };
    }

    public async Task<AuthResponse?> Login(string email, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return null;

        return new AuthResponse
        {
            Token = GenerateJwtToken(user),
            Username = user.Username,
            Email = user.Email,
            Role = user.Role
        };
    }

    public string GenerateJwtToken(UserEntity user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("username", user.Username),
            new Claim(ClaimTypes.Role, user.Role)
        };

        var token = new JwtSecurityToken(
            issuer: "titan-api",
            audience: "titan-app",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task SeedAdmin()
    {
        if (await _db.Users.AnyAsync(u => u.Role == "admin"))
            return;

        var adminPassword = Environment.GetEnvironmentVariable("ADMIN_PASSWORD");
        if (string.IsNullOrEmpty(adminPassword))
            return; // Skip seeding if no password provided

        var admin = new UserEntity
        {
            Id = Guid.NewGuid().ToString("N")[..8],
            Email = "admin@titan.local",
            Username = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
            Role = "admin",
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(admin);
        await _db.SaveChangesAsync();
    }
}
