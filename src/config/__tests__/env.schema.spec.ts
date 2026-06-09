import {
  EnvValidationError,
  NODE_ENV_VALUES,
  buildEnvSchema,
  parseEnv,
} from '../env.schema';

describe('parseEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of [
      'PORT',
      'CORS_ORIGIN',
      'SIGNALING_NAMESPACE',
      'DATABASE_URL',
      'JWT_SECRET',
      'JWT_TTL',
      'JWT_AUDIENCE',
      'JWT_ISSUER',
      'LIVEKIT_URL',
      'LIVEKIT_API_KEY',
      'LIVEKIT_API_SECRET',
      'SFU_URL',
      'REDIS_URL',
      'TURN_URL',
      'TURN_URLS',
      'TURN_SHARED_SECRET',
      'TURN_TTL',
      'TURN_TOKEN_TTL_SECONDS',
      'PEER_ENABLED',
      'PEER_PORT',
      'PEER_KEY',
      'PEER_PATH',
      'PEER_ALLOW_DISCOVERY',
      'RATE_LIMIT_SOCKET_PER_SECOND',
      'RATE_LIMIT_USER_PER_SECOND',
      'RATE_LIMIT_IP_PER_SECOND',
      'RATE_LIMIT_SOCKET_BURST',
      'RATE_LIMIT_USER_BURST',
      'RATE_LIMIT_IP_BURST',
      'SFU_TOKEN_TTL_SECONDS',
      'LOG_LEVEL',
      'NODE_ENV',
    ]) {
      delete process.env[key];
    }
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('default values', () => {
    it('returns the documented defaults for every variable', () => {
      const parsed = parseEnv({});
      expect(parsed.PORT).toBe(8080);
      expect(parsed.CORS_ORIGIN).toBe('*');
      expect(parsed.SIGNALING_NAMESPACE).toBe('/signaling');
      expect(parsed.DATABASE_URL).toBe('sqlite::memory:');
      expect(parsed.JWT_TTL).toBe('1h');
      expect(parsed.JWT_AUDIENCE).toBeUndefined();
      expect(parsed.JWT_ISSUER).toBeUndefined();
      expect(parsed.LIVEKIT_URL).toBe('');
      expect(parsed.LIVEKIT_API_KEY).toBe('');
      expect(parsed.LIVEKIT_API_SECRET).toBe('');
      expect(parsed.SFU_URL).toBe('');
      expect(parsed.REDIS_URL).toBe('');
      expect(parsed.TURN_URL).toBe('');
      expect(parsed.TURN_URLS).toBe('');
      expect(parsed.TURN_SHARED_SECRET).toBe('');
      expect(parsed.TURN_TTL).toBe(3600);
      expect(parsed.TURN_TOKEN_TTL_SECONDS).toBe(3600);
      expect(parsed.PEER_ENABLED).toBe(false);
      expect(parsed.PEER_PORT).toBe(9000);
      expect(parsed.PEER_KEY).toBe('peerjs');
      expect(parsed.PEER_PATH).toBe('/');
      expect(parsed.PEER_ALLOW_DISCOVERY).toBe(false);
      expect(parsed.RATE_LIMIT_SOCKET_PER_SECOND).toBe(20);
      expect(parsed.RATE_LIMIT_USER_PER_SECOND).toBe(10);
      expect(parsed.RATE_LIMIT_IP_PER_SECOND).toBe(30);
      expect(parsed.RATE_LIMIT_SOCKET_BURST).toBe(5);
      expect(parsed.RATE_LIMIT_USER_BURST).toBe(3);
      expect(parsed.RATE_LIMIT_IP_BURST).toBe(8);
      expect(parsed.SFU_TOKEN_TTL_SECONDS).toBe(3600);
      expect(parsed.LOG_LEVEL).toBe('debug');
      expect(parsed.NODE_ENV).toBe('development');
      expect(typeof parsed.JWT_SECRET).toBe('string');
      expect(parsed.JWT_SECRET.length).toBeGreaterThan(0);
    });

    it('defaults NODE_ENV to development when missing, empty, or unknown', () => {
      expect(parseEnv({}).NODE_ENV).toBe('development');
      expect(parseEnv({ NODE_ENV: '' }).NODE_ENV).toBe('development');
      expect(parseEnv({ NODE_ENV: 'staging' }).NODE_ENV).toBe('development');
    });

    it('exposes the canonical NODE_ENV enum values', () => {
      expect(NODE_ENV_VALUES).toEqual(['development', 'test', 'production']);
    });
  });

  describe('number coercion', () => {
    it('coerces string PORT to integer', () => {
      expect(parseEnv({ PORT: '4040' }).PORT).toBe(4040);
    });

    it('coerces TURN_TTL from string to integer', () => {
      expect(parseEnv({ TURN_TTL: '900' }).TURN_TTL).toBe(900);
    });

    it('coerces PEER_PORT from string to integer', () => {
      expect(parseEnv({ PEER_PORT: '7100' }).PEER_PORT).toBe(7100);
    });
  });

  describe('boolean coercion', () => {
    it('parses true variants: 1, true, yes', () => {
      for (const value of ['1', 'true', 'TRUE', 'yes', 'YES']) {
        const env = { PEER_ENABLED: value, PEER_ALLOW_DISCOVERY: value };
        const parsed = parseEnv(env);
        expect(parsed.PEER_ENABLED).toBe(true);
        expect(parsed.PEER_ALLOW_DISCOVERY).toBe(true);
      }
    });

    it('parses false variants: 0, false, no', () => {
      for (const value of ['0', 'false', 'FALSE', 'no', 'NO']) {
        const env = { PEER_ENABLED: value, PEER_ALLOW_DISCOVERY: value };
        const parsed = parseEnv(env);
        expect(parsed.PEER_ENABLED).toBe(false);
        expect(parsed.PEER_ALLOW_DISCOVERY).toBe(false);
      }
    });
  });

  describe('NODE_ENV enum', () => {
    it.each(['development', 'test', 'production'])(
      'accepts NODE_ENV=%s',
      (value) => {
        const env: NodeJS.ProcessEnv = { NODE_ENV: value };
        if (value === 'production') {
          env['JWT_SECRET'] = 'prod';
          env['TURN_URL'] = 'turn:turn.example.com:3478';
          env['TURN_SHARED_SECRET'] = 'turn-secret';
        }
        expect(parseEnv(env).NODE_ENV).toBe(value);
      },
    );
  });

  describe('JWT_SECRET handling', () => {
    it('auto-generates JWT_SECRET in development with a warning', () => {
      const warnings: string[] = [];
      const parsed = parseEnv(
        { NODE_ENV: 'development' },
        { onWarning: (msg) => warnings.push(msg) },
      );
      expect(typeof parsed.JWT_SECRET).toBe('string');
      expect(parsed.JWT_SECRET.length).toBeGreaterThan(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/JWT_SECRET/);
    });

    it('auto-generates JWT_SECRET in test with a warning', () => {
      const warnings: string[] = [];
      const parsed = parseEnv(
        { NODE_ENV: 'test' },
        { onWarning: (msg) => warnings.push(msg) },
      );
      expect(typeof parsed.JWT_SECRET).toBe('string');
      expect(warnings).toHaveLength(1);
    });

    it('uses the provided JWT_SECRET when set in development', () => {
      const warnings: string[] = [];
      const parsed = parseEnv(
        { JWT_SECRET: 'my-dev-secret' },
        { onWarning: (msg) => warnings.push(msg) },
      );
      expect(parsed.JWT_SECRET).toBe('my-dev-secret');
      expect(warnings).toHaveLength(0);
    });

    it('uses the provided JWT_SECRET in production', () => {
      const parsed = parseEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'prod-secret',
        TURN_URL: 'turn:turn.example.com:3478',
        TURN_SHARED_SECRET: 'turn-secret',
      });
      expect(parsed.JWT_SECRET).toBe('prod-secret');
    });

    it('rejects missing JWT_SECRET in production', () => {
      expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(
        EnvValidationError,
      );
      try {
        parseEnv({ NODE_ENV: 'production' });
      } catch (err) {
        expect(err).toBeInstanceOf(EnvValidationError);
        const envErr = err as EnvValidationError;
        expect(envErr.issues.issues.map((i) => i.path.join('.'))).toContain(
          'JWT_SECRET',
        );
      }
    });

    it('rejects empty JWT_SECRET in production', () => {
      expect(() =>
        parseEnv({ NODE_ENV: 'production', JWT_SECRET: '' }),
      ).toThrow(EnvValidationError);
    });
  });

  describe('extras handling', () => {
    it('ignores unknown extra env keys (passthrough does not throw)', () => {
      expect(() =>
        parseEnv({
          SOME_FUTURE_VAR: 'irrelevant',
          ANOTHER_ONE: '123',
        }),
      ).not.toThrow();
      const parsed = parseEnv({
        SOME_FUTURE_VAR: 'irrelevant',
        ANOTHER_ONE: '123',
      });
      expect(parsed.PORT).toBe(8080);
      expect(parsed.NODE_ENV).toBe('development');
    });

    it('does not throw on extra keys, even in production', () => {
      const parsed = parseEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'prod',
        TURN_URL: 'turn:turn.example.com:3478',
        TURN_SHARED_SECRET: 'turn-secret',
        UNKNOWN: 'x',
      });
      expect(parsed.NODE_ENV).toBe('production');
      expect(parsed.JWT_SECRET).toBe('prod');
    });
  });

  describe('EnvValidationError', () => {
    it('exposes the zod issues and the original env', () => {
      const env = { NODE_ENV: 'production' };
      try {
        parseEnv(env);
        fail('expected parseEnv to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(EnvValidationError);
        const e = err as EnvValidationError;
        expect(e.env).toBe(env);
        expect(e.issues.issues.length).toBeGreaterThan(0);
        expect(e.message).toContain('Invalid environment configuration');
      }
    });
  });

  describe('buildEnvSchema', () => {
    it('returns a schema that can be parsed independently', () => {
      const schema = buildEnvSchema({ PORT: '9090' });
      const result = schema.parse({ PORT: '9090' });
      expect(result['PORT']).toBe(9090);
    });

    it('forwards warnings to the provided hook', () => {
      const seen: string[] = [];
      const schema = buildEnvSchema({}, { onWarning: (msg) => seen.push(msg) });
      schema.parse({});
      expect(seen).toHaveLength(1);
    });
  });

  describe('newly declared variables (CONFIG-1)', () => {
    it('TURN_URLS defaults to empty string', () => {
      expect(parseEnv({}).TURN_URLS).toBe('');
      expect(parseEnv({ TURN_URLS: 'turn:a:3478,turn:b:3478' }).TURN_URLS)
        .toBe('turn:a:3478,turn:b:3478');
    });

    it('SFU_URL defaults to empty string', () => {
      expect(parseEnv({}).SFU_URL).toBe('');
      expect(parseEnv({ SFU_URL: 'wss://sfu.example.com/v1/rtc' }).SFU_URL)
        .toBe('wss://sfu.example.com/v1/rtc');
    });

    it('LOG_LEVEL defaults to debug', () => {
      expect(parseEnv({}).LOG_LEVEL).toBe('debug');
      expect(parseEnv({ LOG_LEVEL: 'info' }).LOG_LEVEL).toBe('info');
      expect(parseEnv({ LOG_LEVEL: 'warn' }).LOG_LEVEL).toBe('warn');
    });

    it('JWT_AUDIENCE and JWT_ISSUER are optional and only present when set', () => {
      expect(parseEnv({}).JWT_AUDIENCE).toBeUndefined();
      expect(parseEnv({}).JWT_ISSUER).toBeUndefined();
      expect(parseEnv({ JWT_AUDIENCE: 'koom', JWT_ISSUER: 'koom-iss' }).JWT_AUDIENCE)
        .toBe('koom');
      expect(parseEnv({ JWT_AUDIENCE: 'koom', JWT_ISSUER: 'koom-iss' }).JWT_ISSUER)
        .toBe('koom-iss');
    });

    it('rate-limit fields default to the documented values', () => {
      const parsed = parseEnv({});
      expect(parsed.RATE_LIMIT_SOCKET_PER_SECOND).toBe(20);
      expect(parsed.RATE_LIMIT_USER_PER_SECOND).toBe(10);
      expect(parsed.RATE_LIMIT_IP_PER_SECOND).toBe(30);
      expect(parsed.RATE_LIMIT_SOCKET_BURST).toBe(5);
      expect(parsed.RATE_LIMIT_USER_BURST).toBe(3);
      expect(parsed.RATE_LIMIT_IP_BURST).toBe(8);
    });

    it('rate-limit fields accept numeric strings', () => {
      const parsed = parseEnv({
        RATE_LIMIT_SOCKET_PER_SECOND: '50',
        RATE_LIMIT_USER_PER_SECOND: '40',
        RATE_LIMIT_IP_PER_SECOND: '60',
        RATE_LIMIT_SOCKET_BURST: '15',
        RATE_LIMIT_USER_BURST: '10',
        RATE_LIMIT_IP_BURST: '20',
      });
      expect(parsed.RATE_LIMIT_SOCKET_PER_SECOND).toBe(50);
      expect(parsed.RATE_LIMIT_USER_PER_SECOND).toBe(40);
      expect(parsed.RATE_LIMIT_IP_PER_SECOND).toBe(60);
      expect(parsed.RATE_LIMIT_SOCKET_BURST).toBe(15);
      expect(parsed.RATE_LIMIT_USER_BURST).toBe(10);
      expect(parsed.RATE_LIMIT_IP_BURST).toBe(20);
    });

    it('SFU_TOKEN_TTL_SECONDS and TURN_TOKEN_TTL_SECONDS default to 3600', () => {
      expect(parseEnv({}).SFU_TOKEN_TTL_SECONDS).toBe(3600);
      expect(parseEnv({}).TURN_TOKEN_TTL_SECONDS).toBe(3600);
      expect(parseEnv({ SFU_TOKEN_TTL_SECONDS: '1800' }).SFU_TOKEN_TTL_SECONDS)
        .toBe(1800);
      expect(parseEnv({ TURN_TOKEN_TTL_SECONDS: '7200' }).TURN_TOKEN_TTL_SECONDS)
        .toBe(7200);
    });
  });
});
