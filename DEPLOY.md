# Deploy Titan on Railway

This guide covers deploying the full Titan stack (API + Frontend + PostgreSQL) on [Railway](https://railway.com/).

## Architecture on Railway

Railway runs each component as a separate **service** in one **project**:

```
Railway Project: titan
├── PostgreSQL         (managed plugin)
├── titan-api          (Docker: .NET 8 + C++ physics engine)
└── titan-frontend     (Docker: nginx serving React build)
```

The API connects to PostgreSQL using the `DATABASE_URL` that Railway auto-injects.
The frontend is built with `VITE_API_URL` pointing to the API's public URL so it
can make cross-origin requests directly (no nginx proxy needed in production).

---

## Step-by-Step Deployment

### 1. Create a Railway Project

1. Go to [railway.com](https://railway.com/) and sign in
2. Click **New Project** → **Empty Project**
3. Name it `titan` (or whatever you prefer)

### 2. Add PostgreSQL

1. Inside your project, click **+ New** → **Database** → **PostgreSQL**
2. Railway provisions a managed PostgreSQL instance and exposes connection variables
3. Note: the `DATABASE_URL` is automatically available to linked services

### 3. Deploy the API

1. Click **+ New** → **GitHub Repo** → select your `titan` repository
2. Railway detects the `railway.toml` at root and uses `backend/Titan.API/Dockerfile`
3. Go to the service **Settings**:
   - **Root Directory**: leave as `/` (the Dockerfile references `backend/` paths)
   - **Build Command**: (leave empty, Docker handles it)
4. Go to the **Variables** tab and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Click **Add Reference** → select your Postgres service |
| `JWT_SECRET` | *(generate a 32+ char random string)* | `openssl rand -base64 32` |
| `ADMIN_PASSWORD` | *(your admin password)* | Optional — skips seeding if empty |
| `CORS_ORIGINS` | *(set after frontend deploys)* | e.g. `https://titan-frontend-production.up.railway.app` |

5. Click **Deploy**
6. After deploy, go to **Settings** → **Networking** → **Generate Domain** to get a public URL
7. Copy the API URL (e.g. `https://titan-api-production.up.railway.app`)

### 4. Deploy the Frontend

1. Click **+ New** → **GitHub Repo** → select the **same** `titan` repository again
2. Go to the service **Settings**:
   - **Root Directory**: `frontend`
   - **Dockerfile Path**: `Dockerfile.railway` (it should auto-detect from `railway.toml`)
3. Go to **Variables** and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `VITE_API_URL` | `https://titan-api-production.up.railway.app` | The API URL from step 3.6 |

> **Important**: `VITE_API_URL` is a **build-time** variable. After setting it, trigger a
> redeploy so Vite bakes the URL into the static bundle.

4. Go to **Settings** → **Networking** → **Generate Domain**
5. Copy the frontend URL

### 5. Update API CORS

Go back to the **API service** → **Variables** and update:

```
CORS_ORIGINS=https://titan-frontend-production.up.railway.app
```

Replace with your actual frontend domain. Multiple origins can be comma-separated.

Trigger a redeploy of the API.

### 6. Verify

1. Open the frontend URL in your browser
2. Register an account and launch a simulation
3. Check the API health: `https://<api-url>/health`

---

## Environment Variables Reference

### API Service

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL URI — use Railway reference `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | Yes | Secret for JWT signing, minimum 32 characters |
| `ADMIN_PASSWORD` | No | If set, seeds an admin account on first startup |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins for the frontend |
| `PORT` | Auto | Railway injects this automatically |

### Frontend Service

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Full URL of the API service (build-time variable) |
| `PORT` | Auto | Railway injects this automatically |

---

## How It Works

### Database Connection

The API auto-parses Railway's `DATABASE_URL` format:
```
postgresql://user:password@host:port/database
```

It converts this to Npgsql format and adds SSL settings automatically for
non-localhost connections. On first startup, the API creates all tables using
EF Core's `EnsureCreated()`.

### SignalR WebSockets

SignalR WebSocket connections go directly from the browser to the API's public URL.
The frontend's `config.ts` uses `VITE_API_URL` to construct the hub endpoint:

```
wss://titan-api-production.up.railway.app/hubs/telemetry
```

Railway supports WebSocket connections natively — no extra configuration needed.

### Health Checks

The API exposes `/health` which verifies the database connection:
```json
{ "status": "healthy", "database": "connected" }
```

Railway uses this to determine service readiness (configured in `railway.toml`).

---

## Troubleshooting

### API fails to start — "JWT_SECRET environment variable is required"
→ You forgot to set `JWT_SECRET` in the API's variables.

### Frontend shows "Failed to fetch rockets" or network errors
→ Check that `VITE_API_URL` is set correctly and the API's `CORS_ORIGINS` includes the frontend domain.
→ Remember: `VITE_API_URL` is baked in at build time. After changing it, redeploy the frontend.

### Database connection fails
→ Verify `DATABASE_URL` uses a Railway reference (`${{Postgres.DATABASE_URL}}`), not a hardcoded string.
→ Check the API logs for the parsed connection string.

### SignalR connection fails
→ Check browser console for WebSocket errors.
→ Ensure the API's CORS includes the frontend origin with `AllowCredentials`.

### Build fails on physics engine
→ The API Dockerfile installs `g++` and `cmake` in a build stage. If the build fails,
   check the C++ code compiles locally first: `cd backend/Titan.PhysicsEngine && mkdir build && cd build && cmake .. && cmake --build .`

---

## Local Development (unchanged)

The `docker-compose.yml` still works for local development:

```bash
cp .env.example .env
# Edit .env with your secrets
docker compose up --build
```

Frontend: http://localhost:3000 | API: http://localhost:5000

---

## Cost Estimate

Railway's Hobby plan ($5/month) includes:
- 8 GB RAM / 8 vCPU shared across services
- 100 GB bandwidth
- $0.000231/min for compute

Typical Titan usage (low-to-moderate traffic) runs well within the Hobby plan.
PostgreSQL uses minimal resources since simulation data is relatively small.
