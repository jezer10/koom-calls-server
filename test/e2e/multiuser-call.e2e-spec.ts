import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { bootstrapTestApp, BootstrappedApp } from '../helpers/test-app';
import { signTestJwt } from '../helpers/sign-jwt';
import { connectWsClient, waitFor, delay } from '../helpers/ws-client';

const TEST_USER_A = 'user-A';
const TEST_USER_B = 'user-B';
const TEST_USER_C = 'user-C';

interface CreateCallResponse {
  id: string;
  roomId: string;
  status: 'pending' | 'active' | 'ended';
  creatorId: string;
  participants: Array<{
    userId: string;
    role: 'creator' | 'invitee';
    status: 'invited' | 'joined' | 'left' | 'declined';
    invitedAt: string;
    joinedAt?: string;
    leftAt?: string;
  }>;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  endedBy?: string;
}

interface TurnResponse {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
  expiresAt: string;
}

interface SfuResponse {
  token: string;
  url: string;
  roomId: string;
  callId: string;
  userId: string;
  expiresAt: string;
}

interface EventsResponse {
  events: Array<{
    id: number;
    callId: string;
    type: 'created' | 'invited' | 'accepted' | 'joined' | 'left' | 'ended';
    userId: string;
    payload?: Record<string, unknown>;
    createdAt: string;
  }>;
}

function authedRequest(app: INestApplication, token: string) {
  const server = app.getHttpServer() as unknown as Server & {
    address: () => AddressInfo;
  };
  const agent = request(server);
  const authed = {
    get: (path: string) =>
      agent.get(path).set('Authorization', `Bearer ${token}`),
    post: (path: string) =>
      agent.post(path).set('Authorization', `Bearer ${token}`),
  };
  return authed;
}

function bodyMessage(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const m = body.message;
    if (typeof m === 'string') return m;
  }
  return '';
}

describe('Multiuser call lifecycle (e2e)', () => {
  let boot: BootstrappedApp;
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let tokenC: string;

  beforeAll(async () => {
    boot = await bootstrapTestApp();
    app = boot.app;
    tokenA = signTestJwt({ userId: TEST_USER_A });
    tokenB = signTestJwt({ userId: TEST_USER_B });
    tokenC = signTestJwt({ userId: TEST_USER_C });
  });

  afterAll(async () => {
    await boot.close();
  });

  afterEach(() => {
    boot.callsService.reset();
    boot.turnService.calls.length = 0;
    boot.sfuService.calls.length = 0;
  });

  it('1. allows two users to create, join, and end a call (happy path)', async () => {
    const alice = authedRequest(app, tokenA);
    const bob = authedRequest(app, tokenB);

    // 1) Create a call as user A. (B is invited in the same payload.)
    const created = await alice
      .post('/calls')
      .send({ invitees: [TEST_USER_B] })
      .expect(201);
    const call = created.body as CreateCallResponse;
    expect(call.id).toMatch(/[0-9a-f-]{36}/i);
    expect(call.creatorId).toBe(TEST_USER_A);
    expect(call.status).toBe('pending');
    expect(call.participants).toHaveLength(2);
    expect(
      call.participants.find((p) => p.userId === TEST_USER_B),
    ).toMatchObject({ status: 'invited', role: 'invitee' });

    // 2/3) B accepts the call.
    const accepted = await bob.post(`/calls/${call.id}/accept`).expect(200);
    const acceptedBody = accepted.body as CreateCallResponse;
    expect(acceptedBody.status).toBe('active');
    expect(
      acceptedBody.participants.find((p) => p.userId === TEST_USER_B)?.status,
    ).toBe('joined');

    // 4) Fetch TURN credentials for both users.
    const turnA = await alice
      .get(`/calls/${call.id}/turn-credentials`)
      .expect(200);
    const turnBodyA = turnA.body as TurnResponse;
    expect(turnBodyA.urls.length).toBeGreaterThan(0);
    expect(turnBodyA.credential).toBeTruthy();
    expect(turnBodyA.ttl).toBeGreaterThan(0);
    expect(new Date(turnBodyA.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const turnB = await bob
      .get(`/calls/${call.id}/turn-credentials`)
      .expect(200);
    const turnBodyB = turnB.body as TurnResponse;
    expect(turnBodyB.username).not.toBe(turnBodyA.username);

    // 5) Fetch a SFU token (mocked).
    const sfuRes = await alice.post(`/calls/${call.id}/sfu-token`).expect(200);
    const sfuBody = sfuRes.body as SfuResponse;
    expect(sfuBody.token).toBeTruthy();
    expect(sfuBody.url).toMatch(/^wss?:\/\//);
    expect(sfuBody.callId).toBe(call.id);
    expect(sfuBody.userId).toBe(TEST_USER_A);

    // 6) Two sockets join the signaling room.
    const sockA = await connectWsClient({
      url: boot.baseUrl,
      namespace: boot.namespace,
    });
    const sockB = await connectWsClient({
      url: boot.baseUrl,
      namespace: boot.namespace,
    });
    try {
      const aExisting = new Promise<{ members: unknown[] }>((resolve) =>
        sockA.socket.once('existing-users', resolve),
      );
      sockA.socket.emit('join', { roomId: call.roomId, userId: TEST_USER_A });
      const aInitial = await aExisting;
      expect(aInitial.members).toEqual([]);

      const aGotPeerJoined = new Promise<{
        socketId: string;
        userId: string;
        roomId: string;
      }>((resolve) => sockA.socket.once('peer:joined', resolve));
      const bExisting = new Promise<{ members: unknown[] }>((resolve) =>
        sockB.socket.once('existing-users', resolve),
      );
      sockB.socket.emit('join', { roomId: call.roomId, userId: TEST_USER_B });
      const [aPeerJoin, bInit] = await Promise.all([aGotPeerJoined, bExisting]);
      expect(aPeerJoin.userId).toBe(TEST_USER_B);
      expect(aPeerJoin.roomId).toBe(call.roomId);
      expect((bInit.members as Array<{ userId: string }>)[0]?.userId).toBe(
        TEST_USER_A,
      );

      // 7) Simulate peer:left by disconnecting B.
      const aGotPeerLeft = new Promise<{
        socketId: string;
        userId: string;
        roomId: string;
      }>((resolve) => sockA.socket.once('peer:left', resolve));
      sockB.close();
      const aPeerLeft = await aGotPeerLeft;
      expect(aPeerLeft.userId).toBe(TEST_USER_B);
      expect(aPeerLeft.roomId).toBe(call.roomId);
    } finally {
      sockA.close();
    }

    // 9) End the call.
    const ended = await alice.post(`/calls/${call.id}/end`).expect(200);
    const endedBody = ended.body as CreateCallResponse;
    expect(endedBody.status).toBe('ended');
    expect(endedBody.endedBy).toBe(TEST_USER_A);

    // 10) Verify final state in call_events.
    const eventsRes = await alice.get(`/calls/${call.id}/events`).expect(200);
    const eventsBody = eventsRes.body as EventsResponse;
    const types = eventsBody.events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'created',
        'invited',
        'accepted',
        'joined',
        'ended',
      ]),
    );
    const endedEvent = eventsBody.events.find((e) => e.type === 'ended');
    expect(endedEvent?.userId).toBe(TEST_USER_A);
  });

  it('2. rejects a non-participant from joining the call', async () => {
    const alice = authedRequest(app, tokenA);
    const mallory = authedRequest(app, tokenC);

    const created = await alice
      .post('/calls')
      .send({ invitees: [TEST_USER_B] })
      .expect(201);
    const call = created.body as CreateCallResponse;

    const malloryJoin = await mallory
      .post(`/calls/${call.id}/join`)
      .expect(403);
    expect(bodyMessage(malloryJoin.body)).toMatch(/not a participant/i);

    const malloryTurn = await mallory
      .get(`/calls/${call.id}/turn-credentials`)
      .expect(403);
    expect(bodyMessage(malloryTurn.body)).toMatch(/not a participant/i);

    const mallorySfu = await mallory
      .post(`/calls/${call.id}/sfu-token`)
      .expect(403);
    expect(bodyMessage(mallorySfu.body)).toMatch(/not a participant/i);
  });

  it('3. rejects joining after the call is ended', async () => {
    const alice = authedRequest(app, tokenA);
    const bob = authedRequest(app, tokenB);

    const created = await alice.post('/calls').send({}).expect(201);
    const call = created.body as CreateCallResponse;
    const callId = call.id;

    await alice
      .post(`/calls/${callId}/invite`)
      .send({ inviteeId: TEST_USER_B })
      .expect(200);
    await bob.post(`/calls/${callId}/accept`).expect(200);

    await alice.post(`/calls/${callId}/end`).expect(200);

    const joinAfter = await bob.post(`/calls/${callId}/join`).expect(409);
    expect(bodyMessage(joinAfter.body)).toMatch(/ended/i);

    const turnAfter = await bob
      .get(`/calls/${callId}/turn-credentials`)
      .expect(409);
    expect(bodyMessage(turnAfter.body)).toMatch(/ended/i);

    const sfuAfter = await bob.post(`/calls/${callId}/sfu-token`).expect(409);
    expect(bodyMessage(sfuAfter.body)).toMatch(/ended/i);
  });

  it('4. delivers peer:joined and peer:left events to participants', async () => {
    const alice = authedRequest(app, tokenA);
    const bob = authedRequest(app, tokenB);

    const created = await alice
      .post('/calls')
      .send({ invitees: [TEST_USER_B] })
      .expect(201);
    const call = created.body as CreateCallResponse;
    await bob.post(`/calls/${call.id}/accept`).expect(200);

    const sockA = await connectWsClient({
      url: boot.baseUrl,
      namespace: boot.namespace,
    });
    const sockB = await connectWsClient({
      url: boot.baseUrl,
      namespace: boot.namespace,
    });

    const peerJoinsA: Array<{ userId: string; roomId: string }> = [];
    const peerLeftsA: Array<{ userId: string; roomId: string }> = [];
    sockA.socket.on('peer:joined', (e: { userId: string; roomId: string }) =>
      peerJoinsA.push(e),
    );
    sockA.socket.on('peer:left', (e: { userId: string; roomId: string }) =>
      peerLeftsA.push(e),
    );

    const aExisting = new Promise<{ members: unknown[] }>((resolve) =>
      sockA.socket.once('existing-users', resolve),
    );
    sockA.socket.emit('join', { roomId: call.roomId, userId: TEST_USER_A });
    await aExisting;

    const bExisting = new Promise<{ members: unknown[] }>((resolve) =>
      sockB.socket.once('existing-users', resolve),
    );
    sockB.socket.emit('join', { roomId: call.roomId, userId: TEST_USER_B });
    await bExisting;

    await waitFor(() => peerJoinsA.length >= 1, 2000, 10, 'A peer:joined');
    expect(peerJoinsA[0]).toMatchObject({
      userId: TEST_USER_B,
      roomId: call.roomId,
    });

    sockB.close();
    await waitFor(() => peerLeftsA.length >= 1, 2000, 10, 'A peer:left');
    expect(peerLeftsA[0]).toMatchObject({
      userId: TEST_USER_B,
      roomId: call.roomId,
    });

    sockA.close();
    // Avoid the afterEach reset racing with this finally.
    await delay(20);
  });

  it('5. returns valid TURN credentials with TTL > now', async () => {
    const alice = authedRequest(app, tokenA);
    const bob = authedRequest(app, tokenB);

    const created = await alice
      .post('/calls')
      .send({ invitees: [TEST_USER_B] })
      .expect(201);
    const call = created.body as CreateCallResponse;
    await bob.post(`/calls/${call.id}/accept`).expect(200);

    const before = Math.floor(Date.now() / 1000);
    const res = await alice
      .get(`/calls/${call.id}/turn-credentials`)
      .expect(200);
    const body = res.body as TurnResponse;
    const expiresAtMs = new Date(body.expiresAt).getTime();
    expect(expiresAtMs).toBeGreaterThan(Date.now());
    expect(body.ttl).toBeGreaterThan(0);
    expect(Math.floor(expiresAtMs / 1000)).toBeGreaterThanOrEqual(
      before + body.ttl - 1,
    );
    expect(body.username).toContain(TEST_USER_A);
    expect(body.credential).toBeTruthy();
    expect(body.urls.every((u) => u.startsWith('turn:'))).toBe(true);
  });

  it('6. returns a SFU token (mocked) with token and url', async () => {
    const alice = authedRequest(app, tokenA);
    const bob = authedRequest(app, tokenB);

    const created = await alice
      .post('/calls')
      .send({ invitees: [TEST_USER_B] })
      .expect(201);
    const call = created.body as CreateCallResponse;
    await bob.post(`/calls/${call.id}/accept`).expect(200);

    const res = await alice.post(`/calls/${call.id}/sfu-token`).expect(200);
    const body = res.body as SfuResponse;
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(typeof body.url).toBe('string');
    expect(body.url).toMatch(/^wss?:\/\//);
    expect(body.callId).toBe(call.id);
    expect(body.userId).toBe(TEST_USER_A);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('7. rejects SFU token request from a non-participant', async () => {
    const alice = authedRequest(app, tokenA);
    const mallory = authedRequest(app, tokenC);

    const created = await alice
      .post('/calls')
      .send({ invitees: [TEST_USER_B] })
      .expect(201);
    const call = created.body as CreateCallResponse;

    const sfuCallsBefore = boot.sfuService.calls.length;
    const res = await mallory.post(`/calls/${call.id}/sfu-token`).expect(403);
    expect(bodyMessage(res.body)).toMatch(/not a participant/i);
    expect(boot.sfuService.calls.length).toBe(sfuCallsBefore);
  });
});
