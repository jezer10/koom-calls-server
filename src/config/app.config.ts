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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const corsOrigin = env.CORS_ORIGIN ?? '*';
  const production = isProduction(env);

  const jwtSecret = env.JWT_SECRET ?? 'dev-jwt-secret';
  if (production && !env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required in production');
  }

  const turnUrl = env.TURN_URL;
  if (!turnUrl) {
    throw new Error('TURN_URL is required (e.g. turn:turn.example.com:3478)');
  }
  const turnSharedSecret = env.TURN_SHARED_SECRET ?? 'dev-turn-secret';
  if (production && !env.TURN_SHARED_SECRET) {
    throw new Error('TURN_SHARED_SECRET is required in production');
  }

  return {
    httpPort: parseInt10(env.PORT, 8080),
    peer: {
      enabled: env.SKIP_PEER !== '1',
      port: parseInt10(env.PEER_PORT, 9000),
      key: env.PEER_KEY ?? 'peerjs',
      path: env.PEER_PATH ?? '/',
      allowDiscovery: parseBool(env.PEER_ALLOW_DISCOVERY, false),
    },
    signaling: {
      namespace: env.SIGNALING_NAMESPACE ?? '/signaling',
      corsOrigin,
    },
    jwt: {
      secret: jwtSecret,
      audience: env.JWT_AUDIENCE,
      issuer: env.JWT_ISSUER,
    },
    turn: {
      url: turnUrl,
      sharedSecret: turnSharedSecret,
      ttlSeconds: parseInt10(env.TURN_TTL, 3600),
      realm: env.TURN_REALM ?? 'koom.local',
      stunUrls: parseList(env.TURN_STUN_URLS, ['stun:stun.l.google.com:19302']),
    },
  };
}
