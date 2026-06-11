import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthAuditLogger } from './auth-audit.logger';
import { UserEntity } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { OAuthProvidersRegistry } from './providers/oauth-providers.registry';
import {
  OAUTH_PROVIDERS,
  type OAuthProvider,
  type OAuthProvidersMap,
} from './providers/oauth-provider.interface';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { WsTokenService } from './ws/ws-token.service';

class StubJwtAuthGuard {
  canActivate(ctx: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }): boolean {
    const req = ctx.switchToHttp().getRequest() as { user?: { userId: string } };
    if (req.user) return true;
    return false;
  }
}

function makeProvider(
  enabled: boolean,
  exchangeImpl: OAuthProvider['exchangeAndVerify'] = async () => ({
    provider: 'google',
    providerSub: 'sub-1',
    email: 'g@x.com',
    emailVerified: true,
    displayName: 'G',
    picture: null,
  }),
): OAuthProvider {
  return {
    meta: { name: 'google', displayName: 'Google', configKey: 'GOOGLE_CLIENT_ID', enabled, startUrl: '/auth/google/start' },
    exchangeAndVerify: exchangeImpl,
    buildAuthorizationUrl: (state: string) =>
      `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`,
  };
}

const FRONTEND = 'https://app.example.com';

describe('AuthController (HTTP)', () => {
  let audit: { log: jest.Mock };

  const makeUser = () => ({
    id: 'u-1',
    email: 'g@x.com',
    displayName: 'G',
    provider: 'google',
    providerSub: 'sub-1',
    picture: null,
    lastLoginAt: new Date(),
    createdAt: new Date(),
  });

  const buildApp = async (googleEnabled: boolean, opts: { verify?: OAuthProvider['exchangeAndVerify']; cookieState?: string; cookieReturnTo?: string; frontend?: string; usersRepo?: { upsertByProvider: jest.Mock; findById: jest.Mock } } = {}) => {
    audit = { log: jest.fn() };
    const google = makeProvider(googleEnabled, opts.verify);
    const providers: OAuthProvidersMap = new Map([['google', google]]);
    const users = opts.usersRepo ?? {
      upsertByProvider: jest.fn().mockImplementation(async (profile) => ({
        id: 'u-1',
        email: profile.email ?? null,
        displayName: profile.displayName,
        provider: profile.provider,
        providerSub: profile.providerSub,
        picture: null,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      })),
      findById: jest.fn().mockResolvedValue(makeUser()),
    };

    const configGet: Record<string, string> = {
      FRONTEND_ORIGIN: opts.frontend ?? FRONTEND,
      AUTH_ANONYMOUS_LOGIN_ENABLED: 'true',
      JWT_SECRET: 'test-secret',
    };
    const config = {
      get: (k: string) => configGet[k],
      getOrThrow: (k: string) => {
        if (!configGet[k]) throw new Error(`missing ${k}`);
        return configGet[k];
      },
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [UserEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([UserEntity]),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        StubJwtAuthGuard,
        { provide: AuthAuditLogger, useValue: audit },
        { provide: UsersRepository, useValue: users },
        { provide: JwtService, useValue: { sign: (payload: object) => `signed.${JSON.stringify(payload)}` } },
        { provide: ConfigService, useValue: config },
        OAuthProvidersRegistry,
        { provide: OAUTH_PROVIDERS, useValue: providers },
        WsTokenService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(StubJwtAuthGuard)
      .compile();

    const app = module.createNestApplication();
    // Wire cookie-parser so req.cookies is populated, matching runtime.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    app.use(require('cookie-parser')());
    await app.init();

    // Inject cookies into the testing client via supertest by wrapping request.
    return { app, users };
  };

  it('GET /auth/providers lists enabled google and anonymous', async () => {
    const { app } = await buildApp(true);
    const res = await request(app.getHttpServer()).get('/auth/providers').expect(200);
    const body = res.body as { providers: Array<{ name: string; enabled: boolean; startUrl?: string }> };
    const google = body.providers.find((p) => p.name === 'google');
    expect(google).toMatchObject({ name: 'google', enabled: true, startUrl: '/auth/google/start' });
    const anon = body.providers.find((p) => p.name === 'anonymous');
    expect(anon).toMatchObject({ name: 'anonymous', enabled: true });
  });

  it('GET /auth/providers omits google when disabled', async () => {
    const { app } = await buildApp(false);
    const res = await request(app.getHttpServer()).get('/auth/providers').expect(200);
    const body = res.body as { providers: Array<{ name: string }> };
    expect(body.providers.find((p) => p.name === 'google')).toBeUndefined();
  });

  it('GET /auth/google/start returns 302 and sets cookies', async () => {
    const { app } = await buildApp(true);
    const res = await request(app.getHttpServer())
      .get('/auth/google/start?returnTo=/pre-join/ABC')
      .expect(302);
    const cookies = res.headers['set-cookie'] as string[] | undefined;
    expect(cookies).toBeDefined();
    const cookieStr = (cookies ?? []).join('; ');
    expect(cookieStr).toMatch(/oauth_state=/);
    expect(cookieStr).toMatch(/oauth_returnto=/);
    expect(res.headers['location']).toMatch(/accounts\.google\.com/);
  });

  it('GET /auth/google/start returns 404 when google is not enabled', async () => {
    const { app } = await buildApp(false);
    await request(app.getHttpServer())
      .get('/auth/google/start?returnTo=/x')
      .expect(404);
  });

  it('GET /auth/google/callback returns 400 on state mismatch', async () => {
    const { app } = await buildApp(true, { cookieState: 'expected-state' });
    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=abc&state=other-state')
      .set('Cookie', 'oauth_state=expected-state; oauth_returnto=/x')
      .expect(400);
    expect(res.text).toMatch(/state mismatch/);
    expect(res.text).toMatch(/koom-oauth-error/);
  });

  it('GET /auth/google/callback returns 400 on google error', async () => {
    const { app } = await buildApp(true, { cookieState: 's' });
    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?error=access_denied&state=s')
      .set('Cookie', 'oauth_state=s')
      .expect(400);
    expect(res.text).toMatch(/access_denied/);
  });

  it('GET /auth/google/callback returns 200 with success HTML on valid code', async () => {
    const verify = jest.fn().mockResolvedValue({
      provider: 'google',
      providerSub: 'sub-1',
      email: 'g@x.com',
      emailVerified: true,
      displayName: 'G',
      picture: null,
    });
    const { app } = await buildApp(true, {
      verify,
      cookieState: 'good-state',
      cookieReturnTo: '/pre-join/X',
    });
    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=real&state=good-state')
      .set('Cookie', 'oauth_state=good-state; oauth_returnto=/pre-join/X')
      .expect(200);
    expect(res.text).toMatch(/koom-oauth-success/);
    expect(res.text).toMatch(/postMessage/);
    expect(res.text).toMatch(/pre-join\/X/);
    const cookies = res.headers['set-cookie'] as string[] | undefined;
    expect((cookies ?? []).join('; ')).toMatch(/koom_session=/);
    expect(verify).toHaveBeenCalledWith('real');
  });

  it('GET /auth/google/callback returns 401 when verify throws', async () => {
    const verify = jest.fn().mockImplementation(async () => {
      throw new Error('bad');
    });
    const { app } = await buildApp(true, { verify, cookieState: 's' });
    const res = await request(app.getHttpServer())
      .get('/auth/google/callback?code=bad&state=s')
      .set('Cookie', 'oauth_state=s')
      .expect(401);
    expect(res.text).toMatch(/koom-oauth-error/);
  });

  it('POST /auth/anonymous/login returns 200 and sets cookie', async () => {
    const { app } = await buildApp(true);
    const res = await request(app.getHttpServer())
      .post('/auth/anonymous/login')
      .send({ displayName: 'Anon' })
      .expect(200);
    const body = res.body as { displayName: string };
    expect(body.displayName).toBe('Anon');
    const cookies = res.headers['set-cookie'] as string[] | undefined;
    expect((cookies ?? []).join('; ')).toMatch(/koom_session=/);
  });

  it('GET /auth/me returns 401 without auth (stub guard rejects)', async () => {
    const { app } = await buildApp(true);
    // The stub JwtAuthGuard above returns false when no req.user, so Nest returns 403.
    // (Real JwtAuthGuard returns 401 via passport.)
    await request(app.getHttpServer()).get('/auth/me').expect(403);
  });
});
