import { randomBytes } from 'node:crypto';
import { z } from 'zod';

export const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENV_VALUES)[number];

const numberFromString = (fallback: number) =>
  z.preprocess((value: unknown) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Math.trunc(value) : undefined;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }, z.number().int().default(fallback));

const generateJwtSecret = (): string => randomBytes(48).toString('base64url');

const detectNodeEnv = (raw: string | undefined): NodeEnv => {
  if (raw === 'production' || raw === 'test' || raw === 'development') {
    return raw;
  }
  return 'development';
};

const nodeEnvField = z.preprocess((value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (
    typeof value === 'string' &&
    (value === 'development' || value === 'test' || value === 'production')
  ) {
    return value;
  }
  return undefined;
}, z.enum(NODE_ENV_VALUES).default('development'));

export interface EnvSchemaOptions {
  /**
   * Hook for warnings emitted by the parser (e.g. auto-generated
   * JWT_SECRET in development). Defaults to a no-op so the function
   * is safe to call from any context.
   */
  onWarning?: (message: string) => void;
}

export function buildEnvSchema(
  env: NodeJS.ProcessEnv,
  options: EnvSchemaOptions = {},
) {
  const warn = options.onWarning ?? (() => undefined);
  const detectedEnv = detectNodeEnv(env.NODE_ENV);

  const jwtSecretField = z
    .string()
    .optional()
    .transform((value: string | undefined, ctx: z.RefinementCtx) => {
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
      if (detectedEnv === 'production') {
        ctx.addIssue({
          code: 'custom',
          message: 'JWT_SECRET is required in production',
        });
        return z.NEVER;
      }
      const generated = generateJwtSecret();
      warn(
        '[env] JWT_SECRET is not set; auto-generated a development-only secret. ' +
          'Do NOT use this process in production.',
      );
      return generated;
    });

  return z
    .object({
      PORT: numberFromString(8080),
      CORS_ORIGIN: z.string().default('*'),
      SIGNALING_NAMESPACE: z.string().default('/signaling'),
      DATABASE_URL: z.string().default('sqlite::memory:'),
      JWT_SECRET: jwtSecretField,
      JWT_TTL: z.string().default('1h'),
      JWT_AUDIENCE: z.string().optional(),
      JWT_ISSUER: z.string().optional(),
      LIVEKIT_URL: z.string().default(''),
      LIVEKIT_API_KEY: z.string().default(''),
      LIVEKIT_API_SECRET: z.string().default(''),
      LIVEKIT_HTTP_URL: z.string().default(''),
      SFU_URL: z.string().default(''),
      REDIS_URL: z.string().default(''),
      TURN_URL: z.string().default(''),
      TURN_URLS: z.string().default(''),
      TURN_SHARED_SECRET: z.string().default(''),
      TURN_TTL: numberFromString(3600),
      TURN_TOKEN_TTL_SECONDS: numberFromString(3600),
      RATE_LIMIT_SOCKET_PER_SECOND: numberFromString(20),
      RATE_LIMIT_USER_PER_SECOND: numberFromString(10),
      RATE_LIMIT_IP_PER_SECOND: numberFromString(30),
      RATE_LIMIT_SOCKET_BURST: numberFromString(5),
      RATE_LIMIT_USER_BURST: numberFromString(3),
      RATE_LIMIT_IP_BURST: numberFromString(8),
      SFU_TOKEN_TTL_SECONDS: numberFromString(3600),
      PRESENCE_TTL_SECONDS: numberFromString(60),
      LOG_LEVEL: z.string().default('debug'),
      NODE_ENV: nodeEnvField,
      GOOGLE_CLIENT_ID: z.string().default(''),
    })
    .superRefine((data, ctx) => {
      if (data.NODE_ENV !== 'production') return;
      if (!data.TURN_URL) {
        ctx.addIssue({
          code: 'custom',
          path: ['TURN_URL'],
          message: 'TURN_URL is required in production',
        });
      }
      if (!data.TURN_SHARED_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['TURN_SHARED_SECRET'],
          message: 'TURN_SHARED_SECRET is required in production',
        });
      }
      if (!data.GOOGLE_CLIENT_ID) {
        ctx.addIssue({
          code: 'custom',
          path: ['GOOGLE_CLIENT_ID'],
          message:
            'GOOGLE_CLIENT_ID is required in production (configure Google OAuth client)',
        });
      }
      if (data.CORS_ORIGIN === '*') {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGIN'],
          message:
            'CORS_ORIGIN must not be "*" in production (set the front-end origin explicitly)',
        });
      }
    })
    .passthrough();
}

export type ParsedEnv = {
  PORT: number;
  CORS_ORIGIN: string;
  SIGNALING_NAMESPACE: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_TTL: string;
  JWT_AUDIENCE?: string;
  JWT_ISSUER?: string;
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  LIVEKIT_HTTP_URL: string;
  SFU_URL: string;
  REDIS_URL: string;
  TURN_URL: string;
  TURN_URLS: string;
  TURN_SHARED_SECRET: string;
  TURN_TTL: number;
  TURN_TOKEN_TTL_SECONDS: number;
  RATE_LIMIT_SOCKET_PER_SECOND: number;
  RATE_LIMIT_USER_PER_SECOND: number;
  RATE_LIMIT_IP_PER_SECOND: number;
  RATE_LIMIT_SOCKET_BURST: number;
  RATE_LIMIT_USER_BURST: number;
  RATE_LIMIT_IP_BURST: number;
  SFU_TOKEN_TTL_SECONDS: number;
  PRESENCE_TTL_SECONDS: number;
  LOG_LEVEL: string;
  NODE_ENV: NodeEnv;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  FRONTEND_ORIGIN: string;
};

export interface ParseEnvOptions extends EnvSchemaOptions {
  /**
   * When true (default), throw a descriptive error on invalid env.
   */
  throwOnError?: boolean;
}

export class EnvValidationError extends Error {
  constructor(
    public readonly issues: z.ZodError,
    public readonly env: NodeJS.ProcessEnv,
  ) {
    super(formatEnvError(issues));
    this.name = 'EnvValidationError';
  }
}

function formatEnvError(error: z.ZodError): string {
  return [
    'Invalid environment configuration:',
    ...error.issues.map(
      (issue: z.ZodIssue) =>
        `  - ${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`,
    ),
  ].join('\n');
}

export function parseEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: ParseEnvOptions = {},
): ParsedEnv {
  const schema = buildEnvSchema(env, { onWarning: options.onWarning });
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new EnvValidationError(result.error, env);
  }
  return pickParsed(result.data);
}

function pickParsed(raw: Record<string, unknown>): ParsedEnv {
  return {
    PORT: raw['PORT'] as number,
    CORS_ORIGIN: raw['CORS_ORIGIN'] as string,
    SIGNALING_NAMESPACE: raw['SIGNALING_NAMESPACE'] as string,
    DATABASE_URL: raw['DATABASE_URL'] as string,
    JWT_SECRET: raw['JWT_SECRET'] as string,
    JWT_TTL: raw['JWT_TTL'] as string,
    JWT_AUDIENCE: raw['JWT_AUDIENCE'] as string | undefined,
    JWT_ISSUER: raw['JWT_ISSUER'] as string | undefined,
    LIVEKIT_URL: raw['LIVEKIT_URL'] as string,
    LIVEKIT_API_KEY: raw['LIVEKIT_API_KEY'] as string,
    LIVEKIT_API_SECRET: raw['LIVEKIT_API_SECRET'] as string,
    LIVEKIT_HTTP_URL: raw['LIVEKIT_HTTP_URL'] as string,
    SFU_URL: raw['SFU_URL'] as string,
    REDIS_URL: raw['REDIS_URL'] as string,
    TURN_URL: raw['TURN_URL'] as string,
    TURN_URLS: raw['TURN_URLS'] as string,
    TURN_SHARED_SECRET: raw['TURN_SHARED_SECRET'] as string,
    TURN_TTL: raw['TURN_TTL'] as number,
    TURN_TOKEN_TTL_SECONDS: raw['TURN_TOKEN_TTL_SECONDS'] as number,
    RATE_LIMIT_SOCKET_PER_SECOND: raw['RATE_LIMIT_SOCKET_PER_SECOND'] as number,
    RATE_LIMIT_USER_PER_SECOND: raw['RATE_LIMIT_USER_PER_SECOND'] as number,
    RATE_LIMIT_IP_PER_SECOND: raw['RATE_LIMIT_IP_PER_SECOND'] as number,
    RATE_LIMIT_SOCKET_BURST: raw['RATE_LIMIT_SOCKET_BURST'] as number,
    RATE_LIMIT_USER_BURST: raw['RATE_LIMIT_USER_BURST'] as number,
    RATE_LIMIT_IP_BURST: raw['RATE_LIMIT_IP_BURST'] as number,
    SFU_TOKEN_TTL_SECONDS: raw['SFU_TOKEN_TTL_SECONDS'] as number,
    PRESENCE_TTL_SECONDS: raw['PRESENCE_TTL_SECONDS'] as number,
    LOG_LEVEL: raw['LOG_LEVEL'] as string,
    NODE_ENV: raw['NODE_ENV'] as NodeEnv,
    GOOGLE_CLIENT_ID: raw['GOOGLE_CLIENT_ID'] as string,
    GOOGLE_CLIENT_SECRET: raw['GOOGLE_CLIENT_SECRET'] as string,
    GOOGLE_REDIRECT_URI: raw['GOOGLE_REDIRECT_URI'] as string,
    FRONTEND_ORIGIN: raw['FRONTEND_ORIGIN'] as string,
  };
}
