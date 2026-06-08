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
  const corsOrigin = env.CORS_ORIGIN ?? '*';
  const peerEnabled = env.SKIP_PEER !== '1';
  if (peerEnabled) {
    // LBR-67: deprecation notice. The PeerJS broker is being replaced by
    // LiveKit in M3; warn once at config load when the legacy path is on.

    console.warn(
      '[deprecated] PEER_ENABLED will be removed. Use LiveKit (M3).',
    );
  }

  return {
    httpPort: parseInt10(env.PORT, 8080),
    peer: {
      enabled: peerEnabled,
      port: parseInt10(env.PEER_PORT, 9000),
      key: env.PEER_KEY ?? 'peerjs',
      path: env.PEER_PATH ?? '/',
      allowDiscovery: parseBool(env.PEER_ALLOW_DISCOVERY, false),
    },
    signaling: {
      namespace: env.SIGNALING_NAMESPACE ?? '/signaling',
      corsOrigin,
    },
  };
}
