import { AppService } from './app.service';

describe('AppService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  let service: AppService;

  beforeEach(() => {
    delete process.env.PORT;
    delete process.env.PEER_PORT;
    delete process.env.PEER_KEY;
    delete process.env.PEER_PATH;
    delete process.env.SIGNALING_NAMESPACE;
    delete process.env.SKIP_PEER;
    service = new AppService();
  });

  describe('getHello()', () => {
    it('returns a non-empty banner', () => {
      expect(service.getHello()).toBe('Koom Calls signaling server');
    });
  });

  describe('getInfo()', () => {
    it('returns default configuration when no env vars are set', () => {
      const info = service.getInfo();
      expect(info.signaling.namespace).toBe('/signaling');
      expect(info.peer.port).toBe(9000);
      expect(info.peer.key).toBe('peerjs');
      expect(info.peer.path).toBe('/');
      expect(info.peer.enabled).toBe(true);
    });

    it('honors SKIP_PEER=1', () => {
      process.env.SKIP_PEER = '1';
      const disabled = new AppService();
      expect(disabled.getInfo().peer.enabled).toBe(false);
    });
  });

  describe('getHealth()', () => {
    it('returns a fresh ISO timestamp on each call', () => {
      const a = service.getHealth();
      const b = service.getHealth();
      expect(a.status).toBe('ok');
      expect(typeof a.uptime).toBe('number');
      expect(new Date(a.timestamp).toString()).not.toBe('Invalid Date');
      expect(new Date(b.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(a.timestamp).getTime(),
      );
    });
  });
});
