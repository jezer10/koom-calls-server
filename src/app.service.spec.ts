import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

function makeConfigService(
  values: Record<string, string | number>,
): ConfigService {
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
    it('exposes signaling namespace and LiveKit as the media provider', () => {
      service = new AppService(
        makeConfigService({ SIGNALING_NAMESPACE: '/signaling' }),
      );
      const info = service.getInfo();
      expect(info.signaling.namespace).toBe('/signaling');
      expect(info.media.provider).toBe('livekit');
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
