# koom-calls-server · CI/CD, secrets y deploy

> Documento consolidado. Mantén este archivo como la fuente única de verdad
> para la cadena de publicación, secrets y rollback. Los workflows
> en `.github/workflows/*.yml` están documentados en forma breve al final.

---

## 1. Visión general

```
PR develop → main
        │
        ▼
.github/workflows/docker-publish.yml
  · build multi-arch (linux/amd64, linux/arm64)
  · push a ghcr.io/jezer10/koom-calls-server
        │
        ▼
.github/workflows/deploy-vps.yml   (workflow_run, auto)
  · SSH a la VPS
  · docker pull
  · docker run --restart unless-stopped
  · health check /health
```

Imágenes publicadas con tags:

| Tag | Cuándo |
|---|---|
| `latest` | push a `main` (default branch) |
| `main-<sha-corto>` | cada push a `main` |
| `vX.Y.Z`, `vX.Y` | tag `v*` |
| `<sha-corto>` | cualquier commit |
| `pr-<n>` | PR builds (no se despliegan) |

## 2. GitHub Secrets (Settings → Secrets and variables → Actions)

### Requeridos para deploy

| Secret | Ejemplo | Notas |
|---|---|---|
| `VPS_HOST` | `203.0.113.10` o `vps.example.com` | IP pública o dominio |
| `VPS_USER` | `deploy` | usuario SSH (no root) |
| `VPS_SSH_KEY` | (clave privada) | la **pública** va en `~/.ssh/authorized_keys` de la VPS |
| `VPS_PORT` | `22` | opcional, default 22 |
| `VPS_DEPLOY_DIR_BACK` | `~/koom-calls-server` | opcional, default `~/koom-calls-server` |

### Auto-proveídos

- `GITHUB_TOKEN` — para `docker/login-action` contra `ghcr.io` y `packages: write`.

## 3. Variables en la VPS: `~/koom-calls-server/.env`

Copia `back/.env.example.docker` a `~/koom-calls-server/.env` en la VPS y rellena.

Genera secretos con:

```bash
openssl rand -base64 48   # → JWT_SECRET
openssl rand -base64 48   # → TURN_SHARED_SECRET (debe coincidir con coturn)
openssl rand -base64 32   # → password de Postgres
```

| Variable | Requerida prod | Default dev | Notas |
|---|---|---|---|
| `NODE_ENV` | sí (production) | development | activa validaciones estrictas |
| `PORT` | opcional | 8080 | |
| `CORS_ORIGIN` | recomendada | `*` | ej. `https://app.example.com` (no `*` con credenciales) |
| `JWT_SECRET` | **sí** | auto-gen dev | 32+ bytes random |
| `JWT_TTL` | opcional | 1h | ej. `15m`, `7d` |
| `JWT_AUDIENCE` | opcional | — | claim `aud` |
| `JWT_ISSUER` | opcional | — | claim `iss` |
| `DATABASE_URL` | recomendada | `sqlite::memory:` | prod: `postgres://koom:<pw>@postgres:5432/koom` |
| `REDIS_URL` | recomendada | `''` | `redis://redis:6379`; vacío = adapter WS desactivado |
| `TURN_URL` | **sí** | `''` | ej. `turn:turn.example.com:3478` |
| `TURN_SHARED_SECRET` | **sí** | `dev-turn-secret` | mismo que coturn |
| `TURN_TTL` | opcional | 3600 | TTL de credenciales TURN (segundos) |
| `TURN_REALM` | opcional | `koom.local` | |
| `TURN_STUN_URLS` | opcional | `stun:stun.l.google.com:19302` | CSV |
| `LIVEKIT_URL` | recomendada | `''` | `ws://livekit:7880` |
| `LIVEKIT_API_KEY` | recomendada | `''` | |
| `LIVEKIT_API_SECRET` | recomendada | `''` | |
| `SFU_TOKEN_TTL_SECONDS` | opcional | 3600 | |
| `TURN_TOKEN_TTL_SECONDS` | opcional | 3600 | |
| `LOG_LEVEL` | opcional | info | pino: trace/debug/info/warn/error |
| `PRESENCE_TTL_SECONDS` | opcional | 60 | |
| `RATE_LIMIT_SOCKET_BURST` | opcional | 30 | |
| `RATE_LIMIT_SOCKET_PER_SECOND` | opcional | 30 | |
| `RATE_LIMIT_USER_BURST` | opcional | 100 | |
| `RATE_LIMIT_USER_PER_SECOND` | opcional | 100 | |
| `RATE_LIMIT_IP_BURST` | opcional | 200 | |
| `RATE_LIMIT_IP_PER_SECOND` | opcional | 200 | |
| `SIGNALING_NAMESPACE` | opcional | `/signaling` | |

## 4. Setup inicial en la VPS (una sola vez)

```bash
ssh deploy@VPS_HOST

# 1. Directorio de deploy
mkdir -p ~/koom-calls-server && cd ~/koom-calls-server

# 2. .env (copiar de .env.example.docker y rellenar secretos reales)

# 3. (Opcional) Prueba manual ANTES del primer deploy automático:
docker pull ghcr.io/jezer10/koom-calls-server:latest
docker run -d --name koom-calls-server-test \
  --env-file .env -p 8080:8080 \
  ghcr.io/jezer10/koom-calls-server:latest
curl -fsS http://localhost:8080/health
docker rm -f koom-calls-server-test

# 4. La red koom-net se crea automáticamente en el primer deploy vía SSH
```

## 5. Procedimiento de release

```bash
# 1. PR de develop → main en koom-calls-server
# 2. Merge. Se disparan en orden:
#    a. docker-publish.yml → build + push a ghcr.io
#    b. deploy-vps.yml       → SSH + pull + restart
# 3. Verificar en la VPS:
ssh deploy@VPS_HOST "docker ps && curl -fsS http://localhost:8080/health"
# 4. (Opcional) Tag semver:
git tag v1.0.0 main && git push --tags
```

## 6. Deploy manual (rollback / hotfix)

Repo → Actions → "Deploy to VPS" → Run workflow.

- **Default tag:** `latest` (más reciente publicado en GHCR).
- **Tag específico:** pegar `main-abc1234` o `v1.0.0` en el input "tag".

## 7. Rollback de emergencia vía SSH

```bash
ssh deploy@VPS_HOST
docker pull ghcr.io/jezer10/koom-calls-server:main-<sha-anterior>
docker rm -f koom-calls-server
docker run -d \
  --name koom-calls-server \
  --restart unless-stopped \
  --network koom-net \
  -p 8080:8080 \
  --env-file ~/koom-calls-server/.env \
  ghcr.io/jezer10/koom-calls-server:main-<sha-anterior>

# Verificar
sleep 3
curl -fsS http://localhost:8080/health
docker logs --tail 100 koom-calls-server
```

## 8. Workflows

### `.github/workflows/docker-publish.yml`

- Trigger: push a `main`, tag `v*`, manual.
- Build: docker buildx multi-arch (linux/amd64 + linux/arm64), GHA cache.
- Push: `ghcr.io/jezer10/koom-calls-server` con tags según `docker/metadata-action`.
- Permisos: `contents: read`, `packages: write`.

### `.github/workflows/deploy-vps.yml`

- Trigger: tras `workflow_run` exitoso de docker-publish, o manual.
- `concurrency: deploy-koom-calls-server` — cancela runs concurrentes.
- Steps:
  1. Determina tag (input manual o `latest`).
  2. `appleboy/ssh-action@v1` con secretos VPS.
  3. Script remoto:
     - Valida `.env` existe.
     - `docker login ghcr.io`.
     - `docker pull` de la imagen.
     - `docker rm -f koom-calls-server` (best-effort).
     - Crea red `kooom-net` si no existe.
     - `docker run -d --restart unless-stopped --network koom-net -p 8080:8080 --env-file .env <image>`.
     - Loop de health check hasta 30s.
     - Falla con `docker logs --tail 50` si no sana.

## 9. Verificación end-to-end

Tras el primer deploy:

```bash
# Health
curl -fsS https://api.tu-dominio.com/health
# → {"status":"ok","uptime":N,"timestamp":"..."}

# Métricas Prometheus
curl -fsS https://api.tu-dominio.com/metrics | head

# Endpoint autenticado
TOKEN=$(openssl rand -base64 32 | tr -d '=' | tr '/+' '_-')
curl -fsS -H "Authorization: Bearer $TOKEN" \
  https://api.tu-dominio.com/calls/abc/turn-credentials
# → {"urls":[...],"username":"...","credential":"...","ttl":3600,"expiresAt":"..."}
```

## 10. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `JWT_SECRET is required in production` | Falta o vacío en `NODE_ENV=production` | Setear con `openssl rand -base64 48` |
| `TURN_URL is required in production` | Igual | Setear con URL del servidor coturn |
| `Could not find module 'X'` | `npm ci` falló en la build | Revisar logs de la action, re-disparar |
| Health check falla 30s | La imagen crashea o no escucha | `docker logs koom-calls-server` en VPS |
| `unauthorized` en socket.io | Secret del middleware WS ≠ del firmador | El middleware usa `process.env.JWT_SECRET`, mismo que el firmador |
| `permission denied` en `docker login` | `GITHUB_TOKEN` expiró o sin scopes | Re-disparar la action, el token se regenera |
| Socket.IO no recibe eventos entre instancias | Falta `REDIS_URL` | Setear `REDIS_URL=redis://...` y redeploy |
| Front no conecta al back | `VITE_API_BASE_URL` apunta a localhost o ruta incorrecta | Re-disparar publish con el secret correcto, redeploy front |
