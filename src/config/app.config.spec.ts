import appConfig from './app.config';
import { deriveHttpUrl } from './livekit.config';
import { parseList } from './turn.config';

describe('config namespaces', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('derives HTTP URLs from WebSocket URLs', () => {
    expect(deriveHttpUrl('ws://livekit:7880')).toBe('http://livekit:7880');
    expect(deriveHttpUrl('wss://livekit.example.com')).toBe(
      'https://livekit.example.com',
    );
    expect(deriveHttpUrl('http://api.example.com')).toBe(
      'http://api.example.com',
    );
    expect(deriveHttpUrl('')).toBe('');
  });

  it('parses comma-separated TURN lists and falls back when empty', () => {
    expect(parseList('a, b ,c', ['x'])).toEqual(['a', 'b', 'c']);
    expect(parseList('', ['x', 'y'])).toEqual(['x', 'y']);
    expect(parseList(undefined, ['x'])).toEqual(['x']);
  });

  it('builds the app namespace with normalized defaults', () => {
    delete process.env.PORT;
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_ORIGIN;
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'test';

    expect(appConfig()).toEqual({
      port: 8080,
      corsOrigin: '*',
      frontendOrigin: '',
      logLevel: 'debug',
      nodeEnv: 'test',
    });
  });
});
