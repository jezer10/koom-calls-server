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
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns sensible defaults when no env vars are set', () => {
    const cfg = loadConfig();
    expect(cfg).toEqual({
      httpPort: 8080,
      peer: {
        enabled: true,
        port: 9000,
        key: 'peerjs',
        path: '/',
        allowDiscovery: false,
      },
      signaling: {
        namespace: '/signaling',
        corsOrigin: '*',
      },
    });
  });

  it('parses numeric env values', () => {
    process.env.PORT = '4000';
    process.env.PEER_PORT = '5000';
    const cfg = loadConfig();
    expect(cfg.httpPort).toBe(4000);
    expect(cfg.peer.port).toBe(5000);
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
  });
});
