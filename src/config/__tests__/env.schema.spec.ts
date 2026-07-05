import Joi from 'joi';
import {
  NODE_ENV_VALUES,
  envValidationSchema,
  validateEnv,
} from '../env.schema';

describe('validateEnv', () => {
  it('requires a Postgres DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(Joi.ValidationError);
    expect(() => validateEnv({ DATABASE_URL: 'sqlite::memory:' })).toThrow(
      /postgres/,
    );
  });

  it('applies defaults around a valid Postgres URL', () => {
    const parsed = validateEnv({
      DATABASE_URL: 'postgres://koom:secret@db:5432/koom',
    });

    expect(parsed.PORT).toBe(8080);
    expect(parsed.CORS_ORIGIN).toBe('*');
    expect(parsed.SIGNALING_NAMESPACE).toBe('/signaling');
    expect(parsed.DATABASE_SSL).toBe(false);
    expect(parsed.TURN_REALM).toBe('koom.local');
    expect(parsed.TURN_STUN_URLS).toBe('stun:stun.l.google.com:19302');
    expect(parsed.NODE_ENV).toBe('development');
    expect(typeof parsed.JWT_SECRET).toBe('string');
  });

  it('coerces numeric and boolean values', () => {
    const parsed = validateEnv({
      DATABASE_URL: 'postgres://db/koom',
      PORT: '4040',
      DATABASE_SSL: 'true',
      TURN_TTL: '900',
      PRESENCE_TTL_SECONDS: '75',
    });

    expect(parsed.PORT).toBe(4040);
    expect(parsed.DATABASE_SSL).toBe(true);
    expect(parsed.TURN_TTL).toBe(900);
    expect(parsed.PRESENCE_TTL_SECONDS).toBe(75);
  });

  it.each(NODE_ENV_VALUES)('accepts NODE_ENV=%s', (value) => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: 'postgres://db/koom',
      NODE_ENV: value,
    };
    if (value === 'production') {
      Object.assign(env, {
        JWT_SECRET: 'prod-secret',
        TURN_URL: 'turn:turn.example.com:3478',
        TURN_SHARED_SECRET: 'turn-secret',
        GOOGLE_CLIENT_ID: 'prod.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'prod-secret',
        GOOGLE_REDIRECT_URI: 'https://api.example.com/auth/google/callback',
        FRONTEND_ORIGIN: 'https://app.example.com',
        CORS_ORIGIN: 'https://app.example.com',
      });
    }
    expect(validateEnv(env).NODE_ENV).toBe(value);
  });

  it('requires production-only variables in production', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgres://db/koom',
        NODE_ENV: 'production',
        JWT_SECRET: 'prod-secret',
        TURN_URL: 'turn:turn.example.com:3478',
        TURN_SHARED_SECRET: 'turn-secret',
        GOOGLE_CLIENT_ID: 'prod.apps.googleusercontent.com',
        CORS_ORIGIN: 'https://app.example.com',
      }),
    ).toThrow(Joi.ValidationError);
  });

  it('keeps unknown variables allowed', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgres://db/koom',
        SOME_FUTURE_VAR: 'irrelevant',
      }),
    ).not.toThrow();
  });

  it('exposes a Joi schema usable by ConfigModule', () => {
    expect(envValidationSchema).toBeDefined();
  });
});
