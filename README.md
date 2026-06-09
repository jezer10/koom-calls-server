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
