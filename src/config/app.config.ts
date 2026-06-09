import type { ParsedEnv } from './env.schema';

export interface AppConfig {
  httpPort: number;
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

function parseList(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined || value === '') return fallback;
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function buildAppConfig(
  parsed: ParsedEnv,
  env: NodeJS.ProcessEnv,
): AppConfig {
  return {
    httpPort: parsed.PORT,
    signaling: {
      namespace: parsed.SIGNALING_NAMESPACE,
      corsOrigin: parsed.CORS_ORIGIN,
    },
    env: parsed,
    jwt: {
      secret: parsed.JWT_SECRET,
      audience: parsed.JWT_AUDIENCE,
      issuer: parsed.JWT_ISSUER,
    },
    turn: {
      url: parsed.TURN_URL || 'turn:localhost:3478',
      sharedSecret: parsed.TURN_SHARED_SECRET,
      ttlSeconds: parsed.TURN_TTL,
      realm: 'koom.local',
      stunUrls: parseList(env.TURN_STUN_URLS, ['stun:stun.l.google.com:19302']),
    },
  };
}
