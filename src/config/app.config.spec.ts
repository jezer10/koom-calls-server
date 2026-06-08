import { loadConfig } from './app.config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.PORT;
    delete process.env.PEER_PORT;
    delete process.env.PEER_KEY;
    delete process.env.PEER_PATH;
    delete process.env.PEER_ALLOW_DISCOVERY;
    delete process.env.SKIP_PEER;
    delete process.env.SIGNALING_NAMESPACE;
    delete process.env.CORS_ORIGIN;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_TTL;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns sensible defaults when no env vars are set', () => {
    const cfg = loadConfig();
    expect(cfg.httpPort).toBe(8080);
    expect(cfg.peer).toEqual({
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
      TURN_URL: '',
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
    process.env.PORT = '4000';
    process.env.PEER_PORT = '5000';
    const cfg = loadConfig();
    expect(cfg.httpPort).toBe(4000);
    expect(cfg.peer.port).toBe(5000);
    expect(cfg.env.PORT).toBe(4000);
    expect(cfg.env.PEER_PORT).toBe(5000);
  });

  it('falls back to default when PORT is not a number', () => {
    process.env.PORT = 'not-a-number';
    expect(loadConfig().httpPort).toBe(8080);
  });

  it('honors SKIP_PEER=1 to disable the peer server', () => {
    process.env.SKIP_PEER = '1';
    expect(loadConfig().peer.enabled).toBe(false);
  });

  it('parses PEER_ALLOW_DISCOVERY as boolean', () => {
    process.env.PEER_ALLOW_DISCOVERY = '1';
    expect(loadConfig().peer.allowDiscovery).toBe(true);
    process.env.PEER_ALLOW_DISCOVERY = 'true';
    expect(loadConfig().peer.allowDiscovery).toBe(true);
    process.env.PEER_ALLOW_DISCOVERY = '0';
    expect(loadConfig().peer.allowDiscovery).toBe(false);
  });

  it('uses custom signaling namespace and CORS origin', () => {
    process.env.SIGNALING_NAMESPACE = '/call';
    process.env.CORS_ORIGIN = 'https://app.example.com';
    const cfg = loadConfig();
    expect(cfg.signaling.namespace).toBe('/call');
    expect(cfg.signaling.corsOrigin).toBe('https://app.example.com');
    expect(cfg.env.SIGNALING_NAMESPACE).toBe('/call');
    expect(cfg.env.CORS_ORIGIN).toBe('https://app.example.com');
  });

  it('populates the env field with parsed values from process.env', () => {
    process.env.DATABASE_URL = 'postgres://db/koom';
    process.env.JWT_SECRET = 'super-secret';
    process.env.JWT_TTL = '15m';
    process.env.LIVEKIT_URL = 'wss://livekit.example.com';
    process.env.LIVEKIT_API_KEY = 'APIKEY';
    process.env.LIVEKIT_API_SECRET = 'APISECRET';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.TURN_URL = 'turn:turn.example.com:3478';
    process.env.TURN_SHARED_SECRET = 'turn-secret';
    process.env.TURN_TTL = '600';
    process.env.NODE_ENV = 'production';

    const cfg = loadConfig();

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
});
