import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('/signaling'),
          },
        },
      ],
    }).compile();

    controller = app.get<AppController>(AppController);
    service = app.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHello()', () => {
    it('should return the server banner', () => {
      expect(controller.getHello()).toBe('Koom Calls signaling server');
    });

    it('should delegate to the service', () => {
      const spy = jest.spyOn(service, 'getHello');
      controller.getHello();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getInfo()', () => {
    it('should expose server metadata', () => {
      const info = controller.getInfo();
      expect(info.name).toBe('koom-calls-server');
      expect(typeof info.version).toBe('string');
      expect(typeof info.signaling.namespace).toBe('string');
      expect(info.media.provider).toBe('livekit');
    });
  });

  describe('getHealth()', () => {
    it('should report status ok with uptime and timestamp', () => {
      const health = controller.getHealth();
      expect(health.status).toBe('ok');
      expect(typeof health.uptime).toBe('number');
      expect(typeof health.timestamp).toBe('string');
      expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
