export interface JwtConfig {
  secret: string;
  issuer: string;
  expiresInSeconds: number;
}

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
  jwt: JwtConfig;
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

export const DEFAULT_TEST_JWT_SECRET = 'koom-calls-test-secret';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const corsOrigin = env.CORS_ORIGIN ?? '*';

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
      secret: env.JWT_SECRET ?? DEFAULT_TEST_JWT_SECRET,
      issuer: env.JWT_ISSUER ?? 'koom-calls',
      expiresInSeconds: parseInt10(env.JWT_EXPIRES_IN, 3600),
    },
  };
}
