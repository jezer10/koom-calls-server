# ADR 0001 — Arquitectura WebRTC multiusuario: control plane NestJS + SFU LiveKit

- **Estado:** Aceptado
- **Fecha:** 2026-06-08 (última revisión: 2026-06-09)
- **Ticket:** LBR-66 (CALL-001)
- **Autores:** Plataforma Koom
- **Relacionado:** LBR-68 (TypeORM/SQLite), LBR-69 (máquina de estados y JWT)

> Este ADR describe la arquitectura vigente del backend de Koom Calls.
> Históricamente (M0) el proyecto usó un broker PeerJS embebido como plano
> de señalización y medios; ese camino fue retirado en M3 y todas las
> referencias a `peerjs` / `peer-server` / `PEER_*` se han eliminado del
> código, de la configuración y de los despliegues.

## Contexto

Koom ofrece un producto de videollamadas multiusuario. El reto es servir
salas de 1–10 participantes en M1, con crecimiento a M2–M4 (presencia,
notificaciones, observabilidad) sin reescribir la base en cada hito. Las
arquitecturas candidatas deben cumplir cuatro propiedades no negociables:

1. **Calidad consistente** por encima de 3–4 participantes (no degradar
   CPU/ancho de banda del navegador como lo hace una topología mesh P2P).
2. **Identidad unificada** con el sistema Koom: la sala y los medios deben
   pasar por un JWT de corta duración emitido por la API, no por un broker
   público.
3. **Estado durable y observable**: salas, claims y eventos persisten; el
   ciclo de vida de la llamada es medible.
4. **Escalado horizontal** del plano de medios independiente del plano de
   control.

Una arquitectura basada exclusivamente en `socket.io-client` no cumple (1)
y (4): P2P mesh no escala más allá de 3–4 pares, y los medios viven en el
cliente. Un broker de señalización público (estilo PeerJS Cloud) no cumple
(2): el broker no valida al usuario contra Koom y la autenticación queda
delegada en un tercero fuera de nuestro control.

## Decisión

Adoptamos una arquitectura con **plano de control** NestJS y **plano de
medios SFU** LiveKit, apoyados en Redis (pub/sub, presencia, cache de
turnos) y Postgres/SQLite para M1, con coturn como TURN compartido. La
señalización WebRTC de cliente a SFU la realiza LiveKit Cloud o
self-hosted (decisión por entorno), y nuestro NestJS es la **única
autoridad** para autenticación, ciclo de vida de la sala, claims y
notificaciones.

### Componentes

| Componente             | Rol                                                                                    | Entorno                                        |
| ---------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **NestJS 11**          | Plano de control: HTTP, WebSocket de señalización, máquina de estados, JWT.            | Railway, multi-instancia                       |
| **LiveKit (SFU)**      | Plano de medios: server WebRTC, simulcast, server-side recording, egress.              | LiveKit Cloud en staging; self-hostable en M3+ |
| **coturn**             | Servidor TURN/STUN compartido para NAT simétrico.                                      | Railway/VM dedicado                            |
| **Redis**              | Pub/sub entre instancias Nest, presence/online, cache de credenciales TURN efímeras.   | Upstash en dev/staging; self-hosted en prod    |
| **Postgres / SQLite**  | Persistencia de usuarios, salas, claims, eventos, auditoría.                           | SQLite in-memory en M1; Postgres desde M2      |
| **SPA cliente (web)**  | Browser SDK: `livekit-client` para medios + Socket.IO cliente para señalización Koom.  | Build estática, misma que ya existe            |

### Topología lógica

```
         ┌─────────────────┐                ┌──────────────────┐
         │  SPA cliente A  │                │  SPA cliente B   │
         └────────┬────────┘                └────────┬─────────┘
                  │                                  │
    signaling  ▲  │                          ▲       │ signaling
    (WS+REST)  │  │ medios (SRTP/WebRTC)     │       │
               │  ▼                          │       ▼
         ┌─────┴────────────────┐    ┌───────┴────────────────┐
         │   NestJS (control)   │    │     LiveKit (SFU)      │
         │   - HTTP REST        │◄──►│   - WebRTC fan-out     │
         │   - WS /signaling    │    │   - simulcast/egress   │
         │   - state machine    │    │                        │
         │   - JWT mint/verify  │    │                        │
         └────────┬─────────────┘    └────────┬───────────────┘
                  │                           │
         ┌────────┴───────┐            ┌──────┴───────┐
         │ Postgres/SQLite│            │   Redis      │
         └────────────────┘            └──────────────┘
                                             ▲
                                   ┌─────────┴──────────┐
                                   │       coturn       │
                                   │ (TURN/STUN)        │
                                   └────────────────────┘
```

### Reglas de la arquitectura

1. **NestJS es la única fuente de verdad para identidad.** Emite un JWT de
   corta duración (claim `sub`, `room`, `role`) que el cliente canjea
   ante LiveKit por un token de medios firmado por el SDK de LiveKit. La
   SPA nunca recibe credenciales de LiveKit directamente desde el cliente.
2. **La máquina de estados de la sala vive en Nest.** Estados canónicos
   `idle → ringing → active → ended` (extensibles). Las transiciones son
   idempotentes y registradas en persistencia.
3. **Señalización de negocio** (join, leave, mute, raise-hand, kick) viaja
   por Socket.IO namespace `/signaling`. **Medios** (audio/video/data
   channel) viajan siempre a/desde LiveKit. **No** se reusan DataChannels
   ad-hoc ni librerías de plano-medio en cliente: el SDK de LiveKit es la
   única vía para mover audio/video.
4. **TURN** se sirve vía coturn con autenticación de tiempo limitado
   (REST API `TURN_URL` + `TURN_SHARED_SECRET`, `TURN_TTL`). Las
   credenciales efímeras se firman en Nest y se entregan al cliente en el
   handshake `room:join`.
5. **Persistencia.** En M1 se usa SQLite in-memory para acelerar el
   desarrollo; desde M2 Postgres con migraciones TypeORM (LBR-68). La
   elección de driver es transparente para el resto de módulos.
6. **Plano de medios intercambiable.** LiveKit es la decisión de M2, pero
   la interfaz `MediaProvider` (a entregar en M3) aísla a Nest del SDK
   concreto para que podamos evolucionar (mediasoup, janus) sin tocar el
   control plane.
7. **Observabilidad mínima desde M1.** Logs estructurados, métricas HTTP y
   WS, y eventos de dominio (`call.started`, `call.ended`) emitidos a
   Redis para que un consumidor externo los observe sin re-deployar.

### Hitos del producto (LBR-66/68/69)

- **LBR-66 — ADR + contrato de configuración.** Este documento y el
  esquema `env.schema.ts` con `zod`. Fija la superficie de variables y
  el shape de `AppConfig.env`. Las variables retiradas del flujo legacy
  (PeerJS) ya no aparecen en el validador.
- **LBR-68 — Persistencia con TypeORM (M1).** Entidades `User`, `Room`,
  `Call`, `Participant`, migraciones, repos. SQLite en dev, Postgres en
  staging/prod.
- **LBR-69 — Máquina de estados, controller y JWT (M1).** Implementa el
  ciclo de vida de la sala, emite tokens de acceso a LiveKit, expone
  `POST /rooms` y `GET /rooms/:id`. La señalización de negocio llega
  por `/signaling`.

Los hitos M2 (LiveKit real, presencia), M3 (MediaProvider, notifications)
y M4 (observability) se detallan en futuros ADRs.

## Consecuencias

### Positivas

- **Escalado real.** El plano de medios escala horizontalmente vía SFU
  sin tocar Nest. Nest escala stateless detrás de Redis.
- **Calidad consistente.** Simulcast, bandwidth estimation y server-side
  recording son provistos por LiveKit en lugar de pelear con mesh.
- **Modelo de seguridad unificado.** Un solo JWT canjeado por tokens de
  medios. No hay broker de señalización externo en la ruta crítica.
- **Persistencia y observabilidad desde M1.** Salas y eventos viven en
  base de datos, no en memoria.
- **Ruta de evolución clara.** La interfaz `MediaProvider` permite
  cambiar de SFU sin reescribir el control plane.

### Negativas / Riesgos

- **Dependencia externa (LiveKit Cloud) en staging.** Costo recurrente y
  dependencia de un proveedor. Mitigación: el SFU es self-hostable y la
  abstracción `MediaProvider` aísla el cambio.
- **Dos SDKs en cliente** (`socket.io-client` + `livekit-client`). Mayor
  bundle. Mitigación: code-splitting por ruta y lazy load del SDK de
  medios.
- **Operación adicional** (Redis, coturn, potencialmente LiveKit
  self-host). Mitigación: en M1 sólo Redis es necesario; coturn llega
  con M2. Se documenta en `docs/adr/` y en el runbook.
- **Más configuración.** El archivo `.env.example` crece. Se compensa
  con el validador `zod` (LBR-66) que detecta errores en boot.

### Neutras / de operación

- Se introduce `zod` como dependencia de runtime para validación de
  configuración. No se añade `class-validator` (decisión de scope).
- El contrato `AppConfig` se amplía con un campo `env: ParsedEnv`. Esto
  es retrocompatible: los campos existentes (`httpPort`,
  `signaling.*`) no cambian de forma. El bloque `peer.*` fue retirado
  junto con el broker PeerJS (M3).

## Alternativas consideradas

### 1. Mesh P2P + broker de señalización (estilo PeerJS, descartado)

- **A favor:** Mínima infraestructura; funciona 1-a-1; iteración
  rápida en M0.
- **A favor:** Iteración rápida; stack conocido.
- **En contra:** No escala más allá de 3–4 participantes; broker sin
  autenticación contra el sistema de identidad Koom; sin persistencia;
  sin TURN provisionado; dos planos de señalización.
- **Veredicto:** Insuficiente para M1+. Retirado en M3. Mantenido
  brevemente como `enablePeerServer` opt-in durante la migración y
  eliminado en este ADR.

### 2. mediasoup (SFU programable en Node/C++)

- **A favor:** Open source, sin dependencia de proveedor, granularidad
  total sobre el SFU, modelo de router/transport maduro.
- **En contra:** Curva de operación alta (workers, balanceo, egress
  propio), requiere trabajo de integración significativo (auth, recording,
  simulcast), retrasa M2 al menos un trimestre, equipo pequeño.
- **Veredicto:** Mantenido como **opción de escape en M3+** detrás de la
  interfaz `MediaProvider`. No elegido para M1–M2 por costo de
  time-to-market.

### 3. Jitsi Meet (full-stack)

- **A favor:** Producto maduro, incluye señalización, SFU (jvb), TURN
  (jitsi-meet-turn), grabación; open source; self-hostable.
- **En contra:** Acoplamiento alto con su propio stack (Prosody, XMPP,
  jigasi, OTel), modelo de autenticación externo difícil de alinear con
  la identidad Koom, difícil de evolucionar fuera del roadmap de
  Jitsi, y de gran superficie para personalizar UI/UX.
- **Veredicto:** Interesante como referencia de features pero no se
  adapta a la necesidad de Koom de tener un control plane Nest como
  autoridad de identidad y lifecycle. Descartado.

### 4. LiveKit (decidido)

- **A favor:** SDK moderno, simulcast y server-side recording de fábrica,
  modelo de tokens de medios firmado por nuestro backend encaja
  exactamente con el JWT de Nest, Cloud disponible para iterar rápido y
  self-hostable para producción, comunidad activa, licencia Apache 2.0.
- **En contra:** Dependencia externa mientras se use Cloud; dos SDKs en
  cliente.
- **Veredicto:** Adoptado. La decisión queda aislada detrás de
  `MediaProvider` para que mediasoup siga siendo viable si cambian las
  prioridades.

## Diagrama de componentes

```
+----------------------------------------------------------------+
|                       SPA cliente (web)                        |
|                                                                |
|   socket.io-client  ─────►  /signaling  (negocio)             |
|   livekit-client    ─────►  LiveKit     (medios)               |
+----------------------------------------------------------------+
             │                                │
             │ WS + REST                      │ SRTP/DTLS
             ▼                                ▼
+-----------------------------+    +-----------------------------+
|   NestJS (control plane)    |    |   LiveKit (SFU, medios)     |
|                             |    |                             |
|  - AppModule                |    |  - WebRTC fan-out           |
|  - SignalingModule  (/sig)  |    |  - simulcast                |
|  - CallsModule      (REST)  |    |  - server-side recording    |
|  - ParticipantsModule       |    |                             |
|  - AuthModule       (JWT)   |    |                             |
|  - PresenceModule    (WS)   |    |                             |
|  - NotificationsModule      |    |                             |
|  - ObservabilityModule      |    |                             |
|  - PersistenceModule (DB)   |    |                             |
|  - MediaProvider  (tokens)  |◄──►|  (token mint, webhooks)     |
+-----------------------------+    +-----------------------------+
             │           ▲                          ▲
             ▼           │ pub/sub                  │ TURN/STUN
+----------------+  +-------------+         +---------------+
|  Postgres/     |  |   Redis     |         |    coturn     |
|  SQLite        |  |  pub/sub +  |         | (auth efímera)|
|  (TypeORM)     |  |  presence + |         +---------------+
|                |  |  cache      |
+----------------+  +-------------+
```

### Notas de implementación inmediata

- El módulo `SignalingModule` (ya existente en M0) sobrevive como
  canal de señalización de negocio. Su namespace pasa a `/signaling` y
  su gateway entiende el nuevo modelo de eventos (`room:join`,
  `room:leave`, `participant:update`).
- `AppConfig` extiende con un campo `env: ParsedEnv` poblado por
  `parseEnv(process.env)` en el boot. `parseEnv` valida con `zod` y,
  en desarrollo, auto-genera un `JWT_SECRET` emitiendo un warning.
- El validador `env.schema.ts` ya no expone variables del flujo legacy
  (PeerJS). Cualquier despliegue que aún las enviaba debe eliminarlas
  del `.env` (serán ignoradas por el validador gracias a `passthrough`,
  pero se consideran obsoletas).
