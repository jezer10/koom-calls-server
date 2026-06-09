export type RateLimitScope = 'socket' | 'user' | 'ip';

export interface RateLimitConfig {
  socketPerSecond: number;
  userPerSecond: number;
  ipPerSecond: number;
  burstSocket: number;
  burstUser: number;
  burstIp: number;
}

export const TOKEN_TTL_TOKEN = 'SECURITY_TOKEN_TTL_SECONDS';

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  socketPerSecond: 30,
  userPerSecond: 100,
  ipPerSecond: 200,
  burstSocket: 30,
  burstUser: 100,
  burstIp: 200,
};

export const RATE_LIMIT_CONFIG_TOKEN = 'RATE_LIMIT_CONFIG';

export interface RateLimitEnvSource {
  RATE_LIMIT_SOCKET_PER_SECOND: number;
  RATE_LIMIT_USER_PER_SECOND: number;
  RATE_LIMIT_IP_PER_SECOND: number;
  RATE_LIMIT_SOCKET_BURST: number;
  RATE_LIMIT_USER_BURST: number;
  RATE_LIMIT_IP_BURST: number;
}

export function parseRateLimitConfig(
  source: Partial<RateLimitEnvSource> = {},
): RateLimitConfig {
  return {
    socketPerSecond:
      source.RATE_LIMIT_SOCKET_PER_SECOND ??
      DEFAULT_RATE_LIMIT_CONFIG.socketPerSecond,
    userPerSecond:
      source.RATE_LIMIT_USER_PER_SECOND ??
      DEFAULT_RATE_LIMIT_CONFIG.userPerSecond,
    ipPerSecond:
      source.RATE_LIMIT_IP_PER_SECOND ?? DEFAULT_RATE_LIMIT_CONFIG.ipPerSecond,
    burstSocket:
      source.RATE_LIMIT_SOCKET_BURST ?? DEFAULT_RATE_LIMIT_CONFIG.burstSocket,
    burstUser:
      source.RATE_LIMIT_USER_BURST ?? DEFAULT_RATE_LIMIT_CONFIG.burstUser,
    burstIp: source.RATE_LIMIT_IP_BURST ?? DEFAULT_RATE_LIMIT_CONFIG.burstIp,
  };
}

export const VALID_SCOPES: ReadonlyArray<RateLimitScope> = [
  'socket',
  'user',
  'ip',
];

export const DEFAULT_TOKEN_TTL_SECONDS = 3600;

export interface TokenTtlEnvSource {
  SFU_TOKEN_TTL_SECONDS?: number;
  TURN_TOKEN_TTL_SECONDS?: number;
}

export function parseTokenTtl(source: TokenTtlEnvSource = {}): number {
  const raw = source.SFU_TOKEN_TTL_SECONDS ?? source.TURN_TOKEN_TTL_SECONDS;
  if (raw === undefined || raw === null || raw <= 0) {
    return DEFAULT_TOKEN_TTL_SECONDS;
  }
  return raw;
}
