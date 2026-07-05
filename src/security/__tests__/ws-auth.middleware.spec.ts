import { ConfigService } from '@nestjs/config';
import { WsAuthMiddleware, signTestToken } from '../ws-auth.middleware';
import type { SocketLike } from '../ws-auth.middleware';

function makeConfigService(secret: string): ConfigService {
  return {
    getOrThrow: jest.fn().mockReturnValue(secret),
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;
}

function makeSocket(overrides: {
  auth?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
  id?: string;
}): SocketLike {
  return {
    id: overrides.id ?? 'sock-1',
    handshake: {
      auth: overrides.auth ?? {},
      headers: overrides.headers ?? {},
      query: overrides.query ?? {},
    },
    data: {},
  };
}

function makeNext(): {
  fn: (err?: Error) => void;
  err?: Error;
  called: boolean;
} {
  const recorder: { fn: (err?: Error) => void; err?: Error; called: boolean } =
    {
      fn: (err?: Error) => {
        recorder.called = true;
        recorder.err = err;
      },
      called: false,
    };
  return recorder;
}

describe('WsAuthMiddleware', () => {
  const SECRET = 'test-secret';
  let middleware: WsAuthMiddleware;

  beforeEach(() => {
    middleware = new WsAuthMiddleware(makeConfigService(SECRET));
  });

  describe('token acceptance', () => {
    it('accepts a valid token from handshake.auth.token', () => {
      const token = signTestToken({ sub: 'alice' }, SECRET);
      const socket = makeSocket({ auth: { token } });
      const next = makeNext();

      middleware.use(socket, next.fn);

      expect(next.called).toBe(true);
      expect(next.err).toBeUndefined();
      expect(socket.data.userId).toBe('alice');
      expect(socket.data.jwt).toBe(token);
    });

    it('accepts a valid token from Authorization: Bearer', () => {
      const token = signTestToken({ sub: 'bob' }, SECRET);
      const socket = makeSocket({
        headers: { authorization: `Bearer ${token}` },
      });
      const next = makeNext();

      middleware.use(socket, next.fn);

      expect(next.called).toBe(true);
      expect(next.err).toBeUndefined();
      expect(socket.data.userId).toBe('bob');
    });

    it('accepts a valid token from query.token (fallback)', () => {
      const token = signTestToken({ sub: 'carol' }, SECRET);
      const socket = makeSocket({ query: { token } });
      const next = makeNext();

      middleware.use(socket, next.fn);

      expect(next.called).toBe(true);
      expect(next.err).toBeUndefined();
      expect(socket.data.userId).toBe('carol');
    });

    it('uses the configured userIdClaim', () => {
      const token = signTestToken({ uid: 'dave' }, SECRET);
      const mw = new WsAuthMiddleware(makeConfigService(SECRET), {
        secret: SECRET,
        userIdClaim: 'uid',
      });
      const socket = makeSocket({ auth: { token } });

      mw.use(socket, makeNext().fn);

      expect(socket.data.userId).toBe('dave');
    });
  });

  describe('token rejection', () => {
    it('rejects when token is missing', () => {
      const socket = makeSocket({ auth: {}, headers: {}, query: {} });
      const next = makeNext();

      middleware.use(socket, next.fn);

      expect(next.called).toBe(true);
      expect(next.err?.message).toBe('unauthorized');
      expect(socket.data.userId).toBeUndefined();
    });

    it('rejects an expired token', () => {
      const token = signTestToken({ sub: 'frank' }, SECRET, {
        expiresIn: -120,
      });
      const socket = makeSocket({ auth: { token } });
      const next = makeNext();

      middleware.use(socket, next.fn);

      expect(next.err?.message).toBe('unauthorized');
      const result = middleware.authenticate(socket);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('expired_token');
    });

    it('rejects a malformed token', () => {
      const socket = makeSocket({ auth: { token: 'not-a-jwt' } });
      const next = makeNext();

      middleware.use(socket, next.fn);

      expect(next.err?.message).toBe('unauthorized');
      const result = middleware.authenticate(socket);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('malformed_token');
    });

    it('rejects a token signed with a different secret', () => {
      const token = signTestToken({ sub: 'mallory' }, 'wrong-secret');
      const socket = makeSocket({ auth: { token } });
      const next = makeNext();

      middleware.use(socket, next.fn);

      expect(next.err?.message).toBe('unauthorized');
    });

    it('rejects a token missing the userId claim', () => {
      const token = signTestToken({}, SECRET);
      const socket = makeSocket({ auth: { token } });
      const next = makeNext();

      middleware.use(socket, next.fn);

      expect(next.err?.message).toBe('unauthorized');
      const result = middleware.authenticate(socket);
      if (!result.ok) expect(result.reason).toBe('missing_user_id');
    });

    it('rejects a Bearer header with a malformed token', () => {
      const socket = makeSocket({
        headers: { authorization: 'Bearer not-a-jwt' },
      });
      const next = makeNext();

      middleware.use(socket, next.fn);

      expect(next.err?.message).toBe('unauthorized');
    });
  });

  describe('factory helpers', () => {
    it('forSocketIo returns a function that validates via the middleware', () => {
      const token = signTestToken({ sub: 'gina' }, SECRET);
      const socket = makeSocket({ auth: { token } });
      const handler = middleware.forSocketIo();
      const next = makeNext();
      handler(socket, next.fn);
      expect(next.err).toBeUndefined();
      expect(socket.data.userId).toBe('gina');
    });
  });
});
