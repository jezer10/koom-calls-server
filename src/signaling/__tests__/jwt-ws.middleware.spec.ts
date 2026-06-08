import * as jwt from 'jsonwebtoken';
import {
  JwtWsMiddleware,
  defaultJwtSecret,
  createJwtWsMiddleware,
} from '../jwt-ws.middleware';

const SECRET = 'unit-test-secret';

interface FakeSocket {
  id: string;
  data: Record<string, unknown>;
  emit: jest.Mock;
  disconnect: jest.Mock;
  handshake: {
    auth?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    query?: Record<string, unknown>;
  };
}

function makeSocket(
  id: string,
  handshake: FakeSocket['handshake'] = {},
): FakeSocket {
  return {
    id,
    data: {},
    emit: jest.fn(),
    disconnect: jest.fn(),
    handshake,
  };
}

function invoke(
  middleware: JwtWsMiddleware,
  socket: FakeSocket,
): Promise<Error | undefined> {
  return new Promise((resolve) => {
    middleware.use(socket as never, (err) => resolve(err));
  });
}

describe('JwtWsMiddleware', () => {
  describe('defaultJwtSecret()', () => {
    const original = process.env.JWT_SECRET;
    afterEach(() => {
      if (original === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = original;
    });

    it('returns process.env.JWT_SECRET when set', () => {
      process.env.JWT_SECRET = 'env-secret';
      expect(defaultJwtSecret()).toBe('env-secret');
    });

    it('falls back to "dev-secret-change-me" when not set', () => {
      delete process.env.JWT_SECRET;
      expect(defaultJwtSecret()).toBe('dev-secret-change-me');
    });
  });

  describe('createJwtWsMiddleware()', () => {
    it('builds a middleware with the provided secret', () => {
      const mw = createJwtWsMiddleware({ secret: 'x' });
      expect(mw).toBeInstanceOf(JwtWsMiddleware);
    });

    it('uses the default secret when none is provided', () => {
      const mw = createJwtWsMiddleware();
      expect(mw).toBeInstanceOf(JwtWsMiddleware);
    });
  });

  describe('use()', () => {
    let mw: JwtWsMiddleware;
    beforeEach(() => {
      mw = new JwtWsMiddleware({ secret: SECRET });
    });

    it('accepts a valid JWT in handshake.auth.token', async () => {
      const token = jwt.sign({ sub: 'alice' }, SECRET);
      const socket = makeSocket('sock-A', { auth: { token } });
      const err = await invoke(mw, socket);
      expect(err).toBeUndefined();
      expect(socket.data.userId).toBe('alice');
      expect(socket.data.token).toBe(token);
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('accepts a Bearer token in handshake.headers.authorization', async () => {
      const token = jwt.sign({ sub: 'bob' }, SECRET);
      const socket = makeSocket('sock-B', {
        headers: { authorization: `Bearer ${token}` },
      });
      const err = await invoke(mw, socket);
      expect(err).toBeUndefined();
      expect(socket.data.userId).toBe('bob');
    });

    it('accepts a token in handshake.query.token', async () => {
      const token = jwt.sign({ sub: 'carol' }, SECRET);
      const socket = makeSocket('sock-C', { query: { token } });
      const err = await invoke(mw, socket);
      expect(err).toBeUndefined();
      expect(socket.data.userId).toBe('carol');
    });

    it('rejects a missing token', async () => {
      const socket = makeSocket('sock-MISSING');
      const err = await invoke(mw, socket);
      expect(err).toBeInstanceOf(Error);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.data.userId).toBeUndefined();
    });

    it('rejects a malformed token', async () => {
      const socket = makeSocket('sock-BAD', {
        auth: { token: 'not-a-jwt' },
      });
      const err = await invoke(mw, socket);
      expect(err).toBeInstanceOf(Error);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects an expired token', async () => {
      const token = jwt.sign({ sub: 'alice' }, SECRET, { expiresIn: -10 });
      const socket = makeSocket('sock-EXP', { auth: { token } });
      const err = await invoke(mw, socket);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).name).toBe('TokenExpiredError');
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects a token signed with the wrong secret', async () => {
      const token = jwt.sign({ sub: 'mallory' }, 'wrong-secret');
      const socket = makeSocket('sock-WRONG', { auth: { token } });
      const err = await invoke(mw, socket);
      expect(err).toBeInstanceOf(Error);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects a token without a userId claim', async () => {
      const token = jwt.sign({ foo: 'bar' }, SECRET);
      const socket = makeSocket('sock-NO-UID', { auth: { token } });
      const err = await invoke(mw, socket);
      expect(err).toBeInstanceOf(Error);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('uses the configured userIdClaim', async () => {
      const custom = new JwtWsMiddleware({
        secret: SECRET,
        userIdClaim: 'uid',
      });
      const token = jwt.sign({ uid: 'dave' }, SECRET);
      const socket = makeSocket('sock-CUSTOM', { auth: { token } });
      const err = await invoke(custom, socket);
      expect(err).toBeUndefined();
      expect(socket.data.userId).toBe('dave');
    });

    it('emits auth:error before disconnecting', async () => {
      const socket = makeSocket('sock-ERR', { auth: { token: 'bad' } });
      await invoke(mw, socket);
      expect(socket.emit).toHaveBeenCalledWith('auth:error', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        reason: expect.any(String),
      });
    });
  });

  describe('verifyHandshake()', () => {
    it('returns the userId for a valid token', () => {
      const mw = new JwtWsMiddleware({ secret: SECRET });
      const token = jwt.sign({ sub: 'erin' }, SECRET);
      const socket = makeSocket('sock-1', { auth: { token } });
      const verified = mw.verifyHandshake(socket as never);
      expect(verified.userId).toBe('erin');
      expect(verified.token).toBe(token);
    });

    it('throws when no token is present', () => {
      const mw = new JwtWsMiddleware({ secret: SECRET });
      const socket = makeSocket('sock-1');
      expect(() => mw.verifyHandshake(socket as never)).toThrow(
        /missing-token/,
      );
    });

    it('throws when the token is invalid', () => {
      const mw = new JwtWsMiddleware({ secret: SECRET });
      const socket = makeSocket('sock-1', { auth: { token: 'junk' } });
      expect(() => mw.verifyHandshake(socket as never)).toThrow();
    });
  });
});
