import { randomBytes } from 'node:crypto';
import { z } from 'zod';

export const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENV_VALUES)[number];

const booleanFromString = (fallback: boolean) =>
  z.preprocess((value: unknown) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
        return true;
      }
      if (normalized === '0' || normalized === 'false' || normalized === 'no') {
        return false;
      }
    }
    return undefined;
  }, z.boolean().default(fallback));

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
      LIVEKIT_URL: z.string().default(''),
      LIVEKIT_API_KEY: z.string().default(''),
      LIVEKIT_API_SECRET: z.string().default(''),
      REDIS_URL: z.string().default(''),
      TURN_URL: z.string().default(''),
      TURN_SHARED_SECRET: z.string().default(''),
      TURN_TTL: numberFromString(3600),
      PEER_ENABLED: booleanFromString(false),
      PEER_PORT: numberFromString(9000),
      PEER_KEY: z.string().default('peerjs'),
      PEER_PATH: z.string().default('/'),
      PEER_ALLOW_DISCOVERY: booleanFromString(false),
      NODE_ENV: nodeEnvField,
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
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  REDIS_URL: string;
  TURN_URL: string;
  TURN_SHARED_SECRET: string;
  TURN_TTL: number;
  PEER_ENABLED: boolean;
  PEER_PORT: number;
  PEER_KEY: string;
  PEER_PATH: string;
  PEER_ALLOW_DISCOVERY: boolean;
  NODE_ENV: NodeEnv;
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
    LIVEKIT_URL: raw['LIVEKIT_URL'] as string,
    LIVEKIT_API_KEY: raw['LIVEKIT_API_KEY'] as string,
    LIVEKIT_API_SECRET: raw['LIVEKIT_API_SECRET'] as string,
    REDIS_URL: raw['REDIS_URL'] as string,
    TURN_URL: raw['TURN_URL'] as string,
    TURN_SHARED_SECRET: raw['TURN_SHARED_SECRET'] as string,
    TURN_TTL: raw['TURN_TTL'] as number,
    PEER_ENABLED: raw['PEER_ENABLED'] as boolean,
    PEER_PORT: raw['PEER_PORT'] as number,
    PEER_KEY: raw['PEER_KEY'] as string,
    PEER_PATH: raw['PEER_PATH'] as string,
    PEER_ALLOW_DISCOVERY: raw['PEER_ALLOW_DISCOVERY'] as boolean,
    NODE_ENV: raw['NODE_ENV'] as NodeEnv,
  };
}
