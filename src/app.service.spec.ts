import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

function makeConfigService(values: Record<string, string | number>): ConfigService {
  const lookup = (key: string): string | number | undefined => values[key];
  return {
    get: <T = string | number>(key: string): T | undefined =>
      lookup(key) as T | undefined,
    getOrThrow: <T = string | number>(key: string): T => {
      const v = lookup(key);
      if (v === undefined) {
        throw new Error(`unexpected key ${key}`);
      }
      return v as T;
    },
  } as unknown as ConfigService;
}

describe('AppService', () => {
  let service: AppService;

  describe('getHello()', () => {
    it('returns a non-empty banner', () => {
      service = new AppService(makeConfigService({}));
      expect(service.getHello()).toBe('Koom Calls signaling server');
    });
  });

  describe('getInfo()', () => {
    it('returns default configuration when no env vars are set', () => {
      service = new AppService(
        makeConfigService({
          SIGNALING_NAMESPACE: '/signaling',
          PEER_PORT: 9000,
          PEER_KEY: 'peerjs',
          PEER_PATH: '/',
        }),
      );
      const info = service.getInfo();
      expect(info.signaling.namespace).toBe('/signaling');
      expect(info.peer.port).toBe(9000);
      expect(info.peer.key).toBe('peerjs');
      expect(info.peer.path).toBe('/');
      expect(info.peer.enabled).toBe(true);
    });

    it('honors SKIP_PEER=1', () => {
      service = new AppService(
        makeConfigService({
          SIGNALING_NAMESPACE: '/signaling',
          PEER_PORT: 9000,
          PEER_KEY: 'peerjs',
          PEER_PATH: '/',
          SKIP_PEER: '1',
        }),
      );
      const info = service.getInfo();
      expect(info.peer.enabled).toBe(false);
    });
  });

  describe('getHealth()', () => {
    it('returns a fresh ISO timestamp on each call', () => {
      service = new AppService(makeConfigService({}));
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
