# CI/CD

> **Documentación completa:** ver [`docs/CI-CD.md`](../../docs/CI-CD.md) en la raíz del repo.
> Incluye: visión general, secrets, setup en VPS, procedimiento de release,
> rollback, troubleshooting, y descripción de cada workflow.

## Resumen

- **`docker-publish.yml`** — push a `main` (o tag `v*`, o manual). Build multi-arch → `ghcr.io/jezer10/koom-calls-server`.
- **`deploy-vps.yml`** — tras publish. SSH a VPS, pull, restart con `--restart unless-stopped` y health check.
- Triggers: `push` a `main` o `workflow_dispatch` (manual).
