# Local development stack (docker compose)

This document explains how to run the **koom-calls-server** local development
stack with Docker Compose. It brings up everything required by M4 (and later
milestones): the API, PostgreSQL, Redis, LiveKit, and coturn.

The SPA (`front/`) is **not** included in the compose stack — run its dev
server separately and point it at `http://localhost:8080` for the API.

---

## 1. Prerequisites

- Docker Engine 24+ with the Compose plugin (`docker compose`).
- ~4 GB of free RAM (LiveKit and coturn are lightweight; this is mostly a
  comfortable buffer for the API + Postgres).

## 2. Quick start

From the `back/` directory (the same directory that contains this file):

```bash
# 1. Create your local env file from the template
cp .env.example.docker .env

# 2. (optional) Edit .env if you need to change ports, secrets, etc.

# 3. Build the API image and start every service
docker compose up --build

# 4. In a second terminal, start the SPA dev server
#    (from the front/ repo):
#      pnpm install
#      pnpm run dev
#    The SPA should target http://localhost:8080 for API requests.
```

To stop everything: `Ctrl+C`, then `docker compose down` (add `-v` to also
remove the Postgres volume).

## 3. Services & ports

| Service   | Container        | Host port(s)                             | Purpose                                                |
|-----------|------------------|------------------------------------------|--------------------------------------------------------|
| `api`     | `koom-api`       | `8080:8080`                              | NestJS signaling server (HTTP + Socket.IO).            |
| `postgres`| `koom-postgres`  | `5432:5432`                              | Persistence for call history, participants, etc.       |
| `redis`   | `koom-redis`     | `6379:6379`                              | Ephemeral state, presence, and Socket.IO adapter.      |
| `livekit` | `koom-livekit`   | `7880:7880`, `7881:7881/udp`, `7882:7882/udp` | SFU for multi-party WebRTC.                       |
| `coturn`  | `koom-coturn`    | `3478:3478` (UDP+TCP), `5349:5349/tcp`, `49152-49252:49152-49252/udp` | TURN/STUN relay for NAT traversal. |

The API image is built from the local `Dockerfile`; all other services are
pulled from Docker Hub.

## 4. Healthchecks

Every long-running service has a `HEALTHCHECK` defined. After `docker compose
up`, you can verify the stack with:

```bash
docker compose ps
```

Look for `(healthy)` in the `STATUS` column for `api`, `postgres`, `redis`,
and `livekit`. `coturn` does not expose an HTTP endpoint so it has no
healthcheck; if it is running, it is healthy.

Probe the API directly:

```bash
curl http://localhost:8080/health
# => {"status":"ok","uptime":...,"timestamp":"..."}
```

## 5. Useful commands

```bash
# Validate the compose file without starting anything
docker compose config

# Tail logs for a single service
docker compose logs -f api

# Open a psql shell in Postgres
docker compose exec postgres psql -U koom -d koom

# Open a redis-cli
docker compose exec redis redis-cli

# Restart a single service (e.g. after editing .env)
docker compose up -d --force-recreate api

# Wipe the Postgres data volume
docker compose down -v
```

## 6. Environment variables

The compose file reads `back/.env` (created from `.env.example.docker`).
The hostnames used inside the API container — `postgres`, `redis`,
`livekit`, `coturn` — are the compose service names, **not** `localhost`.

| Variable                  | Example                                                  | Notes                              |
|---------------------------|----------------------------------------------------------|------------------------------------|
| `POSTGRES_USER`           | `koom`                                                   |                                    |
| `POSTGRES_PASSWORD`       | `koom-dev-password`                                      | Change for any non-local use.      |
| `POSTGRES_DB`             | `koom`                                                   |                                    |
| `REDIS_URL`               | `redis://redis:6379`                                     | Hostname `redis` = compose service.|
| `DATABASE_URL`            | `postgres://koom:koom-dev-password@postgres:5432/koom`   | Used by the API.                   |
| `JWT_SECRET`              | `dev-secret-change-me`                                   | Change for any non-local use.      |
| `PORT`                    | `8080`                                                   | API HTTP port.                     |
| `SIGNALING_NAMESPACE`     | `/signaling`                                             | Socket.IO namespace.               |
| `CORS_ORIGIN`             | `*`                                                      | Restrict in production.            |
| `LIVEKIT_URL`             | `ws://livekit:7880`                                      |                                    |
| `LIVEKIT_API_KEY`         | `devkey`                                                 |                                    |
| `LIVEKIT_API_SECRET`      | `devsecret-please-change`                                |                                    |
| `TURN_URL`                | `turn:coturn:3478`                                       |                                    |
| `TURN_SHARED_SECRET`      | `dev-turn-secret`                                        | Used by coturn `static-auth-secret`.|
| `TURN_TTL`                | `3600`                                                   | Credential lifetime in seconds.    |

## 7. SPA integration

The SPA dev server (in the `front/` repo) is expected to:

- call the REST API at `http://localhost:8080` (e.g. `/info`, `/health`),
- open the Socket.IO connection to `http://localhost:8080/signaling`,
- obtain LiveKit tokens by calling the API (or a dedicated endpoint once
  M4 lands), and
- use the TURN credentials returned by the API when ICE candidates fail
  direct/host/STUN.

Run it from the `front/` directory with your usual dev script (for example
`pnpm run dev`).

## 8. Limitations / dev-only assumptions

- Secrets and passwords in `.env.example.docker` are placeholders. Do **not**
  ship this compose file unchanged to staging or production.
- `livekit/livekit-server:latest` tracks the upstream `:latest` tag; pin a
  specific version in CI/staging.
- The compose file is not designed to be exposed on a public network. If you
  need to test from another device, terminate TLS in a reverse proxy and
  adjust the `external-ip` of coturn and LiveKit accordingly.
