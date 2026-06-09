# koom-calls-server

NestJS signaling backend for the koom calls project. This document is the
backend-specific guide; the rest of the project (frontend, infra) lives in
sibling directories.

## Horizontal scaling (WebSocket)

Socket.IO emits are scoped to the Node process that owns the connection.
When the signaling server runs as more than one instance behind a load
balancer, a `broadcast` from instance A is not seen by clients connected to
instance B unless the servers share state. The fix is the official
Socket.IO Redis adapter.

This server ships a `SocketIoRedisAdapter` (in
`src/signaling/socket-io-redis.adapter.ts`) that wires the
`@socket.io/redis-adapter` package on top of the default `IoAdapter`.

### Enabling the adapter

The adapter is enabled by setting a single environment variable:

```bash
export REDIS_URL=redis://localhost:6379
npm run start:prod
```

When `REDIS_URL` is **not** set, the adapter is a no-op: the server is
created exactly as before, with the default in-process adapter. This
keeps local development and single-instance deployments dependency-free.

### What the adapter does

- Constructs two `ioredis` clients against `REDIS_URL`:
  - a **pub** client used by Socket.IO to publish broadcast events;
  - a **sub** client used to receive broadcasts from peer instances.
  The two clients are **never shared**: the sub client is a
  `.duplicate()` of the pub client, so it is an independent connection
  and never tries to issue normal commands while in subscribe mode.
- Attaches the official adapter to the underlying Socket.IO server via
  `server.adapter(...)`, so room/namespace broadcasts are mirrored
  across every NestJS instance pointed at the same Redis.

### Local test with two instances

1. Start a local Redis (any flavor; `redis://localhost:6379` is enough).
2. Boot two instances on different HTTP ports, both pointing at the same
   Redis:

   ```bash
   # terminal 1
   PORT=8080 REDIS_URL=redis://localhost:6379 npm run start:prod

   # terminal 2
   PORT=8081 REDIS_URL=redis://localhost:6379 npm run start:prod
   ```

3. Open a browser tab to `http://localhost:8080` and another to
   `http://localhost:8081`, both joining the same room. A `broadcast`
   emitted on instance 8080 should reach the socket on instance 8081.
4. Stop one instance; clients on the other keep working. Restart it; the
   two instances re-sync their room state on the next broadcast.

### Notes

- `REDIS_URL` accepts any connection string `ioredis` understands, e.g.
  `rediss://...` for TLS or `redis://user:pass@host:6379/0`.
