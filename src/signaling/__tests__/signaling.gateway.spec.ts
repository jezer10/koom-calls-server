import { WsException } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type * as Io from 'socket.io';
import { SignalingGateway } from '../signaling.gateway';
import { RoomRegistry } from '../room.registry';
import {
  type CallsEventBus,
  type CallAuthorizationResult,
} from '../calls-event-bus';

const JWT_SECRET = 'gateway-test-secret';

function makeConfigService(): ConfigService {
  return {
    getOrThrow: <T = string>(key: string): T => {
      if (key === 'signaling.namespace') return '/signaling' as T;
      if (key === 'auth.secret') return JWT_SECRET as T;
      throw new Error(`unexpected key ${key}`);
    },
    get: <T = string>(key: string): T | undefined => {
      if (key === 'app.corsOrigin') return '*' as T;
      return undefined;
    },
  } as unknown as ConfigService;
}

class FakeCallsEventBus implements CallsEventBus {
  events: Array<{ callId: string; event: string; actorUserId: string }> = [];
  participantMap = new Map<string, Map<string, CallAuthorizationResult>>();

  onCallEvent(
    callId: string,
    event:
      | 'call:ringing'
      | 'call:accept'
      | 'call:reject'
      | 'call:cancel'
      | 'call:end',
    actorUserId: string,
  ): void {
    this.events.push({ callId, event, actorUserId });
  }

  isParticipant(callId: string, userId: string): CallAuthorizationResult {
    return (
      this.participantMap.get(callId)?.get(userId) ?? {
        authorized: false,
        reason: 'not-registered',
      }
    );
  }

  setParticipant(
    callId: string,
    userId: string,
    result: CallAuthorizationResult,
  ): void {
    let inner = this.participantMap.get(callId);
    if (!inner) {
      inner = new Map<string, CallAuthorizationResult>();
      this.participantMap.set(callId, inner);
    }
    inner.set(userId, result);
  }
}

type HandshakeMock = {
  auth?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

type SentEntry = { target: string; event: string; payload: unknown };

type NamespaceMock = {
  to: jest.Mock;
  emit: jest.Mock;
  sent: SentEntry[];
  use: jest.Mock;
};

interface TestContext {
  gateway: SignalingGateway;
  registry: RoomRegistry;
  bus: FakeCallsEventBus;
  server: NamespaceMock;
  makeSocket: (
    id: string,
    userId?: string,
    handshake?: HandshakeMock,
  ) => Io.Socket & { __toSent: SentEntry[] };
}

function setupContext(): TestContext {
  const registry = new RoomRegistry();
  const bus = new FakeCallsEventBus();
  const sent: SentEntry[] = [];
  const ns: NamespaceMock = {
    to: jest.fn(),
    emit: jest.fn(),
    sent,
    use: jest.fn(),
  };
  ns.to.mockImplementation((target: string) => ({
    emit: (event: string, payload: unknown) => {
      sent.push({ target, event, payload });
      return true;
    },
  }));
  ns.emit.mockImplementation((event: string, payload: unknown) => {
    sent.push({ target: '<namespace>', event, payload });
    return true;
  });

  const gateway = new SignalingGateway(
    registry,
    bus,
    makeConfigService(),
  );
  gateway.server = ns as unknown as Io.Namespace;

  const makeSocket = (
    id: string,
    userId?: string,
    handshake: HandshakeMock = {},
  ): Io.Socket & { __toSent: SentEntry[] } => {
    const toSent: SentEntry[] = [];
    const socket = {
      id,
      data: userId ? { userId, token: 'x' } : {},
      emit: jest.fn(),
      to: jest.fn().mockImplementation((room: string) => ({
        emit: (event: string, payload: unknown) => {
          toSent.push({ target: room, event, payload });
          return true;
        },
      })),
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      handshake,
      __toSent: toSent,
    };
    return socket as unknown as Io.Socket & { __toSent: SentEntry[] };
  };

  return { gateway, registry, bus, server: ns, makeSocket };
}

describe('SignalingGateway', () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = setupContext();
  });

  describe('JWT handshake (via afterInit)', () => {
    type NsFake = { use: jest.Mock };
    const fakeNsFactory = (): NsFake => ({ use: jest.fn() });

    it('rejects a socket without a JWT', () => {
      const fakeNs = fakeNsFactory();
      ctx.gateway.afterInit(fakeNs as unknown as Io.Namespace);
      expect(fakeNs.use).toHaveBeenCalled();
      const calls = fakeNs.use.mock.calls as Array<[unknown]>;
      const registeredMw = calls[0]?.[0] as
        | ((socket: Io.Socket, next: (err?: Error) => void) => void)
        | undefined;
      expect(typeof registeredMw).toBe('function');

      const socket = ctx.makeSocket('sock-1');
      const next = jest.fn();
      registeredMw?.(socket, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect((socket.data as { userId?: string }).userId).toBeUndefined();
    });

    it('accepts a socket with a valid JWT and sets userId', () => {
      const fakeNs = fakeNsFactory();
      ctx.gateway.afterInit(fakeNs as unknown as Io.Namespace);
      const calls = fakeNs.use.mock.calls as Array<[unknown]>;
      const registeredMw = calls[0]?.[0] as
        | ((socket: Io.Socket, next: (err?: Error) => void) => void)
        | undefined;

      const token = jwt.sign({ sub: 'alice' }, JWT_SECRET);
      const socket = ctx.makeSocket('sock-1', undefined, {
        auth: { token },
      });
      const next = jest.fn();
      registeredMw?.(socket, next);
      expect(next).toHaveBeenCalledWith();
      expect((socket.data as { userId?: string }).userId).toBe('alice');
    });
  });

  describe('handleConnection / handleDisconnect', () => {
    it('does not throw on connection', () => {
      expect(() =>
        ctx.gateway.handleConnection(
          ctx.makeSocket('x') as unknown as Io.Socket,
        ),
      ).not.toThrow();
    });

    it('emits peer:left to other room members on disconnect', () => {
      ctx.registry.join('call-1', 'sock-A', 'alice');
      ctx.registry.join('call-1', 'sock-B', 'bob');
      ctx.gateway.handleDisconnect(ctx.makeSocket('sock-A', 'alice'));

      const matchers = [
        expect.objectContaining({
          target: 'call-1',
          event: 'peer:left',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          payload: expect.objectContaining({
            callId: 'call-1',
            userId: 'alice',
            socketId: 'sock-A',
          }),
        }),
      ];
      expect(ctx.server.sent).toEqual(expect.arrayContaining(matchers));
    });
  });

  describe('emitCallInvite()', () => {
    it('does not deliver to non-participants (forbidden)', async () => {
      ctx.bus.setParticipant('call-1', 'alice', { authorized: true });
      ctx.bus.setParticipant('call-1', 'bob', { authorized: false });

      const result = await ctx.gateway.emitCallInvite(
        'call-1',
        'alice',
        ['bob', 'carol'],
        'video',
      );
      expect(result.delivered).toEqual([]);
      expect(result.skipped).toEqual(['bob', 'carol']);
      expect(ctx.server.sent).toHaveLength(0);
    });

    it('delivers to participants (delivered)', async () => {
      ctx.bus.setParticipant('call-1', 'alice', { authorized: true });
      ctx.bus.setParticipant('call-1', 'bob', { authorized: true });

      const result = await ctx.gateway.emitCallInvite(
        'call-1',
        'alice',
        ['bob', 'carol'],
        'audio',
      );
      expect(result.delivered).toEqual(['bob']);
      expect(result.skipped).toEqual(['carol']);
      expect(ctx.server.sent).toEqual([
        {
          target: 'user:bob',
          event: 'call:invite',
          payload: { callId: 'call-1', from: 'alice', type: 'audio' },
        },
      ]);
    });

    it('treats registry members as participants (fallback)', async () => {
      ctx.registry.join('call-1', 'sock-X', 'dave');
      const result = await ctx.gateway.emitCallInvite(
        'call-1',
        'alice',
        ['dave', 'erin'],
        'video',
      );
      expect(result.delivered).toEqual(['dave']);
      expect(result.skipped).toEqual(['erin']);
    });
  });

  describe('call:ringing / call:accept / call:reject / call:cancel / call:end', () => {
    const cases: Array<{
      label:
        | 'call:ringing'
        | 'call:accept'
        | 'call:reject'
        | 'call:cancel'
        | 'call:end';
      method:
        | 'handleCallRinging'
        | 'handleCallAccept'
        | 'handleCallReject'
        | 'handleCallCancel'
        | 'handleCallEnd';
    }> = [
      { label: 'call:ringing', method: 'handleCallRinging' },
      { label: 'call:accept', method: 'handleCallAccept' },
      { label: 'call:reject', method: 'handleCallReject' },
      { label: 'call:cancel', method: 'handleCallCancel' },
      { label: 'call:end', method: 'handleCallEnd' },
    ];

    it.each(cases)(
      '$label: forbidden for non-participants',
      async ({ method }) => {
        const socket = ctx.makeSocket('sock-A', 'alice');
        await expect(
          ctx.gateway[method](
            { callId: 'call-1' },
            socket as unknown as Io.Socket,
          ),
        ).rejects.toBeInstanceOf(WsException);
      },
    );

    it.each(cases)(
      '$label: delivered to the call room and invokes the bus',
      async ({ label, method }) => {
        ctx.bus.setParticipant('call-1', 'alice', { authorized: true });
        const socket = ctx.makeSocket('sock-A', 'alice');
        const result = await ctx.gateway[method]({ callId: 'call-1' }, socket);
        expect(result).toEqual({ ok: true, callId: 'call-1', event: label });
        expect(ctx.bus.events).toEqual([
          { callId: 'call-1', event: label, actorUserId: 'alice' },
        ]);
        expect(ctx.server.sent).toEqual([
          {
            target: 'call-1',
            event: 'call:event',
            payload: {
              callId: 'call-1',
              from: 'alice',
              event: label,
            },
          },
        ]);
      },
    );

    it.each(cases)(
      '$label: throws WsException with "invalid payload" on bad payload',
      async ({ method }) => {
        const socket = ctx.makeSocket('sock-A', 'alice');
        await expect(
          ctx.gateway[method]({}, socket as unknown as Io.Socket),
        ).rejects.toBeInstanceOf(WsException);
      },
    );
  });

  describe('sfu:* (placeholder)', () => {
    it('sfu:join-room requires accepted/active state', async () => {
      const socket = ctx.makeSocket('sock-A', 'alice');
      ctx.bus.setParticipant('call-1', 'alice', {
        authorized: true,
        state: 'ringing',
      });
      await expect(
        ctx.gateway.handleSfuJoinRoom(
          { callId: 'call-1' },
          socket as unknown as Io.Socket,
        ),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('sfu:join-room returns pending-m3 in accepted state', async () => {
      const socket = ctx.makeSocket('sock-A', 'alice');
      ctx.bus.setParticipant('call-1', 'alice', {
        authorized: true,
        state: 'accepted',
      });
      const result = await ctx.gateway.handleSfuJoinRoom(
        { callId: 'call-1' },
        socket,
      );
      expect(result).toEqual({ status: 'pending-m3' });
    });

    it('sfu:join-room returns pending-m3 in active state', async () => {
      const socket = ctx.makeSocket('sock-A', 'alice');
      ctx.bus.setParticipant('call-1', 'alice', {
        authorized: true,
        state: 'active',
      });
      const result = await ctx.gateway.handleSfuJoinRoom(
        { callId: 'call-1' },
        socket,
      );
      expect(result).toEqual({ status: 'pending-m3' });
    });

    it('sfu:publish-track returns pending-m3 when authorized', async () => {
      const socket = ctx.makeSocket('sock-A', 'alice');
      ctx.bus.setParticipant('call-1', 'alice', {
        authorized: true,
        state: 'accepted',
      });
      const result = await ctx.gateway.handleSfuPublishTrack(
        { callId: 'call-1' },
        socket,
      );
      expect(result).toEqual({ status: 'pending-m3' });
    });

    it('sfu:subscribe-track returns pending-m3 when authorized', async () => {
      const socket = ctx.makeSocket('sock-A', 'alice');
      ctx.bus.setParticipant('call-1', 'alice', { authorized: true });
      const result = await ctx.gateway.handleSfuSubscribeTrack(
        { callId: 'call-1' },
        socket,
      );
      expect(result).toEqual({ status: 'pending-m3' });
    });

    it('sfu handlers reject non-participants', async () => {
      const socket = ctx.makeSocket('sock-A', 'alice');
      ctx.bus.setParticipant('call-1', 'alice', { authorized: false });
      await expect(
        ctx.gateway.handleSfuJoinRoom(
          { callId: 'call-1' },
          socket as unknown as Io.Socket,
        ),
      ).rejects.toBeInstanceOf(WsException);
      await expect(
        ctx.gateway.handleSfuPublishTrack(
          { callId: 'call-1' },
          socket as unknown as Io.Socket,
        ),
      ).rejects.toBeInstanceOf(WsException);
      await expect(
        ctx.gateway.handleSfuSubscribeTrack(
          { callId: 'call-1' },
          socket as unknown as Io.Socket,
        ),
      ).rejects.toBeInstanceOf(WsException);
    });
  });

  describe('peer:join / peer:leave / peer:reconnect', () => {
    it('peer:join adds the socket to the room and emits peer:joined', async () => {
      ctx.bus.setParticipant('call-1', 'alice', { authorized: true });
      const socket = ctx.makeSocket('sock-A', 'alice');
      const result = await ctx.gateway.handlePeerJoin(
        { callId: 'call-1', from: 'alice', to: ['bob'], type: 'video' },
        socket,
      );
      expect(result.ok).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(socket.join).toHaveBeenCalledWith('call-1');
      expect(socket.__toSent).toEqual([
        {
          target: 'call-1',
          event: 'peer:joined',
          payload: {
            callId: 'call-1',
            userId: 'alice',
            socketId: 'sock-A',
          },
        },
      ]);
      expect(ctx.registry.members('call-1')).toHaveLength(1);
    });

    it('peer:join forbids the user from joining as someone else', async () => {
      const socket = ctx.makeSocket('sock-A', 'alice');
      await expect(
        ctx.gateway.handlePeerJoin(
          { callId: 'call-1', from: 'mallory', to: ['bob'], type: 'video' },
          socket as unknown as Io.Socket,
        ),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('peer:join forbids non-participants', async () => {
      const socket = ctx.makeSocket('sock-A', 'alice');
      await expect(
        ctx.gateway.handlePeerJoin(
          { callId: 'call-1', from: 'alice', to: ['bob'], type: 'video' },
          socket as unknown as Io.Socket,
        ),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('peer:leave removes the member and emits peer:left', () => {
      ctx.registry.join('call-1', 'sock-A', 'alice');
      const socket = ctx.makeSocket('sock-A', 'alice');
      const result = ctx.gateway.handlePeerLeave({ callId: 'call-1' }, socket);
      expect(result).toEqual({ ok: true, callId: 'call-1' });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(socket.leave).toHaveBeenCalledWith('call-1');
      expect(ctx.registry.members('call-1')).toHaveLength(0);
      expect(ctx.server.sent).toEqual([
        {
          target: 'call-1',
          event: 'peer:left',
          payload: {
            callId: 'call-1',
            userId: 'alice',
            socketId: 'sock-A',
          },
        },
      ]);
    });

    it('peer:leave throws when the member is not the current user', () => {
      ctx.registry.join('call-1', 'sock-A', 'alice');
      const socket = ctx.makeSocket('sock-A', 'mallory');
      expect(() =>
        ctx.gateway.handlePeerLeave(
          { callId: 'call-1' },
          socket as unknown as Io.Socket,
        ),
      ).toThrow(/forbidden/);
    });

    it('peer:reconnect emits peer:reconnecting when user is a participant', () => {
      ctx.registry.join('call-1', 'sock-A', 'alice');
      const socket = ctx.makeSocket('sock-A', 'alice');
      const result = ctx.gateway.handlePeerReconnect(
        { callId: 'call-1' },
        socket,
      );
      expect(result).toEqual({ ok: true, callId: 'call-1' });
      expect(ctx.server.sent).toEqual([
        {
          target: 'call-1',
          event: 'peer:reconnecting',
          payload: {
            callId: 'call-1',
            userId: 'alice',
            socketId: 'sock-A',
          },
        },
      ]);
    });

    it('peer:reconnect throws when user is not a participant', () => {
      const socket = ctx.makeSocket('sock-A', 'alice');
      expect(() =>
        ctx.gateway.handlePeerReconnect(
          { callId: 'call-1' },
          socket as unknown as Io.Socket,
        ),
      ).toThrow(/forbidden/);
    });
  });

  describe('rate limit enforcement (inline)', () => {
    it('drops the 31st event in 1 second for the same socket', async () => {
      ctx.bus.setParticipant('call-1', 'alice', { authorized: true });
      const socket = ctx.makeSocket('sock-A', 'alice');
      const handler = ctx.gateway.handleCallRinging.bind(ctx.gateway);
      for (let i = 0; i < 30; i++) {
        await handler({ callId: 'call-1' }, socket);
      }
      await expect(
        handler({ callId: 'call-1' }, socket as unknown as Io.Socket),
      ).rejects.toBeInstanceOf(WsException);
    });

    it('enforces rate limit across different event types for the same socket', async () => {
      ctx.bus.setParticipant('call-1', 'alice', { authorized: true });
      const socket = ctx.makeSocket('sock-A', 'alice');
      for (let i = 0; i < 30; i++) {
        await ctx.gateway.handleCallRinging({ callId: 'call-1' }, socket);
      }
      await expect(
        ctx.gateway.handleCallAccept(
          { callId: 'call-1' },
          socket as unknown as Io.Socket,
        ),
      ).rejects.toBeInstanceOf(WsException);
    });
  });
});
