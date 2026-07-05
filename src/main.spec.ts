import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

describe('bootstrap()', () => {
  let bootstrap: () => Promise<void>;
  let logSpy: jest.SpyInstance;
  let listenSpy: jest.Mock;
  let fakeApp: {
    listen: jest.Mock;
    get: jest.Mock;
    useWebSocketAdapter: jest.Mock;
    enableCors: jest.Mock;
    use: jest.Mock;
    setGlobalPrefix: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules();
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgres://koom:koom@localhost:5432/koom_test';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'dev-jwt-secret';
    process.env.TURN_SHARED_SECRET =
      process.env.TURN_SHARED_SECRET ?? 'dev-turn-secret';
    listenSpy = jest.fn().mockResolvedValue(undefined);
    const fakeConfigService = {
      get: (key: string) => {
        if (key === 'app.corsOrigin') return '*';
        if (key === 'redis.url') return '';
        return undefined;
      },
      getOrThrow: (key: string) => {
        if (key === 'app.port') return 8080;
        if (key === 'signaling.namespace') return '/signaling';
        throw new Error(`unexpected key ${key}`);
      },
    } as unknown as ConfigService;
    fakeApp = {
      listen: listenSpy,
      get: jest.fn().mockReturnValue(fakeConfigService),
      useWebSocketAdapter: jest.fn(),
      enableCors: jest.fn(),
      use: jest.fn(),
      setGlobalPrefix: jest.fn(),
    };
    jest.doMock('./app.module', () => ({
      AppModule: class AppModule {},
      SocketIoRedisAdapter: class SocketIoRedisAdapter {
        constructor(
          public readonly app: unknown,
          public readonly options: unknown,
        ) {}
      },
    }));
    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: jest.fn().mockResolvedValue(fakeApp),
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    bootstrap = (require('./main') as typeof import('./main')).bootstrap;
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy?.mockRestore();
    jest.restoreAllMocks();
  });

  it('bootstraps the server with the configured port and ws adapter', async () => {
    await bootstrap();
    expect(fakeApp.enableCors).toHaveBeenCalled();
    expect(fakeApp.useWebSocketAdapter).toHaveBeenCalledTimes(1);
    expect(listenSpy).toHaveBeenCalledWith(8080);
  });
});
