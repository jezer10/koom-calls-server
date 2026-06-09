import {
  ExecutionContext,
  Injectable,
  CanActivate,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { TurnController } from '../turn.controller';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { CoturnTurnService } from '../turn.service';
import type { TurnService } from '../turn.service';
import type { AuthenticatedUser } from '../jwt.strategy';
import type { TurnCredentials } from '../turn.types';

@Injectable()
class FakeAuthGuard implements CanActivate {
  static authenticatedUser: AuthenticatedUser | null = null;
  static reject: boolean = false;

  canActivate(context: ExecutionContext): boolean {
    if (FakeAuthGuard.reject) {
      throw new UnauthorizedException('No token');
    }
    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
    }>();
    if (FakeAuthGuard.authenticatedUser) {
      request.user = FakeAuthGuard.authenticatedUser;
    }
    return true;
  }
}

describe('TurnController', () => {
  let module: TestingModule;
  let generateCredentials: jest.Mock<
    ReturnType<TurnService['generateCredentials']>,
    Parameters<TurnService['generateCredentials']>
  >;

  const expectedCredentials: TurnCredentials = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: [
          'turn:turn.example.com:3478?transport=udp',
          'turn:turn.example.com:3478?transport=tcp',
        ],
        username: '1717862400:user-uuid',
        credential: 'FObG/ju1yAfzdb7VSDcVGCJQIcA=',
        credentialType: 'password',
      },
    ],
    expiresAt: '2024-06-08T12:00:00.000Z',
  };

  beforeEach(async () => {
    FakeAuthGuard.authenticatedUser = null;
    FakeAuthGuard.reject = false;

    generateCredentials = jest
      .fn<
        ReturnType<TurnService['generateCredentials']>,
        Parameters<TurnService['generateCredentials']>
      >()
      .mockReturnValue(expectedCredentials);

    module = await Test.createTestingModule({
      controllers: [TurnController],
      providers: [
        {
          provide: CoturnTurnService,
          useValue: { generateCredentials },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeAuthGuard)
      .compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('returns 200 with the expected iceServers shape when authenticated', async () => {
    FakeAuthGuard.authenticatedUser = {
      id: 'user-uuid',
      payload: { sub: 'user-uuid' },
    };

    const app = module.createNestApplication();
    await app.init();

    const res = await request(app.getHttpServer() as App)
      .get('/turn/credentials')
      .expect(200);

    expect(res.body).toEqual(expectedCredentials);
    expect(generateCredentials).toHaveBeenCalledWith('user-uuid');

    await app.close();
  });

  it('returns 401 when the JWT guard rejects the request', async () => {
    FakeAuthGuard.reject = true;

    const app = module.createNestApplication();
    await app.init();

    await request(app.getHttpServer() as App)
      .get('/turn/credentials')
      .expect(401);

    expect(generateCredentials).not.toHaveBeenCalled();

    await app.close();
  });
});
