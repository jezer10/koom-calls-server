import { ExecutionContext, Logger } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';

interface MockResponse {
  statusCode: number;
}

function makeHttpCtx(
  request: { method?: string; originalUrl?: string; url?: string },
  response: MockResponse,
): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', ...request }),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function makeWsCtx(): ExecutionContext {
  return {
    getType: () => 'ws',
    switchToWs: () => ({ getClient: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('logs the method, URL, status code and duration on success', async () => {
    const response: MockResponse = { statusCode: 200 };
    const ctx = makeHttpCtx(
      { method: 'POST', originalUrl: '/api/calls' },
      response,
    );
    const obs = interceptor.intercept(ctx, { handle: () => of({ ok: true }) });
    await firstValueFrom(obs);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const [msg] = logSpy.mock.calls[0] as [string];
    expect(msg).toMatch(/^POST \/api\/calls -> 200 \d+ms$/);
  });

  it('falls back to request.url when originalUrl is missing', async () => {
    const response: MockResponse = { statusCode: 200 };
    const ctx = makeHttpCtx({ method: 'GET', url: '/fallback' }, response);
    const obs = interceptor.intercept(ctx, { handle: () => of(null) });
    await firstValueFrom(obs);
    const [msg] = logSpy.mock.calls[0] as [string];
    expect(msg).toMatch(/^GET \/fallback ->/);
  });

  it('logs a warning when the handler throws', async () => {
    const response: MockResponse = { statusCode: 500 };
    const ctx = makeHttpCtx({ method: 'GET', originalUrl: '/api/x' }, response);
    const obs = interceptor.intercept(ctx, {
      handle: () => throwError(() => new Error('kaboom')),
    });
    await expect(firstValueFrom(obs)).rejects.toThrow('kaboom');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [msg] = warnSpy.mock.calls[0] as [string];
    expect(msg).toMatch(/^GET \/api\/x -> ERROR \d+ms kaboom$/);
  });

  it('skips non-http contexts', async () => {
    const ctx = makeWsCtx();
    const handle = jest.fn(() => of('ok'));
    const obs = interceptor.intercept(ctx, { handle });
    await firstValueFrom(obs);
    expect(handle).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
