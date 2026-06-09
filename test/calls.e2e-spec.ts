/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-member-access,
                  @typescript-eslint/no-unsafe-argument */

import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import {
  CALLS_REPOSITORY,
  CALL_EVENTS_REPOSITORY,
} from '../src/calls/calls.repository.interface';
import {
  CallsController,
  MeCallsController,
} from '../src/calls/calls.controller';
import { CallsService } from '../src/calls/calls.service';
import {
  InMemoryCallEventsRepository,
  InMemoryCallsRepository,
} from '../src/calls/in-memory.repositories';
import {
  CALL_STATE_MACHINE,
  createCallStateMachine,
} from '../src/calls/domain/call-state.machine';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

@Injectable()
class FakeJwtAuthGuard implements CanActivate {
  static currentUserId: string | null = 'user-1';

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (FakeJwtAuthGuard.currentUserId === null) {
      return false;
    }
    req.user = {
      userId: FakeJwtAuthGuard.currentUserId,
      email: `${FakeJwtAuthGuard.currentUserId}@example.com`,
    };
    return true;
  }
}

describe('CallsController (e2e)', () => {
  let app: INestApplication;
  let callsRepo: InMemoryCallsRepository;
  let eventsRepo: InMemoryCallEventsRepository;

  beforeEach(async () => {
    FakeJwtAuthGuard.currentUserId = 'user-1';
    callsRepo = new InMemoryCallsRepository();
    eventsRepo = new InMemoryCallEventsRepository();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CallsController, MeCallsController],
      providers: [
        CallsService,
        { provide: CALL_STATE_MACHINE, useValue: createCallStateMachine() },
        { provide: CALLS_REPOSITORY, useValue: callsRepo },
        { provide: CALL_EVENTS_REPOSITORY, useValue: eventsRepo },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(FakeJwtAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /calls', () => {
    it('rejects unauthenticated requests', async () => {
      FakeJwtAuthGuard.currentUserId = null;
      const res = await request(app.getHttpServer())
        .post('/calls')
        .send({ type: 'video' });
      expect(res.status).toBe(403);
    });

    it('creates a call in "created" state', async () => {
      const res = await request(app.getHttpServer())
        .post('/calls')
        .send({ type: 'video' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('created');
      expect(res.body.type).toBe('video');
      expect(res.body.createdBy).toBe('user-1');
    });

    it('returns 400 for an invalid type', async () => {
      const res = await request(app.getHttpServer())
        .post('/calls')
        .send({ type: 'morse' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /calls/:id', () => {
    it('returns 200 with the call', async () => {
      const created = await request(app.getHttpServer())
        .post('/calls')
        .send({ type: 'video' });
      const id = created.body.id;

      const res = await request(app.getHttpServer()).get(`/calls/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.status).toBe('created');
    });

    it('returns 404 for a missing call', async () => {
      const res = await request(app.getHttpServer()).get('/calls/missing');
      expect(res.status).toBe(404);
    });
  });

  describe('state-change endpoints', () => {
    let callId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/calls')
        .send({ type: 'video' });
      callId = res.body.id;
    });

    it('POST /calls/:id/invite transitions to ringing', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/invite`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ringing');
    });

    it('POST /calls/:id/invite returns 403 for non-host', async () => {
      const other = await request(app.getHttpServer())
        .post('/calls')
        .send({ type: 'video' });
      const otherId = other.body.id;
      FakeJwtAuthGuard.currentUserId = 'someone-else';
      const res = await request(app.getHttpServer())
        .post(`/calls/${otherId}/invite`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('POST /calls/:id/invite returns 404 for missing call', async () => {
      const res = await request(app.getHttpServer())
        .post('/calls/missing/invite')
        .send({});
      expect(res.status).toBe(404);
    });

    it('POST /calls/:id/accept transitions to accepted', async () => {
      await request(app.getHttpServer())
        .post(`/calls/${callId}/invite`)
        .send({});
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/accept`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('accepted');
    });

    it('POST /calls/:id/accept returns 409 on invalid transition', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/accept`)
        .send({});
      expect(res.status).toBe(409);
    });

    it('POST /calls/:id/reject transitions to rejected', async () => {
      await request(app.getHttpServer())
        .post(`/calls/${callId}/invite`)
        .send({});
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/reject`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
    });

    it('POST /calls/:id/cancel returns 403 for non-host', async () => {
      const other = await request(app.getHttpServer())
        .post('/calls')
        .send({ type: 'video' });
      const otherId = other.body.id;
      FakeJwtAuthGuard.currentUserId = 'someone-else';
      const res = await request(app.getHttpServer())
        .post(`/calls/${otherId}/cancel`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('POST /calls/:id/cancel transitions to cancelled', async () => {
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/cancel`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });

    it('POST /calls/:id/connect transitions to connecting', async () => {
      await request(app.getHttpServer())
        .post(`/calls/${callId}/invite`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/accept`)
        .send({});
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/connect`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('connecting');
    });

    it('POST /calls/:id/active transitions to active', async () => {
      await request(app.getHttpServer())
        .post(`/calls/${callId}/invite`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/accept`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/connect`)
        .send({});
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/active`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });

    it('POST /calls/:id/active returns 409 when no participants guard fails', async () => {
      await expect(
        request(app.getHttpServer()).post(`/calls/${callId}/active`).send({}),
      ).resolves.toMatchObject({ status: 409 });
    });

    it('POST /calls/:id/reconnect transitions to reconnecting', async () => {
      await request(app.getHttpServer())
        .post(`/calls/${callId}/invite`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/accept`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/connect`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/active`)
        .send({});
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/reconnect`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('reconnecting');
    });

    it('POST /calls/:id/reconnected transitions to active', async () => {
      await request(app.getHttpServer())
        .post(`/calls/${callId}/invite`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/accept`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/connect`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/active`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/reconnect`)
        .send({});
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/reconnected`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
    });

    it('POST /calls/:id/end transitions to ended from active', async () => {
      await request(app.getHttpServer())
        .post(`/calls/${callId}/invite`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/accept`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/connect`)
        .send({});
      await request(app.getHttpServer())
        .post(`/calls/${callId}/active`)
        .send({});
      const res = await request(app.getHttpServer())
        .post(`/calls/${callId}/end`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ended');
    });

    it('POST /calls/:id/end returns 403 for non-host', async () => {
      const other = await request(app.getHttpServer())
        .post('/calls')
        .send({ type: 'video' });
      const otherId = other.body.id;
      FakeJwtAuthGuard.currentUserId = 'someone-else';
      const res = await request(app.getHttpServer())
        .post(`/calls/${otherId}/end`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('POST /calls/:id/<transition> returns 404 for missing call', async () => {
      const res = await request(app.getHttpServer())
        .post('/calls/missing/accept')
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('GET /calls/:id/events', () => {
    it('returns the event trail for a call', async () => {
      const created = await request(app.getHttpServer())
        .post('/calls')
        .send({ type: 'video' });
      const id = created.body.id;
      await request(app.getHttpServer()).post(`/calls/${id}/invite`).send({});
      const res = await request(app.getHttpServer()).get(`/calls/${id}/events`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('returns 404 for a missing call', async () => {
      const res = await request(app.getHttpServer()).get(
        '/calls/missing/events',
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /me/calls/active', () => {
    it('returns the active calls for the current user', async () => {
      await request(app.getHttpServer()).post('/calls').send({ type: 'video' });
      const res = await request(app.getHttpServer()).get('/me/calls/active');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it('rejects unauthenticated requests', async () => {
      FakeJwtAuthGuard.currentUserId = null;
      const res = await request(app.getHttpServer()).get('/me/calls/active');
      expect(res.status).toBe(403);
    });
  });

  describe('unauth', () => {
    it('rejects when the guard denies access', async () => {
      FakeJwtAuthGuard.currentUserId = null;
      const res = await request(app.getHttpServer()).get('/calls/anything');
      expect(res.status).toBe(403);
    });
  });
});
