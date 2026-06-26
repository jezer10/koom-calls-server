import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { bootstrap } from './main';
import type { AppConfig } from './config/app.config';

describe('bootstrap()', () => {
  let logSpy: jest.SpyInstance;
  let createSpy: jest.SpyInstance;
  let listenSpy: jest.Mock;

  beforeEach(() => {
    listenSpy = jest.fn().mockResolvedValue(undefined);
    const fakeAppConfig: Partial<AppConfig> = {
      httpPort: 8080,
      signaling: { namespace: '/signaling', corsOrigin: '*' },
      redis: { url: '' },
    };
    const fakeApp = {
      listen: listenSpy,
      get: jest.fn().mockReturnValue(fakeAppConfig),
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
