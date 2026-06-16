# koom-calls-server · CI/CD, secrets y deploy

> Documento consolidado. Mantén este archivo como la fuente única de verdad
> para la cadena de publicación, secrets y rollback. Los workflows
> en `.github/workflows/*.yml` están documentados en forma breve al final.

---

## 1. Visión general

```
PR develop → main
        │
        ├─── .github/workflows/ci.yml          (en cada push/PR)
        │      · pnpm install --frozen-lockfile
        │      · pnpm lint:check
        │      · pnpm test  (jest)
        │      · pnpm build (nest build)
        │
        ▼
.github/workflows/deploy.yml           (push a main o manual)
  · build linux/amd64 + push a ghcr.io/jezer10/koom-calls-server
  · SSH a la VPS + pull + run + health check
  (single job, sin cadena workflow_run)
```

Imágenes publicadas con tags:

| Tag | Cuándo |
|---|---|
| `latest` | push a `main` (con `enable=${{ github.ref == 'refs/heads/main' }}`) |
| `main` | cada push a `main` (branch ref) |
| `<sha-corto>` | cualquier commit |

> Configuración mínima intencional: no se publican tags de develop,
> ni de PR, ni semver. Para versiones formales, tag en `main` y usá
> `Actions → Deploy to VPS → Run workflow → tag: <sha>`.

## 2. GitHub Secrets (Settings → Secrets and variables → Actions)

### Requeridos para deploy

| Secret | Ejemplo | Notas |
|---|---|---|
| `VPS_HOST` | `203.0.113.10` o `vps.example.com` | IP pública o dominio |
| `VPS_USER` | `deploy` | usuario SSH (no root, con `docker` group) |
| `VPS_SSH_KEY` | (clave privada) | la **pública** va en `~/.ssh/authorized_keys` de la VPS |
| `VPS_PORT` | `22` | opcional, default 22 |
| `VPS_DEPLOY_DIR_BACK` | `~/koom-calls-server` | opcional, default `~/koom-calls-server` |

### Auto-proveídos

- `GITHUB_TOKEN` — para `docker/login-action` contra `ghcr.io`. Requiere
  `packages: write` (ya está en `deploy.yml`).

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
scp back/.env.example.docker deploy@VPS_HOST:~/koom-calls-server/.env
ssh deploy@VPS_HOST "nano ~/koom-calls-server/.env"

# 3. (Opcional) Smoke test ANTES del primer deploy automático:
docker pull ghcr.io/jezer10/koom-calls-server:latest
docker run -d --name koom-calls-server-test \
  --env-file .env -p 8080:8080 \
  ghcr.io/jezer10/koom-calls-server:latest
curl -fsS http://localhost:8080/health
docker rm -f koom-calls-server-test
```

## 5. Procedimiento de release

```bash
# 1. PR de develop → main en koom-calls-server
# 2. CI corre y debe pasar (gate de calidad).
# 3. Merge. Se dispara:
#    a. deploy.yml           → build + push + SSH + pull + restart + health check
# 4. Verificar en la VPS:
ssh deploy@VPS_HOST "docker ps && curl -fsS http://localhost:8080/health"
# 5. (Opcional) Tag formal para auditoría / rollback:
git tag v1.0.0 main && git push --tags
# (El tag no dispara deploy — solo crea un alias en git).
```

## 6. Deploy manual (rollback / hotfix)

Repo → Actions → "Deploy to VPS" → Run workflow.

- **Default tag:** `latest` (más reciente publicado en GHCR).
- **Tag específico:** pegar `main-abc1234` o `v1.0.0` en el input `tag`.

## 7. Rollback de emergencia vía SSH

```bash
ssh deploy@VPS_HOST
cd ~/koom-calls-server
docker pull ghcr.io/jezer10/koom-calls-server:main-<sha-anterior>
docker rm -f koom-calls-server
docker run -d \
  --name koom-calls-server \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  ghcr.io/jezer10/koom-calls-server:main-<sha-anterior>

# Verificar
sleep 3
curl -fsS http://localhost:8080/health
docker logs --tail 100 koom-calls-server
```

## 8. Workflows

### `.github/workflows/ci.yml`

- Trigger: `pull_request` a `main`/`develop`, `push` a `main`/`develop`,
  manual (`workflow_dispatch`).
- `paths-ignore`: `docs/**`, `*.md` (no corre por cambios solo de docs).
- `concurrency: ci-…-${{ pr.number || ref }}` con
  `cancel-in-progress: ${{ event_name == 'pull_request' }}`.
  Un force-push sobre la misma PR cancela el run anterior; los pushes a
  `main`/`develop` no se cancelan entre sí (dejan terminar para audit).
- `permissions: contents: read` (principio de menor privilegio).
- Job `ci` (`ubuntu-latest`, `timeout-minutes: 15`):
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` con `node-version: 22` y `cache: pnpm`
     (cachea el store de pnpm por hash de `pnpm-lock.yaml`).
  3. `corepack enable` — garantiza la versión de pnpm declarada en
     `packageManager` (`11.5.2`).
  4. `pnpm install --frozen-lockfile` — falla si el lockfile está
     desincronizado.
  5. `pnpm lint:check` — eslint, falla en cualquier error.
  6. `pnpm test` — jest.
  7. `pnpm build` — `nest build` (type-check de TS).
- Tiempo esperado de punta a punta: ~1 min cacheado, ~3 min en frío.
- **Branch protection (acción manual):** en GitHub UI →
  Settings → Branches → `main` y `develop` → Require status checks →
  seleccionar `Lint, test, build` como required. Sin esto el check es
  solo informativo y no bloquea merges rotos.

### `.github/workflows/deploy.yml`

- Trigger: push a `main`, manual con input `tag` (default `latest`).
- `concurrency: deploy-<repo>` con `cancel-in-progress: true`.
- `environment: production` (GitHub Environments) — opcionalmente con
  reviewers requeridos en la UI.
- `permissions: contents: read, packages: write`.
- Steps:
  1. Checkout + `docker/setup-buildx-action@v3` + `docker/login-action@v3`
     contra `ghcr.io` con `GITHUB_TOKEN`.
  2. `docker/metadata-action@v5` con tags:
     - `main` (branch ref)
     - `<short-sha>`
     - `latest` (solo si `github.ref == 'refs/heads/main'`)
  3. `docker/build-push-action@v6` con `platforms: linux/amd64`,
     GHA cache `mode=min`, push a `ghcr.io/jezer10/koom-calls-server`.
  4. `appleboy/ssh-action@v1` con secretos VPS.
  5. Script remoto (`set -euo pipefail`):
     - `cd $DEPLOY_DIR` (default `~/koom-calls-server`).
     - **Hard-fail si falta `.env`** (no hay input para saltearlo).
     - `docker login ghcr.io` con `GITHUB_TOKEN`.
     - `docker pull <image>`.
     - `docker rm -f koom-calls-server` (best-effort).
     - `docker run -d --restart unless-stopped -p 8080:8080 --env-file .env <image>`.
     - Loop de health check hasta 20s.
     - Falla con `docker logs --tail 50` si no sana.
- **Single-arch intencional:** la VPS es x86. Para añadir `linux/arm64`,
  cambiar `platforms:` en el workflow.

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
| `JWT_SECRET is required in production` | Falta o vacío en `NODE_ENV=production` | Setear con `openssl rand -base64 48` en la VPS |
| `TURN_URL is required in production` | Igual | Setear con URL del servidor coturn |
| `Could not find module 'X'` | `pnpm install` falló en la build | Revisar logs de la action, re-disparar |
| Health check falla 20s | La imagen crashea o no escucha | `docker logs koom-calls-server` en la VPS |
| `unauthorized` en socket.io | Secret del middleware WS ≠ del firmador | El middleware usa `process.env.JWT_SECRET`, mismo que el firmador |
| `permission denied` en `docker login` | `GITHUB_TOKEN` expiró o sin scopes | Re-disparar la action, el token se regenera |
| Socket.IO no recibe eventos entre instancias | Falta `REDIS_URL` | Setear `REDIS_URL=redis://...` y redeploy |
| Front no conecta al back | `VITE_API_BASE_URL` del front apunta a localhost o ruta incorrecta | Corregir secret en el repo del front, re-disparar publish + deploy del front |
| Deploy falla con `Falta ~/koom-calls-server/.env` | `.env` no existe en la VPS | Copiá `back/.env.example.docker` a `~/koom-calls-server/.env` en la VPS, editá los secretos, y re-dispará el workflow |
