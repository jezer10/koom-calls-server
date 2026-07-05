import { randomBytes } from 'node:crypto';
import Joi from 'joi';

export const NODE_ENV_VALUES = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENV_VALUES)[number];

export interface ValidatedEnv {
  PORT: number;
  CORS_ORIGIN: string;
  SIGNALING_NAMESPACE: string;
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
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
  TURN_REALM: string;
  TURN_STUN_URLS: string;
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
}

function generateJwtSecret(): string {
  return randomBytes(48).toString('base64url');
}

function postgresUrlSchema() {
  return Joi.string()
    .pattern(/^postgres(ql)?:\/\//)
    .required()
    .messages({
      'string.empty': 'DATABASE_URL is required',
      'string.pattern.base':
        'DATABASE_URL must use a postgres:// or postgresql:// URL',
      'any.required': 'DATABASE_URL is required',
    });
}

export const envValidationSchema = Joi.object<ValidatedEnv>({
  PORT: Joi.number().integer().default(8080),
  CORS_ORIGIN: Joi.string().default('*'),
  SIGNALING_NAMESPACE: Joi.string().default('/signaling'),
  DATABASE_URL: postgresUrlSchema(),
  DATABASE_SSL: Joi.boolean()
    .truthy('1', 'true', 'yes', 'on')
    .falsy('0', 'false', 'no', 'off')
    .default(false),
  JWT_SECRET: Joi.string().allow('').optional(),
  JWT_TTL: Joi.string().default('1h'),
  JWT_AUDIENCE: Joi.string().optional(),
  JWT_ISSUER: Joi.string().optional(),
  LIVEKIT_URL: Joi.string().allow('').default(''),
  LIVEKIT_API_KEY: Joi.string().allow('').default(''),
  LIVEKIT_API_SECRET: Joi.string().allow('').default(''),
  LIVEKIT_HTTP_URL: Joi.string().allow('').default(''),
  SFU_URL: Joi.string().allow('').default(''),
  REDIS_URL: Joi.string().allow('').default(''),
  TURN_URL: Joi.string().allow('').default(''),
  TURN_URLS: Joi.string().allow('').default(''),
  TURN_REALM: Joi.string().default('koom.local'),
  TURN_STUN_URLS: Joi.string().default('stun:stun.l.google.com:19302'),
  TURN_SHARED_SECRET: Joi.string().allow('').default(''),
  TURN_TTL: Joi.number().integer().default(3600),
  TURN_TOKEN_TTL_SECONDS: Joi.number().integer().default(3600),
  RATE_LIMIT_SOCKET_PER_SECOND: Joi.number().integer().default(20),
  RATE_LIMIT_USER_PER_SECOND: Joi.number().integer().default(10),
  RATE_LIMIT_IP_PER_SECOND: Joi.number().integer().default(30),
  RATE_LIMIT_SOCKET_BURST: Joi.number().integer().default(5),
  RATE_LIMIT_USER_BURST: Joi.number().integer().default(3),
  RATE_LIMIT_IP_BURST: Joi.number().integer().default(8),
  SFU_TOKEN_TTL_SECONDS: Joi.number().integer().default(3600),
  PRESENCE_TTL_SECONDS: Joi.number().integer().default(60),
  LOG_LEVEL: Joi.string().default('debug'),
  NODE_ENV: Joi.string()
    .valid(...NODE_ENV_VALUES)
    .default('development'),
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  GOOGLE_REDIRECT_URI: Joi.string().allow('').default(''),
  FRONTEND_ORIGIN: Joi.string().allow('').default(''),
})
  .custom((value: ValidatedEnv, helpers) => {
    const env = value.NODE_ENV;
    if (!value.JWT_SECRET) {
      if (env === 'production') {
        return helpers.error('any.custom', {
          message: 'JWT_SECRET is required in production',
        });
      }
      value.JWT_SECRET = generateJwtSecret();
    }
    if (env === 'production') {
      const requiredInProduction: Array<[keyof ValidatedEnv, string]> = [
        ['TURN_URL', 'TURN_URL is required in production'],
        ['TURN_SHARED_SECRET', 'TURN_SHARED_SECRET is required in production'],
        [
          'GOOGLE_CLIENT_ID',
          'GOOGLE_CLIENT_ID is required in production (configure Google OAuth client)',
        ],
        [
          'GOOGLE_CLIENT_SECRET',
          'GOOGLE_CLIENT_SECRET is required in production (configure Google OAuth client)',
        ],
        [
          'GOOGLE_REDIRECT_URI',
          'GOOGLE_REDIRECT_URI is required in production (configure Google OAuth redirect URI)',
        ],
        [
          'FRONTEND_ORIGIN',
          'FRONTEND_ORIGIN is required in production (configure the front-end origin)',
        ],
      ];
      for (const [key, message] of requiredInProduction) {
        if (!value[key]) {
          return helpers.error('any.custom', { message });
        }
      }
      if (value.CORS_ORIGIN === '*') {
        return helpers.error('any.custom', {
          message:
            'CORS_ORIGIN must not be "*" in production (set the front-end origin explicitly)',
        });
      }
    }
    return value;
  })
  .prefs({
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });

export function validateEnv(
  env: NodeJS.ProcessEnv = process.env,
): ValidatedEnv {
  const result = envValidationSchema.validate(env) as {
    error?: Joi.ValidationError;
    value: ValidatedEnv;
  };
  if (result.error) throw result.error;
  return result.value;
}
