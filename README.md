# Koom Calls Backend

Backend de llamadas en tiempo real sobre NestJS. Expone HTTP + Socket.IO, usa
Postgres como base obligatoria y puede integrarse con LiveKit, TURN y Redis.

## Requisitos

- Node 22+
- `pnpm` vía Corepack
- Postgres disponible
- Redis opcional
- LiveKit y TURN opcionales para llamadas reales

## Arranque local

1. Crear el archivo de entorno:

```bash
cp .env.example .env
```

2. Instalar dependencias:

```bash
corepack enable
pnpm install
```

3. Levantar los servicios de soporte.

Opción rápida con Docker:

```bash
cp .env.example.docker .env
docker compose up --build
```

Opción manual:

- levantar Postgres y apuntar `DATABASE_URL`
- opcionalmente levantar Redis y apuntar `REDIS_URL`
- opcionalmente configurar LiveKit y TURN

4. Iniciar el backend:

```bash
pnpm run start:dev
```

## Qué necesita realmente la app

- `Postgres` es obligatorio.
- `Redis` es opcional. Si falta o no responde al arrancar, la app usa fallback
  a memoria para presencia y para el adapter de Socket.IO.
- `LiveKit` y `TURN` no son obligatorios para boot, pero sí para una
  experiencia completa de llamadas WebRTC.

## Variables principales

- `DATABASE_URL`: URL Postgres obligatoria.
- `REDIS_URL`: opcional.
- `JWT_SECRET`: obligatorio en producción.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
  `FRONTEND_ORIGIN`: requeridas en producción para Google OAuth.
- `TURN_URL`, `TURN_SHARED_SECRET`: requeridas en producción.
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: necesarias para SFU real.

La validación vive en `src/config/env.schema.ts` y usa `Joi` vía
`ConfigModule`.

## Comandos

```bash
pnpm run build
pnpm run start:dev
pnpm test
pnpm run test:e2e
pnpm run smoke
```

## Documentación adicional

- Arquitectura: `docs/adr/0001-webrtc-multiusuario-control-plane.md`
- Despliegue / CI-CD: `docs/CI-CD.md`
- Compose local detallado: `docker-compose.README.md`
