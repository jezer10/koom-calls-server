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

export function parseRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
): RateLimitConfig {
  return {
    socketPerSecond: parsePositiveInt(
      env.RATE_LIMIT_SOCKET_PER_SECOND,
      DEFAULT_RATE_LIMIT_CONFIG.socketPerSecond,
    ),
    userPerSecond: parsePositiveInt(
      env.RATE_LIMIT_USER_PER_SECOND,
      DEFAULT_RATE_LIMIT_CONFIG.userPerSecond,
    ),
    ipPerSecond: parsePositiveInt(
      env.RATE_LIMIT_IP_PER_SECOND,
      DEFAULT_RATE_LIMIT_CONFIG.ipPerSecond,
    ),
    burstSocket: parsePositiveInt(
      env.RATE_LIMIT_SOCKET_BURST,
      DEFAULT_RATE_LIMIT_CONFIG.burstSocket,
    ),
    burstUser: parsePositiveInt(
      env.RATE_LIMIT_USER_BURST,
      DEFAULT_RATE_LIMIT_CONFIG.burstUser,
    ),
    burstIp: parsePositiveInt(
      env.RATE_LIMIT_IP_BURST,
      DEFAULT_RATE_LIMIT_CONFIG.burstIp,
    ),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const VALID_SCOPES: ReadonlyArray<RateLimitScope> = [
  'socket',
  'user',
  'ip',
];

export const DEFAULT_TOKEN_TTL_SECONDS = 3600;

export function parseTokenTtl(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SFU_TOKEN_TTL_SECONDS ?? env.TURN_TOKEN_TTL_SECONDS;
  if (raw === undefined || raw === '') return DEFAULT_TOKEN_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TOKEN_TTL_SECONDS;
  }
  return parsed;
}
