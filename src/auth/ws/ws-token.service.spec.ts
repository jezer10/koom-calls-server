import { JwtService } from '@nestjs/jwt';
/* eslint-disable @typescript-eslint/unbound-method */
import { WsTokenService } from './ws-token.service';

interface MockJwtPayload {
  sub: string;
  ws?: boolean;
  jti?: string;
  iat?: number;
  exp?: number;
}

function buildJwt() {
  return {
    sign: jest
      .fn()
      .mockImplementation((payload: object, opts: { expiresIn?: number }) => {
        const iat = Math.floor(Date.now() / 1000);
        const exp = iat + (opts?.expiresIn ?? 60);
        const body = JSON.stringify({ ...payload, iat, exp });
        const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString(
          'base64url',
        );
        const sig = 'sig';
        return `${header}.${Buffer.from(body).toString('base64url')}.${sig}`;
      }),
    verify: jest.fn().mockImplementation((token: string): MockJwtPayload => {
      const [, body] = token.split('.');
      return JSON.parse(
        Buffer.from(body, 'base64url').toString('utf-8'),
      ) as MockJwtPayload;
    }),
  } as unknown as JwtService;
}

describe('WsTokenService', () => {
  let jwt: ReturnType<typeof buildJwt>;
  let svc: WsTokenService;

  beforeEach(() => {
    jwt = buildJwt();
    svc = new WsTokenService(jwt);
  });

  afterEach(() => {
    svc.onModuleDestroy();
  });

  it('issue returns a token with ws:true and jti', () => {
    const result = svc.issue('user-1');
    expect(result.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'user-1',
        ws: true,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        jti: expect.any(String),
      }),
      expect.objectContaining({ expiresIn: 60 }),
    );
  });

  it('consume returns the userId for a fresh token', () => {
    const { token } = svc.issue('user-1');
    const userId = svc.consume(token);
    expect(userId).toBe('user-1');
  });

  it('consume throws when the token is replayed (single-use)', () => {
    const { token } = svc.issue('user-1');
    svc.consume(token);
    expect(() => svc.consume(token)).toThrow(/already used|not found/);
  });

  it('consume throws when the token is invalid', () => {
    expect(() => svc.consume('not-a-jwt')).toThrow(/invalid ws token/);
  });

  it('consume throws when the token is missing ws:true', () => {
    (jwt.verify as jest.Mock).mockReturnValueOnce({ sub: 'u', jti: 'j' });
    expect(() => svc.consume('x.y.z')).toThrow(/not a ws token/);
  });

  it('consume throws when the token is missing jti', () => {
    (jwt.verify as jest.Mock).mockReturnValueOnce({ sub: 'u', ws: true });
    expect(() => svc.consume('x.y.z')).toThrow(/missing jti/);
  });

  it('sweep removes expired jtis', () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      sub: 'u',
      ws: true,
      jti: 'old',
      iat: 0,
      exp: 1,
    });
    svc['used'].set('old', 1);
    svc['sweep']();
    expect(svc['used'].has('old')).toBe(false);
  });
});
