# CI/CD

## Workflows

- **`docker-publish.yml`** — se dispara en `push` a `main` (o tag `v*`, o manual). Construye la imagen Docker multi-stage y la publica en `ghcr.io/jezer10/koom-calls-server` con tags `latest`, `main-<sha>`, semver.
- **`deploy-vps.yml`** — se dispara tras la publicación exitosa (o manual). Hace SSH a la VPS, hace `docker pull`, recrea el contenedor `koom-calls-server` con `--restart unless-stopped` y health check.

## Secrets requeridos (GitHub repo → Settings → Secrets and variables → Actions)

| Secret | Requerido para | Ejemplo |
|---|---|---|
| `VPS_HOST` | deploy | `203.0.113.10` o `vps.example.com` |
| `VPS_USER` | deploy | `deploy` |
| `VPS_SSH_KEY` | deploy | clave privada OpenSSH (la pública en `~/.ssh/authorized_keys` de la VPS) |
| `VPS_PORT` | deploy (opcional) | `22` (default) |
| `VPS_DEPLOY_DIR_BACK` | deploy (opcional) | `~/koom-calls-server` (default) |

`GITHUB_TOKEN` lo provee GitHub Actions automáticamente (con permisos de `packages: write` para publicar en GHCR).

## Setup en la VPS

```bash
# 1. Crear directorio de deploy
mkdir -p ~/koom-calls-server && cd ~/koom-calls-server

# 2. Crear .env a partir del template del repo
# (ver back/.env.example.docker — JWT_SECRET, TURN_*, DATABASE_URL, etc.)

# 3. Verificar que docker está instalado
docker --version

# 4. La red koom-net se crea automáticamente en el primer deploy

# 5. (Opcional) Pruebe manual antes del primer deploy:
docker pull ghcr.io/jezer10/koom-calls-server:latest
docker run -d --name koom-calls-server --env-file .env -p 8080:8080 ghcr.io/jezer10/koom-calls-server:latest
curl http://localhost:8080/health
```

## Disparar deploy manual

1. Repo → Actions → "Deploy to VPS" → Run workflow.
2. Tag opcional: `latest` (default), `main-abc1234`, o un tag semver.

## Rollback

Desde la VPS, ejecuta un deploy con un tag anterior:

```bash
# O vía la UI de GitHub Actions: Run workflow con tag=main-<sha-anterior>
```

O manual:

```bash
ssh deploy@VPS_HOST
docker pull ghcr.io/jezer10/koom-calls-server:main-<sha-anterior>
docker rm -f koom-calls-server
docker run -d --name koom-calls-server --env-file ~/koom-calls-server/.env -p 8080:8080 \
  ghcr.io/jezer10/koom-calls-server:main-<sha-anterior>
```
