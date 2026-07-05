import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;
  const config = {
    getOrThrow: jest.fn().mockReturnValue('/signaling'),
  };

  describe('getHello()', () => {
    it('returns a non-empty banner', () => {
      service = new AppService(config as unknown as ConfigService);
      expect(service.getHello()).toBe('Koom Calls signaling server');
    });
  });

  describe('getInfo()', () => {
    it('exposes signaling namespace and LiveKit as the media provider', () => {
      service = new AppService(config as unknown as ConfigService);
      const info = service.getInfo();
      expect(info.signaling.namespace).toBe('/signaling');
      expect(info.media.provider).toBe('livekit');
    });
  });

  describe('getHealth()', () => {
    it('returns a fresh ISO timestamp on each call', () => {
      service = new AppService(config as unknown as ConfigService);
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
