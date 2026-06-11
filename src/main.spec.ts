import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { bootstrap } from './main';

describe('bootstrap()', () => {
  let logSpy: jest.SpyInstance;
  let createSpy: jest.SpyInstance;
  let listenSpy: jest.Mock;

  beforeEach(() => {
    listenSpy = jest.fn().mockResolvedValue(undefined);
    const fakeConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'CORS_ORIGIN') return '*';
        return undefined;
      }),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'PORT') return 8080;
        if (key === 'SIGNALING_NAMESPACE') return '/signaling';
        throw new Error(`unexpected key ${key}`);
      }),
    };
    const fakeApp = {
      listen: listenSpy,
      get: jest.fn().mockReturnValue(fakeConfigService),
      useWebSocketAdapter: jest.fn(),
      enableCors: jest.fn(),
      use: jest.fn(),
      setGlobalPrefix: jest.fn(),
    };
    createSpy = jest
      .spyOn(NestFactory, 'create')
      .mockResolvedValue(fakeApp as never);
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    createSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('logs the signaling server banner', async () => {
    await bootstrap();
    const all = logSpy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .join('\n');
    expect(all).toContain('Signaling server listening');
    expect(all).toContain('Socket.IO signaling');
  });
});
