import type { ParsedEnv } from './env.schema';

export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  httpUrl: string;
  sfuUrl: string;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendOrigin: string;
}

export interface RedisConfig {
  url: string;
}

export interface PresenceConfig {
  ttlSeconds: number;
}

export interface RateLimitConfig {
  socketPerSecond: number;
  userPerSecond: number;
  ipPerSecond: number;
  socketBurst: number;
  userBurst: number;
  ipBurst: number;
}

export interface SecurityConfig {
  sfuTokenTtlSeconds: number;
  turnTokenTtlSeconds: number;
}

export interface AppConfig {
  httpPort: number;
  nodeEnv: string;
  signaling: {
    namespace: string;
    corsOrigin: string | string[];
  };
  /**
   * Parsed environment values, validated against `env.schema.ts`.
   * Exposed so consumers can read canonical configuration without re-parsing `process.env`.
   */
  env: ParsedEnv;
  jwt: {
    secret: string;
    audience?: string;
    issuer?: string;
  };
  livekit: LiveKitConfig;
  google: GoogleConfig;
  redis: RedisConfig;
  presence: PresenceConfig;
  turn: {
    url: string;
    sharedSecret: string;
    ttlSeconds: number;
    realm: string;
    stunUrls: string[];
    urls: string[];
  };
  rateLimit: RateLimitConfig;
  security: SecurityConfig;
  logging: { level: string };
}

function parseList(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined || value === '') return fallback;
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function deriveHttpUrl(wsUrl: string | undefined): string {
  if (!wsUrl) return '';
  if (wsUrl.startsWith('http://') || wsUrl.startsWith('https://')) return wsUrl;
  if (wsUrl.startsWith('ws://')) return `http://${wsUrl.slice('ws://'.length)}`;
  if (wsUrl.startsWith('wss://'))
    return `https://${wsUrl.slice('wss://'.length)}`;
  return wsUrl;
}

export function buildAppConfig(
  parsed: ParsedEnv,
  env: NodeJS.ProcessEnv,
): AppConfig {
  const livekitUrl = parsed.LIVEKIT_URL || '';

  return {
    httpPort: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
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
    livekit: {
      url: livekitUrl,
      apiKey: parsed.LIVEKIT_API_KEY || '',
      apiSecret: parsed.LIVEKIT_API_SECRET || '',
      httpUrl: parsed.LIVEKIT_HTTP_URL || deriveHttpUrl(livekitUrl),
      // || not ?? — empty string (Zod default) must fall through to LIVEKIT_URL
      sfuUrl: parsed.SFU_URL || livekitUrl,
    },
    google: {
      clientId: parsed.GOOGLE_CLIENT_ID || '',
      clientSecret: parsed.GOOGLE_CLIENT_SECRET || '',
      redirectUri: parsed.GOOGLE_REDIRECT_URI || '',
      frontendOrigin: parsed.FRONTEND_ORIGIN || '',
    },
    redis: {
      url: parsed.REDIS_URL || '',
    },
    presence: {
      ttlSeconds: parsed.PRESENCE_TTL_SECONDS,
    },
    turn: {
      url: parsed.TURN_URL || 'turn:localhost:3478',
      sharedSecret: parsed.TURN_SHARED_SECRET,
      ttlSeconds: parsed.TURN_TTL,
      realm: env['TURN_REALM'] ?? 'koom.local',
      stunUrls: parseList(env['TURN_STUN_URLS'], [
        'stun:stun.l.google.com:19302',
      ]),
      urls: parseList(parsed.TURN_URLS || '', [
        'turn:turn.koom.example.com:3478?transport=udp',
        'turn:turn.koom.example.com:3478?transport=tcp',
      ]),
    },
    rateLimit: {
      socketPerSecond: parsed.RATE_LIMIT_SOCKET_PER_SECOND,
      userPerSecond: parsed.RATE_LIMIT_USER_PER_SECOND,
      ipPerSecond: parsed.RATE_LIMIT_IP_PER_SECOND,
      socketBurst: parsed.RATE_LIMIT_SOCKET_BURST,
      userBurst: parsed.RATE_LIMIT_USER_BURST,
      ipBurst: parsed.RATE_LIMIT_IP_BURST,
    },
    security: {
      sfuTokenTtlSeconds: parsed.SFU_TOKEN_TTL_SECONDS,
      turnTokenTtlSeconds: parsed.TURN_TOKEN_TTL_SECONDS,
    },
    logging: {
      level: parsed.LOG_LEVEL || 'info',
    },
  };
}
