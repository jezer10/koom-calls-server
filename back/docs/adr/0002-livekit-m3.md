# ADR-0002: LiveKit as the M3 SFU provider

- Status: Accepted
- Date: 2026-06-08
- Deciders: Koom backend (LBR-73, CALL-008)
- Related: LBR-66 (webrtc-multiusuario-control-plane), LBR-74 (TURN / webhooks)

## Context

Koom's call model needs a Selective Forwarding Unit (SFU) to support
multi-party audio/video. M1 lays down the NestJS control plane and the
`MediaProvider` interface; M3 wires the real SFU behind that interface.
LBR-66 selected LiveKit as the SFU. This ADR records the integration
choices that the LiveKit `MediaProvider` implementation makes on top of
that high-level decision.

## Decision

We integrate LiveKit through the official `livekit-server-sdk` Node
package and expose it through a NestJS `@Global()` module that registers
the `MEDIA_PROVIDER` token. The module selects the implementation at
boot:

- If `LIVEKIT_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` are all
  set, it instantiates `LiveKitMediaProvider` using a real
  `RoomServiceClient` and an `AccessToken` issuer.
- Otherwise it falls back to `NoopMediaProvider`, which returns
  deterministic fake values. A warning is logged at boot so operators
  can notice the missing configuration.

### Mapping the interface to LiveKit

- `createRoom(callId)` calls `RoomServiceClient.createRoom({ name })`
  with `roomName = "koom-call-" + callId`. The `providerRoomId` returned
  to callers is the room `sid` if present, otherwise the deterministic
  name. This is a one-shot room create; LiveKit auto-creates on first
  join, so the call is mostly an opportunity to pre-set metadata or
  participant limits later.
- `deleteRoom(callId)` calls `RoomServiceClient.deleteRoom(roomName)`.
- `createAccessToken({ userId, callId, role, ttlSeconds })` builds an
  `AccessToken` with the caller's `userId` as identity and a default
  TTL of one hour, then attaches a `VideoGrant` for the
  `koom-call-${callId}` room with `roomJoin`, `canPublish`,
  `canSubscribe` and `canPublishData` set. The role is mapped as
  follows:
  - `participant` — base grant only.
  - `host` — base grant plus `roomAdmin`.
  - `moderator` — base grant plus `roomAdmin` and an empty
    `canPublishSources` allow-list (moderators can be locked down to
    specific sources via the API; the empty list is the conservative
    default that we will tune in LBR-74).

  The returned object is `{ token, url: livekitUrl, expiresAt }`. The
  `url` is the configured `LIVEKIT_URL` (an `wss://` host).

### Webhook validation

`MediaProvider.validateWebhook` is declared as a synchronous
`(payload, signature) => boolean` on the M1 interface. The LiveKit
`WebhookReceiver` from `livekit-server-sdk` is async-only. We
deliberately keep the synchronous signature stable for M1/M3 consumers
and have `LiveKitMediaProvider.validateWebhook` return `false` with a
`TODO(LBR-74)` marker, instead of lying about a successful
verification. LBR-74 owns TURN/webhook wiring and will either widen
the interface to `Promise<boolean>` or add a separate async method.

### Environment

Three env vars are required to switch to the real provider:

```
LIVEKIT_URL=wss://<your-livekit-host>
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

These are read inside `MediaProviderModule` only; we do not push them
into the global `AppConfig` because they belong to a single feature
slice (the SFU).

## Consequences

Positive:

- The M1 placeholder and the M3 real implementation are swapped
  purely by env vars, with no module-level code changes.
- The Noop fallback keeps local development and CI working without a
  LiveKit instance, and the warning makes the misconfiguration loud.
- Deterministic room names (`koom-call-${callId}`) make it trivial to
  correlate server logs and LiveKit dashboards.
- Tokens carry the call id and role in a way LiveKit can reason about
  (`room` and `roomAdmin`) without us having to store extra metadata
  in the SDK.

Negative / trade-offs:

- Webhook validation is currently a stub. Until LBR-74 lands we cannot
  accept LiveKit webhooks server-side; the cost is low because the
  NestJS control plane already drives room lifecycle on demand, but
  any LiveKit-side events (recording, egress, participant left) will
  be invisible until then.
- Role-to-grant mapping is conservative; `moderator` uses an empty
  `canPublishSources` which means they currently cannot publish until
  LBR-74 re-tunes that. If a moderator needs to publish in M3, lift
  that constraint in LBR-74.
- We depend on the third-party `livekit-server-sdk` and on LiveKit
  Cloud or a self-hosted LiveKit deployment being reachable.

## Alternatives considered

- **Pion (self-hosted, Go)** — would have removed the third-party
  hosted dependency, but the M3 timeline is too tight to operate the
  Go side in parallel. LiveKit gives us a managed option.
- **mediasoup** — lower level and more flexible, but every API we need
  (room lifecycle, JWT issuance, webhooks) would have to be
  hand-rolled.
- **Build directly against `livekit-server-sdk` without a thin client
  factory** — rejected; a `livekit.client.ts` factory keeps the SDK
  shape behind one seam so we can upgrade or replace it without
  touching `LiveKitMediaProvider`.
