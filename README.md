# Koom Calls Backend

Backend de llamadas en tiempo real sobre NestJS. Expone HTTP + Socket.IO, usa
Postgres como base obligatoria y puede integrarse con Redis, LiveKit y TURN.

## Requisitos

- Node 22+
- `pnpm` vía Corepack
- Docker Engine + Compose plugin para los flujos Docker

## Qué necesita realmente la app

- `Postgres` es obligatorio.
- `Redis` es opcional. Si falta o no responde al arrancar, la app usa fallback
  a memoria para presencia y para el adapter de Socket.IO.
- `LiveKit` y `TURN` no son obligatorios para boot, pero sí para una
  experiencia completa de llamadas WebRTC.

La validación de variables vive en `src/config/env.schema.ts` y usa `Joi` vía
`ConfigModule`.

## Variables de entorno

Usa un único example:

```bash
cp .env.example .env
```

`DATABASE_URL` es obligatoria. El resto depende del flujo:

- desarrollo local: `DATABASE_URL`, y opcionalmente `REDIS_URL`,
  `LIVEKIT_*`, `TURN_*`
- stack Docker completo: el compose sobreescribe internamente los hostnames de
  `postgres`, `redis` y `livekit`, así que se reutiliza el mismo `.env`

Variables importantes:

- `DATABASE_URL`: URL Postgres obligatoria
- `REDIS_URL`: opcional
- `JWT_SECRET`: obligatorio en producción
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
  `FRONTEND_ORIGIN`: requeridas en producción para Google OAuth
- `TURN_URL`, `TURN_SHARED_SECRET`: requeridas en producción
- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`: necesarias para SFU real

## Desarrollo local

1. Crear `.env` desde el example:

```bash
cp .env.example .env
```

2. Levantar dependencias locales:

```bash
docker compose -f docker-compose.dev.yml up -d
```

3. Instalar dependencias del backend:

```bash
corepack enable
pnpm install
```

4. Iniciar la API:

```bash
pnpm run start:dev
```

Con este flujo, el backend espera por defecto:

- Postgres en `localhost:5432`
- Redis en `localhost:6379`
- LiveKit en `localhost:7880`
- TURN en `localhost:3478`

## Stack Docker completo

Si quieres levantar el stack completo del backend dentro de Docker:

```bash
cp .env.example .env
docker compose up -d --build
```

Este flujo usa `docker-compose.yml` y está orientado a un servidor simple:

- la API corre en contenedor con `NODE_ENV=production`
- `api` y `livekit` se conectan también a `npm-proxy`
- `postgres` y `redis` quedan solo en la red interna del compose
- el `livekit` incluido corre en modo `--dev`, así que la API usa internamente
  `devkey/secret` dentro de ese stack

Si `npm-proxy` no existe en tu host, crea esa red antes de levantar el stack o
ajusta el compose para tu entorno.

## Comandos útiles

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
