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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = parseEnv(env);

  return {
    httpPort: parseInt10(env.PORT, parsed.PORT),
    peer: {
      enabled: env.SKIP_PEER !== '1',
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
  };
}
