/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { buildAppConfig } from './app.config';
import { parseEnv, type ParsedEnv } from './env.schema';

function build(
  env: NodeJS.ProcessEnv,
  parsed: ParsedEnv = parseEnv(env),
): ReturnType<typeof buildAppConfig> {
  return buildAppConfig(parsed, env);
}

describe('buildAppConfig', () => {
  it('returns sensible defaults when no env vars are set', () => {
    const env: NodeJS.ProcessEnv = { TURN_URL: 'turn:turn.example.com:3478' };
    const cfg = build(env);

    expect(cfg.httpPort).toBe(8080);
    expect(cfg.peer).toMatchObject({
      enabled: true,
      port: 9000,
      key: 'peerjs',
      path: '/',
      allowDiscovery: false,
    });
    expect(cfg.signaling).toEqual({
      namespace: '/signaling',
      corsOrigin: '*',
    });
    expect(cfg.jwt).toMatchObject({
      secret: expect.any(String),
      audience: undefined,
      issuer: undefined,
    });
    expect(cfg.turn).toMatchObject({
      url: 'turn:turn.example.com:3478',
      sharedSecret: expect.any(String),
      ttlSeconds: 3600,
      realm: 'koom.local',
      stunUrls: ['stun:stun.l.google.com:19302'],
    });
    expect(cfg.env).toMatchObject({
      PORT: 8080,
      CORS_ORIGIN: '*',
      SIGNALING_NAMESPACE: '/signaling',
      DATABASE_URL: 'sqlite::memory:',
      JWT_TTL: '1h',
      LIVEKIT_URL: '',
      LIVEKIT_API_KEY: '',
      LIVEKIT_API_SECRET: '',
      REDIS_URL: '',
      TURN_URL: 'turn:turn.example.com:3478',
      TURN_SHARED_SECRET: '',
      TURN_TTL: 3600,
      PEER_ENABLED: false,
      PEER_PORT: 9000,
      PEER_KEY: 'peerjs',
      PEER_PATH: '/',
      PEER_ALLOW_DISCOVERY: false,
      NODE_ENV: 'development',
    });
    expect(typeof cfg.env.JWT_SECRET).toBe('string');
    expect(cfg.env.JWT_SECRET.length).toBeGreaterThan(0);
  });

  it('parses numeric env values', () => {
    const env: NodeJS.ProcessEnv = {
      PORT: '4000',
      PEER_PORT: '5000',
      TURN_URL: 'turn:turn.example.com:3478',
      TURN_TTL: '600',
    };
    const cfg = build(env);
    expect(cfg.httpPort).toBe(4000);
    expect(cfg.peer.port).toBe(5000);
    expect(cfg.env.PORT).toBe(4000);
    expect(cfg.env.PEER_PORT).toBe(5000);
    expect(cfg.turn.ttlSeconds).toBe(600);
  });

  it('honors SKIP_PEER=1 to disable the peer server', () => {
    const env: NodeJS.ProcessEnv = {
      SKIP_PEER: '1',
      TURN_URL: 'turn:turn.example.com:3478',
    };
    expect(build(env).peer.enabled).toBe(false);
  });

  it('parses PEER_ALLOW_DISCOVERY as boolean', () => {
    const env: NodeJS.ProcessEnv = {
      PEER_ALLOW_DISCOVERY: '1',
      TURN_URL: 'turn:turn.example.com:3478',
    };
    expect(build(env).peer.allowDiscovery).toBe(true);
    env.PEER_ALLOW_DISCOVERY = 'true';
    expect(build(env).peer.allowDiscovery).toBe(true);
    env.PEER_ALLOW_DISCOVERY = '0';
    expect(build(env).peer.allowDiscovery).toBe(false);
  });

  it('uses custom signaling namespace and CORS origin', () => {
    const env: NodeJS.ProcessEnv = {
      SIGNALING_NAMESPACE: '/call',
      CORS_ORIGIN: 'https://app.example.com',
      TURN_URL: 'turn:turn.example.com:3478',
    };
    const cfg = build(env);
    expect(cfg.signaling.namespace).toBe('/call');
    expect(cfg.signaling.corsOrigin).toBe('https://app.example.com');
    expect(cfg.env.SIGNALING_NAMESPACE).toBe('/call');
    expect(cfg.env.CORS_ORIGIN).toBe('https://app.example.com');
  });

  it('populates the env field with parsed values from process.env', () => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: 'postgres://db/koom',
      JWT_SECRET: 'super-secret',
      JWT_TTL: '15m',
      LIVEKIT_URL: 'wss://livekit.example.com',
      LIVEKIT_API_KEY: 'APIKEY',
      LIVEKIT_API_SECRET: 'APISECRET',
      REDIS_URL: 'redis://localhost:6379',
      TURN_URL: 'turn:turn.example.com:3478',
      TURN_SHARED_SECRET: 'turn-secret',
      TURN_TTL: '600',
      NODE_ENV: 'production',
    };

    const cfg = build(env);

    expect(cfg.env).toMatchObject({
      DATABASE_URL: 'postgres://db/koom',
      JWT_SECRET: 'super-secret',
      JWT_TTL: '15m',
      LIVEKIT_URL: 'wss://livekit.example.com',
      LIVEKIT_API_KEY: 'APIKEY',
      LIVEKIT_API_SECRET: 'APISECRET',
      REDIS_URL: 'redis://localhost:6379',
      TURN_URL: 'turn:turn.example.com:3478',
      TURN_SHARED_SECRET: 'turn-secret',
      TURN_TTL: 600,
      NODE_ENV: 'production',
    });
  });

  it('parses TURN_STUN_URLS as a comma-separated list', () => {
    const env: NodeJS.ProcessEnv = {
      TURN_URL: 'turn:turn.example.com:3478',
      TURN_STUN_URLS: 'stun:a.example.com:3478, stun:b.example.com:3478',
    };
    const cfg = build(env);
    expect(cfg.turn.stunUrls).toEqual([
      'stun:a.example.com:3478',
      'stun:b.example.com:3478',
    ]);
  });

  it('requires TURN_URL in production', () => {
    // parseEnv() catches this in Zod; the env-validation error mentions TURN_URL
    // via the production-only requirements embedded in the schema.
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'real-secret',
        TURN_SHARED_SECRET: 'real-secret',
      }),
    ).toThrow();
  });

  it('requires JWT_SECRET in production', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        TURN_URL: 'turn:turn.example.com:3478',
        TURN_SHARED_SECRET: 'real-secret',
      }),
    ).toThrow();
  });

  it('requires TURN_SHARED_SECRET in production', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        TURN_URL: 'turn:turn.example.com:3478',
        JWT_SECRET: 'real-secret',
      }),
    ).toThrow();
  });
});
