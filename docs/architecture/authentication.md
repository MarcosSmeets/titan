# Authentication & Authorization

## Overview

Titan uses JWT (JSON Web Token) authentication to protect write operations. Users register an account, log in to receive a token, and include that token in requests to protected endpoints. Read operations (viewing rockets, simulations, running simulations) are public.

## Authentication Flow

```
┌──────────┐     POST /api/auth/register      ┌──────────┐
│          │  ──────────────────────────────►  │          │
│          │  { email, username, password }     │          │
│          │                                    │          │
│          │  ◄──────────────────────────────  │          │
│          │  { token, username, email, role }  │          │
│          │                                    │          │
│ Frontend │     POST /api/auth/login          │   API    │
│          │  ──────────────────────────────►  │          │
│          │  { email, password }               │          │
│          │                                    │          │
│          │  ◄──────────────────────────────  │          │
│          │  { token, username, email, role }  │          │
│          │                                    │          │
│          │  GET /api/custom-rockets           │          │
│          │  Authorization: Bearer <token>     │          │
│          │  ──────────────────────────────►  │          │
└──────────┘                                    └──────────┘
```

## JWT Token

### Claims

| Claim | Description |
|-------|-------------|
| `sub` | User ID (8-char unique) |
| `email` | User's email address |
| `username` | Display name |
| `role` | `user` or `admin` |

### Configuration

| Property | Value |
|----------|-------|
| Issuer | `titan-api` |
| Audience | `titan-app` |
| Expiry | 24 hours |
| Algorithm | HMAC-SHA256 |
| Signing Key | `JWT_SECRET` environment variable |

### Transport

- **REST API**: `Authorization: Bearer <token>` header
- **SignalR WebSocket**: `?access_token=<token>` query parameter (read from `OnMessageReceived` event)

## Password Security

### Hashing

Passwords are hashed with BCrypt before storage. The API never stores or logs plaintext passwords.

```csharp
// Registration
user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);

// Login verification
BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
```

### Complexity Requirements

| Requirement | Rule |
|-------------|------|
| Minimum length | 8 characters |
| Uppercase | At least 1 uppercase letter |
| Lowercase | At least 1 lowercase letter |
| Digit | At least 1 digit |

Validation is enforced server-side in `AuthService` and client-side in `RegisterPage`.

## Roles

### User Role

Default role assigned to all newly registered accounts. Can:
- View all rockets and simulations
- Run simulations
- Create custom rockets (requires auth)
- Delete own custom rockets (requires auth)

### Admin Role

Seeded on startup if `ADMIN_PASSWORD` environment variable is set:
- Email: `admin@titan.local`
- Username: `admin`
- Same permissions as user role

## Authorization

### Protected Endpoints

| Endpoint | Method | Auth Required |
|----------|--------|--------------|
| `/api/auth/me` | GET | Yes |
| `/api/custom-rockets` | POST | Yes |
| `/api/custom-rockets/{id}` | DELETE | Yes |
| `/api/simulations/{id}` | DELETE | Yes |

### Public Endpoints

| Endpoint | Method |
|----------|--------|
| `/api/auth/register` | POST |
| `/api/auth/login` | POST |
| `/api/rockets` | GET |
| `/api/rockets/{id}` | GET |
| `/api/custom-rockets` | GET |
| `/api/custom-rockets/{id}` | GET |
| `/api/simulations` | GET |
| `/api/simulations/{id}` | GET |
| `/api/simulations` | POST |
| `/api/simulations/compare` | POST |
| `/hubs/telemetry` | WebSocket |

### Implementation

Authorization is implemented with ASP.NET Core's `[Authorize]` attribute:

```csharp
[Authorize]
public class CustomRocketsController : ControllerBase
{
    [HttpGet]       // No [Authorize] → public
    public async Task<ActionResult> GetAll() { ... }

    [HttpPost]
    [Authorize]     // Requires valid JWT
    public async Task<ActionResult> Create(...) { ... }

    [HttpDelete("{id}")]
    [Authorize]     // Requires valid JWT
    public async Task<ActionResult> Delete(string id) { ... }
}
```

## Frontend Integration

### Token Storage

JWT tokens are stored in `localStorage`:

```typescript
const TOKEN_KEY = 'titan_token';

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}
```

### Token Parsing

Claims are extracted by decoding the JWT payload (base64):

```typescript
export function parseToken(jwt: string) {
    const payload = jwt.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return {
        sub: decoded.sub,
        email: decoded.email,
        username: decoded.username,
        role: decoded.role,
    };
}
```

### AuthContext

The `AuthProvider` wraps the app and provides auth state:

```typescript
interface AuthContextType {
    user: User | null;
    login: (user: User) => void;
    logout: () => void;
}
```

On mount, it reads the stored token, parses claims, and restores the user session. Components use `useContext(AuthContext)` to access the current user and auth actions.

### Protected UI

- Custom rocket **create/delete** buttons are hidden or disabled when not authenticated
- Login/Register pages redirect to the launch page on success
- Navigation shows username and logout button when authenticated

## Database Schema

```sql
CREATE TABLE Users (
    Id TEXT PRIMARY KEY,
    Email TEXT NOT NULL UNIQUE,
    Username TEXT NOT NULL UNIQUE,
    PasswordHash TEXT NOT NULL,
    Role TEXT NOT NULL DEFAULT 'user',
    CreatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | Signing key for tokens (min 32 characters) |
| `ADMIN_PASSWORD` | No | Password for seeded admin account |
