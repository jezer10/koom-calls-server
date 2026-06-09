import { parseEnv, type ParsedEnv } from './env.schema';

export interface AppConfig {
  httpPort: number;
  peer: {
    enabled: boolean;
    port: number;
    key: string;
    path: string;
    allowDiscovery: boolean;
  };
  signaling: {
    namespace: string;
    corsOrigin: string | string[];
  };
  /**
   * Parsed environment values, validated against `env.schema.ts`.
   * Exposed so consumers (modules, guards, providers) can read
   * canonical configuration without re-parsing `process.env`.
   */
  env: ParsedEnv;
  jwt: {
    secret: string;
    audience?: string;
    issuer?: string;
  };
  turn: {
    url: string;
    sharedSecret: string;
    ttlSeconds: number;
    realm: string;
    stunUrls: string[];
  };
}

function parseInt10(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

function parseList(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined || value === '') return fallback;
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isProduction(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

let peerWarned = false;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = parseEnv(env);
  const peerEnabled = env.SKIP_PEER !== '1';
  if (peerEnabled && !peerWarned) {
    peerWarned = true;
    console.warn(
      '[deprecated] PEER_ENABLED will be removed. Use LiveKit (M3).',
    );
  }

  const production = isProduction(env);
  const jwtSecret = env.JWT_SECRET ?? parsed.JWT_SECRET;
  if (production && !env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }

  const turnUrl = env.TURN_URL ?? parsed.TURN_URL;
  if (!turnUrl && production) {
    throw new Error('TURN_URL is required in production');
  }
  const turnSharedSecret = env.TURN_SHARED_SECRET ?? parsed.TURN_SHARED_SECRET;
  if (production && !env.TURN_SHARED_SECRET) {
    throw new Error('TURN_SHARED_SECRET is required in production');
  }

  return {
    httpPort: parseInt10(env.PORT, parsed.PORT),
    peer: {
      enabled: peerEnabled,
      port: parseInt10(env.PEER_PORT, parsed.PEER_PORT),
      key: env.PEER_KEY ?? parsed.PEER_KEY,
      path: env.PEER_PATH ?? parsed.PEER_PATH,
      allowDiscovery: parseBool(
        env.PEER_ALLOW_DISCOVERY,
        parsed.PEER_ALLOW_DISCOVERY,
      ),
    },
    signaling: {
      namespace: env.SIGNALING_NAMESPACE ?? parsed.SIGNALING_NAMESPACE,
      corsOrigin: env.CORS_ORIGIN ?? parsed.CORS_ORIGIN,
    },
    env: parsed,
    jwt: {
      secret: jwtSecret,
      audience: env.JWT_AUDIENCE,
      issuer: env.JWT_ISSUER,
    },
    turn: {
      url: turnUrl || 'turn:localhost:3478',
      sharedSecret: turnSharedSecret,
      ttlSeconds: parseInt10(env.TURN_TTL, parsed.TURN_TTL),
      realm: env.TURN_REALM ?? 'koom.local',
      stunUrls: parseList(env.TURN_STUN_URLS, [
        'stun:stun.l.google.com:19302',
      ]),
    },
  };
}
