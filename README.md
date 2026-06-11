<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

Koom Calls backend: NestJS control plane + LiveKit SFU + Redis + coturn.
See [docs/adr/0001-webrtc-multiusuario-control-plane.md](docs/adr/0001-webrtc-multiusuario-control-plane.md)
for the architecture decision record that drives this project.

## Configuration

All runtime configuration comes from environment variables. Copy
[`.env.example`](.env.example) to `.env` and fill in the values for your
environment. The schema is validated at boot by
`src/config/env.schema.ts` (zod); invalid combinations fail fast with a
descriptive error.

### Required in production

| Variable       | Description                                              |
| -------------- | -------------------------------------------------------- |
| `JWT_SECRET`   | Secret used to sign access tokens.                       |
| `NODE_ENV`     | Must be `production` in production deployments.         |

### Optional / feature-gated

| Variable                 | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| `PORT`                   | HTTP port (default `8080`).                               |
| `CORS_ORIGIN`            | CORS origin, `*` or comma-separated list (default `*`).   |
| `SIGNALING_NAMESPACE`    | Socket.IO namespace (default `/signaling`).               |
| `DATABASE_URL`           | TypeORM/DB URL (default `sqlite::memory:`).                |
| `JWT_TTL`                | Access-token TTL (default `1h`).                          |
| `LIVEKIT_URL`            | LiveKit server URL, enables SFU token minting when set.   |
| `LIVEKIT_API_KEY`        | LiveKit API key.                                          |
| `LIVEKIT_API_SECRET`     | LiveKit API secret.                                       |
| `REDIS_URL`              | Redis URL for pub/sub and presence.                       |
| `TURN_URL`               | coturn URL for short-lived TURN credentials.              |
| `TURN_SHARED_SECRET`     | Shared secret to sign TURN credentials.                   |
| `TURN_TTL`               | TURN credential TTL in seconds (default `3600`).          |


## Project setup

This repo uses **pnpm@10.34.1** (pinned via `packageManager`).
Use [Corepack](https://nodejs.org/api/corepack.html) to install the
right version automatically:

```bash
$ corepack enable
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov

# end-to-end smoke (requires the docker stack + JWT_SECRET in .env)
$ pnpm run smoke
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Authentication

The auth flow is **Authorization Code with popup**. The front opens a
popup pointing at `/auth/google/start`, Google redirects the popup to
`/auth/google/callback`, the back exchanges the `code` for an
`id_token`, verifies it, upserts the user, signs our session JWT, and
the callback page posts a `message` to the opener with the token. The
back also sets an `httpOnly Secure` cookie carrying the same JWT so
subsequent navigations stay signed in.

### Endpoints

| Method | Path                       | Auth         | Notes |
|--------|----------------------------|--------------|-------|
| `GET`  | `/auth/providers`          | none         | Lists configured providers with `startUrl`. |
| `GET`  | `/auth/google/start`       | none         | Sets `oauth_state` + `oauth_returnto` cookies, 302 to Google. Throttled 10/min. |
| `GET`  | `/auth/google/callback`    | none         | Validates state, exchanges code, sets `koom_session` cookie, serves HTML with `postMessage` to opener. |
| `POST` | `/auth/anonymous/login`    | none (dev)   | Creates a transient user, sets `koom_session` cookie. Throttled 10/min. |
| `POST` | `/auth/logout`             | JWT (cookie) | Clears `koom_session` cookie. |
| `GET`  | `/auth/me`                 | JWT (cookie) | Returns the current user profile. |
| `GET`  | `/auth/ws-token`           | JWT (cookie) | Issues a 60-second single-use JWT for the WS handshake. |

### Why this shape

- **Popup** keeps the user in the same tab — the page that opened the
  popup is still mounted and can react to the `postMessage` event.
- **All OAuth logic lives in the back** (URL build, state validation,
  code exchange, token verify, session sign, cookie set). The front
  only opens the popup and listens for the message.
- **`postMessage` is targeted**: the callback HTML uses
  `window.opener.postMessage(data, FRONTEND_ORIGIN)`. The front
  validates `event.origin === VITE_FRONTEND_ORIGIN` before accepting.
- **`httpOnly Secure SameSite=Lax` cookie** keeps the session token
  out of JS reach (XSS-resistant). `SameSite=Lax` allows the cookie
  to be sent on Google's top-level redirect into the callback.
- **`ws-token` is single-use** because `socket.io-client` cannot read
  httpOnly cookies; the front requests a short-lived JWT, passes it
  in the WS `auth` handshake, and the back marks it consumed. Replay
  is impossible.

### Google OAuth setup

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an OAuth client of type **Web application**.
3. Under **Authorized JavaScript origins**, add:
   - Dev: `http://localhost:5173` (Vite default).
   - Prod: the exact origin where the front-end is served, including
     scheme (`https://app.example.com`). HTTPS is required for
     production.
4. Under **Authorized redirect URIs**, add:
   - Dev: `http://localhost:8080/auth/google/callback`.
   - Prod: `https://api.example.com/auth/google/callback`.
5. Copy the **Client ID** and **Client secret** and set on the back:
   ```
   GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:8080/auth/google/callback
   FRONTEND_ORIGIN=http://localhost:5173
   ```
6. The front only needs `VITE_FRONTEND_ORIGIN` (for `postMessage`
   origin validation).

When `GOOGLE_CLIENT_ID` is missing in dev, the server boots and
`/auth/providers` omits `google`. In production the env schema fails
the boot with a clear error if it's missing or if
`GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `FRONTEND_ORIGIN`
are unset.

### Security notes

- The `id_token` returned by Google's `code` exchange is verified with
  [`google-auth-library`](https://www.npmjs.com/package/google-auth-library)
  using `audience: GOOGLE_CLIENT_ID`. The library fetches and caches
  Google's public keys, validates the signature, `iss`, and `exp`.
- We additionally enforce:
  - `iss` is `https://accounts.google.com` or `accounts.google.com`.
  - `aud` matches `GOOGLE_CLIENT_ID`.
  - `sub` is non-empty (used as the stable user identifier).
  - `email_verified` is `true`.
  - `exp` is not in the past (defensive; the lib already enforces it).
- The `state` parameter is generated with `crypto.getRandomValues(32)`
  and stored in a `httpOnly SameSite=Lax` cookie scoped to
  `/auth/google`. The callback reads it and compares to the `state`
  query string. Mismatches return 400 and an `oauth-error` postMessage.
- The `returnTo` path is validated to start with `/` (no protocol-
  relative `//`) and ≤ 2048 chars to prevent open-redirect.
- Login events are logged through `AuthAuditLogger` with PII redacted
  (`email`, `sub`, `name`, `picture`, `idToken`, `token`,
  `authorization`).
- The session JWT is delivered as `httpOnly Secure SameSite=Lax`
  cookie (`koom_session`, 1h). The back also posts it to the
  front via `postMessage` for the popup flow; the front caches it
  in `sessionStorage` (not `localStorage`) to limit XSS exposure.
- `anonymous` login is gated by `AUTH_ANONYMOUS_LOGIN_ENABLED`.
  Default: `true` in development, `false` in production. The endpoint
  returns 404 when disabled, never 401.
- `CORS_ORIGIN=*` is rejected in production by the env schema. Set
  the front-end origin explicitly.
- HTTPS is mandatory in production: Google refuses to authorize
  non-HTTPS origins (except `localhost`), and the `Secure` cookie
  flag requires it.
- The WS single-use token is stored in-memory. In a multi-instance
  deployment, switch `WsTokenService.used` to Redis (TODO).

### Adding more providers

The `OAuthProvider` interface in
`src/auth/providers/oauth-provider.interface.ts` is the contract:

```ts
export interface OAuthProvider {
  readonly meta: OAuthProviderMeta;
  buildAuthorizationUrl(state: string): string;
  exchangeAndVerify(code: string): Promise<OAuthProfile>;
}
```

To add GitHub, Microsoft, etc.:

1. Create `src/auth/providers/<name>/<name>.service.ts` implementing
   `OAuthProvider`. `buildAuthorizationUrl` returns the provider's
   authorize URL with `state` and `redirect_uri`. `exchangeAndVerify`
   exchanges the code (typically via the provider's SDK or a direct
   POST to their token endpoint) and returns a normalized profile.
2. In `onModuleInit`, read the provider's env vars and set
   `meta.enabled = true` only when configured.
3. Add the provider to the `OAUTH_PROVIDERS` factory in
   `src/auth/auth.module.ts`.
4. Add `@Get('<name>/start')` and `@Get('<name>/callback')` handlers
   in `AuthController` (mirror the Google ones).

No changes to `AuthService`, `UsersRepository`, or the migration are
required. Users are uniquely identified by `(provider, providerSub)`.

## TURN (coturn) credentials

The server exposes a JWT-protected endpoint that mints short-lived TURN
credentials for WebRTC clients, using the
[coturn "REST API for Access to TURN Services"](https://github.com/coturn/coturn/blob/master/turndb/schema.sql)
time-limited credentials pattern. Clients call `GET /turn/credentials` with a
bearer token, and the response is ready to be plugged into an
`RTCPeerConnection`'s `iceServers` list.

### Environment variables

| Variable               | Required                   | Default                       | Description                                                            |
| ---------------------- | -------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `TURN_URL`             | yes                        | —                             | Public TURN URL, e.g. `turn:turn.example.com:3478`.                    |
| `TURN_SHARED_SECRET`   | yes (production)           | `dev-turn-secret` in dev      | Shared secret configured in `coturn` (`static-auth-secret`).           |
| `TURN_TTL`             | no                         | `3600`                        | Lifetime of each credential, in seconds.                               |
| `TURN_REALM`           | no                         | `koom.local`                  | Realm reported by coturn (informational, embedded in URLs).            |
| `TURN_STUN_URLS`       | no                         | `stun:stun.l.google.com:19302` | Comma-separated list of STUN URLs to prepend to `iceServers`.        |
| `JWT_SECRET`           | yes (production)           | `dev-jwt-secret` in dev       | HS256 secret used by the JWT strategy.                                 |
| `JWT_AUDIENCE`         | no                         | unset                         | Optional `aud` claim enforced by the strategy.                         |
| `JWT_ISSUER`           | no                         | unset                         | Optional `iss` claim enforced by the strategy.                         |

The default Google STUN server is fine for development but should be replaced
with your own STUN/TURN infrastructure in production.

### Algorithm

For each request the server computes:

```
expiry    = floor(now / 1000) + TURN_TTL
username  = "{expiry}:{userId}"          # coturn expects this exact format
password  = base64( HMAC_SHA1(TURN_SHARED_SECRET, username) )
```

The credential is therefore short-lived: coturn accepts it only while
`expiry` is in the future.

### Endpoint

`GET /turn/credentials` (Authorization: `Bearer <jwt>`)

```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    {
      "urls": [
        "turn:turn.example.com:3478?transport=udp",
        "turn:turn.example.com:3478?transport=tcp"
      ],
      "username": "1717862400:user-uuid",
      "credential": "FObG/ju1yAfzdb7VSDcVGCJQIcA=",
      "credentialType": "password"
    }
  ],
  "expiresAt": "2024-06-08T12:00:00.000Z"
}
```

### Example

```bash
curl -sS http://localhost:8080/turn/credentials \
  -H "Authorization: Bearer $JWT" | jq
```

`TurnService` is exported from `TurnModule` so the future SFU / media layer
can mint the same credentials internally without going through HTTP.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
