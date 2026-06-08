import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { loadConfig } from '../src/config/app.config';
import type {
  ExistingUsersEvent,
  SignalEvent,
  UserJoinedEvent,
  UserLeftEvent,
} from '../src/signaling/signaling.types';

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const waitFor = async <T>(
  fn: () => T | undefined,
  timeoutMs = 3000,
  intervalMs = 10,
  label = 'condition',
): Promise<T> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = fn();
    if (value !== undefined && value !== false) return value;
    await wait(intervalMs);
  }
  throw new Error(`waitFor: timed out waiting for ${label}`);
};

describe('Signaling gateway (e2e)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let namespace: string;
  let clients: ClientSocket[] = [];

  const connect = (): Promise<ClientSocket> => {
    const socket = ioClient(`${baseUrl}${namespace}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    clients.push(socket);
    return new Promise((resolve, reject) => {
      const onConnect = () => {
        socket.off('connect_error', onError);
        resolve(socket);
      };
      const onError = (err: Error) => {
        socket.off('connect', onConnect);
        reject(err);
      };
      socket.once('connect', onConnect);
      socket.once('connect_error', onError);
    });
  };

  const joinRoom = async (
    socket: ClientSocket,
    roomId: string,
    userId: string,
  ) => {
    const existing = new Promise<ExistingUsersEvent>((resolve) =>
      socket.once('existing-users', resolve),
    );
    socket.emit('join', { roomId, userId });
    return existing;
  };

  const sendSignal = async (
    sender: ClientSocket,
    receiver: ClientSocket,
    event: 'offer' | 'answer' | 'ice-candidate',
    payload: { roomId: string; signal: unknown },
  ): Promise<SignalEvent> => {
    const received = new Promise<SignalEvent>((resolve) =>
      receiver.once('signal', resolve),
    );
    sender.emit(event, { from: sender.id, to: receiver.id, ...payload });
    return received;
  };

  beforeAll(async () => {
    const config = loadConfig();
    namespace = config.signaling.namespace;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);
    const httpServer = app.getHttpServer() as unknown as import('http').Server;
    const addr = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    clients = [];
    await app.close();
  });

  afterEach(() => {
    for (const c of clients) c.disconnect();
    clients = [];
  });

  it('joins two clients in the same room and exchanges signals', async () => {
    const a = await connect();
    const b = await connect();

    const aExisting = joinRoom(a, 'room-1', 'alice');
    await waitFor(() => Boolean(a.connected && a.id), 1000, 1, 'a connected');
    const aGot = await aExisting;
    expect(aGot.socketIds).toEqual([]);
    expect(aGot.members).toEqual([]);

    const bGotUserJoined = new Promise<UserJoinedEvent>((resolve) =>
      a.once('user-joined', resolve),
    );

    const bExisting = joinRoom(b, 'room-1', 'bob');
    const aJoinEvent = await bGotUserJoined;
    expect(aJoinEvent).toMatchObject({ userId: 'bob' });

    const bExistingPayload = await bExisting;
    expect(bExistingPayload.socketIds).toEqual([a.id]);
    expect(bExistingPayload.members[0]).toMatchObject({
      userId: 'alice',
      socketId: a.id,
    });

    const aGotOffer = sendSignal(a, b, 'offer', {
      roomId: 'room-1',
      signal: { sdp: 'v=0...offer...' },
    });
    const bOffer = await aGotOffer;
    expect(bOffer).toMatchObject({
      from: a.id,
      to: b.id,
      roomId: 'room-1',
      type: 'offer',
    });
    expect(bOffer.signal).toEqual({ sdp: 'v=0...offer...' });

    const bGotAnswer = sendSignal(b, a, 'answer', {
      roomId: 'room-1',
      signal: { sdp: 'v=0...answer...' },
    });
    const aAnswer = await bGotAnswer;
    expect(aAnswer).toMatchObject({
      from: b.id,
      to: a.id,
      roomId: 'room-1',
      type: 'answer',
    });

    const aGotIce = sendSignal(a, b, 'ice-candidate', {
      roomId: 'room-1',
      signal: { candidate: 'cand-1' },
    });
    const bIce = await aGotIce;
    expect(bIce).toMatchObject({
      from: a.id,
      to: b.id,
      roomId: 'room-1',
      type: 'ice-candidate',
    });
    expect(bIce.signal).toEqual({ candidate: 'cand-1' });
  });

  it('notifies the room when a user disconnects', async () => {
    const a = await connect();
    const b = await connect();
    const bId = b.id;

    const leftEvents: UserLeftEvent[] = [];
    a.on('user-left', (payload: UserLeftEvent) => leftEvents.push(payload));

    await joinRoom(a, 'room-2', 'alice');
    await joinRoom(b, 'room-2', 'bob');

    await wait(50);
    b.disconnect();

    await waitFor(() => leftEvents.length > 0, 3000, 10, 'user-left event');
    expect(leftEvents[0]).toMatchObject({
      socketId: bId,
      userId: 'bob',
      roomId: 'room-2',
    });
  });

  it('keeps rooms independent', async () => {
    const a = await connect();
    const b = await connect();

    const aExisting = joinRoom(a, 'room-A', 'alice');
    await aExisting;
    const bExisting = joinRoom(b, 'room-B', 'bob');
    const bGot = await bExisting;
    expect(bGot.socketIds).toEqual([]);

    const aUserJoined = new Promise<UserJoinedEvent>((resolve) =>
      a.once('user-joined', resolve),
    );
    void aUserJoined;
    const c = await connect();
    const cExisting = joinRoom(c, 'room-C', 'carol');
    await cExisting;
    await wait(100);
    // alice should NOT receive user-joined for carol (different room)
    const received = await Promise.race([
      new Promise<UserJoinedEvent>((resolve) =>
        a.once('user-joined', resolve),
      ).then(() => true),
      wait(200).then(() => false),
    ]);
    expect(received).toBe(false);
  });

  it('rejects an offer for a peer that is not in the room', async () => {
    const a = await connect();
    await joinRoom(a, 'room-3', 'alice');

    const errorEvent = new Promise<{ message: string }>((resolve) =>
      a.once('exception', resolve),
    );
    a.emit('offer', {
      roomId: 'room-3',
      from: a.id,
      to: 'sock-MISSING',
      signal: {},
    });
    const err = await errorEvent;
    expect(err.message).toMatch(/not in room/);
  });

  it('rejects a join with empty roomId or userId', async () => {
    const a = await connect();
    const err1 = new Promise<{ message: string }>((resolve) =>
      a.once('exception', resolve),
    );
    a.emit('join', { roomId: '', userId: 'alice' });
    const e1 = await err1;
    expect(e1.message).toMatch(/Invalid join/);

    const b = await connect();
    const err2 = new Promise<{ message: string }>((resolve) =>
      b.once('exception', resolve),
    );
    b.emit('join', { roomId: 'r', userId: '' });
    const e2 = await err2;
    expect(e2.message).toMatch(/Invalid join/);
  });
});
