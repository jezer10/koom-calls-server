import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
/* eslint-disable @typescript-eslint/unbound-method */
import { AuthService } from './auth.service';
import { AuthAuditLogger } from './auth-audit.logger';
import { UsersRepository } from './users.repository';
import { UserEntity } from './entities/user.entity';
import type {
  OAuthProvider,
  OAuthProvidersMap,
} from './providers/oauth-provider.interface';

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'a@x.com',
    displayName: 'A',
    provider: 'google',
    providerSub: 'user-1',
    picture: null,
    lastLoginAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeProvider(
  name: string,
  enabled = true,
  exchangeImpl: OAuthProvider['exchangeAndVerify'] = () =>
    Promise.resolve({
      provider: name,
      providerSub: `${name}-sub`,
      email: `${name}@x.com`,
      emailVerified: true,
      displayName: name,
      picture: null,
    }),
  buildUrl: OAuthProvider['buildAuthorizationUrl'] = () =>
    `https://accounts.${name}.com/auth?state=...`,
): OAuthProvider {
  return {
    meta: { name, displayName: name, configKey: `${name}_ID`, enabled },
    exchangeAndVerify: exchangeImpl,
    buildAuthorizationUrl: buildUrl,
  };
}

function buildSvc(
  opts: {
    providers?: OAuthProvidersMap;
    upsertImpl?: UsersRepository['upsertByProvider'];
    findByIdImpl?: UsersRepository['findById'];
    signImpl?: JwtService['sign'];
    configValues?: Record<string, string | undefined>;
  } = {},
) {
  const users = {
    upsertByProvider: opts.upsertImpl ?? (() => Promise.resolve(makeUser())),
    findById: opts.findByIdImpl ?? (() => Promise.resolve(makeUser())),
  } as unknown as UsersRepository;
  const jwt = {
    sign: opts.signImpl ?? (() => 'signed.jwt.token'),
  } as unknown as JwtService;
  const audit = { log: jest.fn() } as unknown as AuthAuditLogger;
  const providers = opts.providers ?? null;
  const config = {
    get: (k: string) => opts.configValues?.[k],
  } as unknown as ConfigService;
  const svc = new AuthService(users, jwt, audit, providers, config);
  return { svc, users, jwt, audit, providers, config };
}

describe('AuthService', () => {
  describe('startOAuth', () => {
    it('returns the authorization URL and logs oauth_start', () => {
      const p = makeProvider('google');
      const { svc, audit } = buildSvc({
        providers: new Map([['google', p]]),
      });
      const url = svc.startOAuth('google');
      expect(url).toBe('https://accounts.google.com/auth?state=...');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'auth.oauth_start',
          provider: 'google',
        }),
      );
    });

    it('throws NotFound for unknown provider', () => {
      const { svc } = buildSvc();
      expect(() => svc.startOAuth('nope')).toThrow(NotFoundException);
    });

    it('throws NotFound for disabled provider', () => {
      const p = makeProvider('google', false);
      const { svc } = buildSvc({ providers: new Map([['google', p]]) });
      expect(() => svc.startOAuth('google')).toThrow(NotFoundException);
    });
  });

  describe('completeOAuth', () => {
    it('returns user and token on success', async () => {
      const p = makeProvider('google');
      const sign = jest.fn().mockReturnValue('jwt.tok');
      const upsert = jest
        .fn()
        .mockResolvedValue(
          makeUser({ id: 'u-g', email: 'g@x.com', displayName: 'G' }),
        );
      const { svc, audit } = buildSvc({
        providers: new Map([['google', p]]),
        upsertImpl: upsert,
        signImpl: sign,
      });
      const result = await svc.completeOAuth('google', 'code-1');
      expect(result.user.id).toBe('u-g');
      expect(result.token).toBe('jwt.tok');
      expect(sign).toHaveBeenCalledWith({ sub: 'u-g', email: 'g@x.com' });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth.oauth_callback_success' }),
      );
    });

    it('throws Unauthorized when exchangeAndVerify fails', async () => {
      const p = makeProvider('google', true, () => {
        throw new Error('bad');
      });
      const { svc, audit } = buildSvc({
        providers: new Map([['google', p]]),
      });
      await expect(svc.completeOAuth('google', 'code')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'auth.oauth_callback_failed' }),
      );
    });

    it('throws NotFound when provider is unknown', async () => {
      const { svc } = buildSvc();
      await expect(svc.completeOAuth('nope', 'c')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when provider is disabled', async () => {
      const p = makeProvider('google', false);
      const { svc } = buildSvc({ providers: new Map([['google', p]]) });
      await expect(svc.completeOAuth('google', 'c')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('signInAnonymous', () => {
    it('upserts an anonymous user and signs a token', async () => {
      const upsert = jest
        .fn()
        .mockResolvedValue(
          makeUser({ id: 'a-1', provider: 'anonymous', providerSub: 'anon-x' }),
        );
      const { svc } = buildSvc({ upsertImpl: upsert });
      const result = await svc.signInAnonymous('anon-x', 'Guest');
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anonymous',
          providerSub: 'anon-x',
        }),
      );
      expect(result.userId).toBe('a-1');
      expect(result.provider).toBe('anonymous');
    });
  });

  describe('getProfile', () => {
    it('returns the profile fields', async () => {
      const findById = jest
        .fn()
        .mockResolvedValue(
          makeUser({ id: 'u-1', displayName: 'X', email: null }),
        );
      const { svc } = buildSvc({ findByIdImpl: findById });
      const profile = await svc.getProfile('u-1');
      expect(profile).toMatchObject({
        userId: 'u-1',
        displayName: 'X',
        email: null,
        provider: 'google',
      });
    });

    it('throws NotFound when user does not exist', async () => {
      const { svc } = buildSvc({ findByIdImpl: () => Promise.resolve(null) });
      await expect(svc.getProfile('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('signSessionToken', () => {
    it('signs a JWT with sub and email', () => {
      const sign = jest.fn().mockReturnValue('tok');
      const { svc } = buildSvc({ signImpl: sign });
      const t = svc.signSessionToken('u-1', 'u@x.com');
      expect(sign).toHaveBeenCalledWith({ sub: 'u-1', email: 'u@x.com' });
      expect(t).toBe('tok');
    });
  });

  describe('getFrontendOrigin / getCookieSecure / isProduction', () => {
    it('returns FRONTEND_ORIGIN', () => {
      const { svc } = buildSvc({
        configValues: { FRONTEND_ORIGIN: 'https://app.example.com' },
      });
      expect(svc.getFrontendOrigin()).toBe('https://app.example.com');
    });

    it('returns cookie secure when production', () => {
      const { svc } = buildSvc({ configValues: { NODE_ENV: 'production' } });
      expect(svc.getCookieSecure()).toBe(true);
      expect(svc.isProduction()).toBe(true);
    });

    it('returns cookie insecure when not production', () => {
      const { svc } = buildSvc({ configValues: { NODE_ENV: 'development' } });
      expect(svc.getCookieSecure()).toBe(false);
      expect(svc.isProduction()).toBe(false);
    });
  });
});
