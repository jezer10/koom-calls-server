import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from '../filters/http-exception.filter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

function makeHost(response: MockResponse, requestUrl: string): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({
        method: 'GET',
        originalUrl: requestUrl,
        url: requestUrl,
      }),
    }),
  } as unknown as ArgumentsHost;
}

function capturedJson(mock: MockResponse): Record<string, unknown> {
  const calls = mock.json.mock.calls as Array<[Record<string, unknown>]>;
  const first = calls[0];
  if (!first) throw new Error('json() was not called');
  return first[0];
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let response: MockResponse;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('formats HttpException with a string body', () => {
    const host = makeHost(response, '/api/x');
    filter.catch(new HttpException('nope', HttpStatus.BAD_REQUEST), host);
    expect(response.status).toHaveBeenCalledWith(400);
    const body = capturedJson(response);
    expect(body['statusCode']).toBe(400);
    expect(body['message']).toBe('nope');
    expect(body['path']).toBe('/api/x');
    expect(typeof body['timestamp']).toBe('string');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('flattens array messages from HttpException responses', () => {
    const host = makeHost(response, '/api/y');
    const ex = new HttpException(
      { message: ['a', 'b'], error: 'Bad Request' },
      HttpStatus.BAD_REQUEST,
    );
    filter.catch(ex, host);
    expect(capturedJson(response)).toEqual(
      expect.objectContaining({ message: 'a; b' }),
    );
  });

  it('falls back to 500 for unknown errors and logs the stack', () => {
    const host = makeHost(response, '/api/z');
    const err = new Error('boom');
    filter.catch(err, host);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(capturedJson(response)).toEqual(
      expect.objectContaining({
        statusCode: 500,
        message: 'boom',
        path: '/api/z',
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it('handles non-Error throws', () => {
    const host = makeHost(response, '/api/q');
    filter.catch('plain string', host);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(capturedJson(response)).toEqual(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });
});
