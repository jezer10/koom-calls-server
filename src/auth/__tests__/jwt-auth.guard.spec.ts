import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { JwtStrategy } from '../jwt.strategy';
import { WsJwtGuard } from '../ws-jwt.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let superCanActivate: jest.SpyInstance;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard, { provide: JwtStrategy, useValue: {} }],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
    const parentProto = Object.getPrototypeOf(Object.getPrototypeOf(guard)) as {
      canActivate?: (...args: unknown[]) => unknown;
    };
    superCanActivate = jest
      .spyOn(parentProto, 'canActivate')
      .mockReturnValue(true);
  });

  afterEach(() => {
    superCanActivate.mockRestore();
  });

  it('delegates canActivate to the parent passport AuthGuard', () => {
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as unknown as ExecutionContext;
    const result = guard.canActivate(ctx);
    expect(superCanActivate).toHaveBeenCalledWith(ctx);
    expect(result).toBe(true);
  });

  it('extracts the http request from the context', () => {
    const fakeReq = { headers: { authorization: 'Bearer x' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => fakeReq }),
    } as unknown as ExecutionContext;
    expect(guard.getRequest(ctx)).toBe(fakeReq);
  });
});

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;

  beforeEach(() => {
    guard = new WsJwtGuard();
  });

  const makeCtx = (client: unknown) =>
    ({
      switchToWs: () => ({ getClient: () => client }),
    }) as unknown as ExecutionContext;

  it('accepts token from handshake.auth.token', () => {
    const client = {
      id: 'sock-1',
      handshake: { auth: { token: 'abc' }, headers: {} },
    };
    expect(guard.canActivate(makeCtx(client))).toBe(true);
  });

  it('accepts token from authorization header', () => {
    const client = {
      id: 'sock-2',
      handshake: { auth: {}, headers: { authorization: 'Bearer hello' } },
    };
    expect(guard.canActivate(makeCtx(client))).toBe(true);
  });

  it('rejects when no token is provided', () => {
    const client = {
      id: 'sock-3',
      handshake: { auth: {}, headers: {} },
    };
    expect(() => guard.canActivate(makeCtx(client))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when handshake.auth is missing', () => {
    const client = { id: 'sock-4', handshake: { headers: {} } };
    expect(() => guard.canActivate(makeCtx(client))).toThrow(
      UnauthorizedException,
    );
  });

  it('skips non-Bearer authorization headers', () => {
    const client = {
      id: 'sock-5',
      handshake: { auth: {}, headers: { authorization: 'Basic abc' } },
    };
    expect(() => guard.canActivate(makeCtx(client))).toThrow(
      UnauthorizedException,
    );
  });
});
