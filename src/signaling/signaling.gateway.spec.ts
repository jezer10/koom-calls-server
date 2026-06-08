import { WsException } from '@nestjs/websockets';
import { SignalingGateway } from './signaling.gateway';
import { RoomRegistry } from './room.registry';
import type { JoinPayload, SignalPayload } from './signaling.types';
import * as Io from 'socket.io';

type SocketMock = Io.Socket & {
  __emitted: Array<{ event: string; payload: unknown }>;
  __broadcast: Array<{ room: string; event: string; payload: unknown }>;
};

function makeSocket(id: string): SocketMock {
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const broadcast: Array<{ room: string; event: string; payload: unknown }> =
    [];
  const joined: string[] = [];

  const socket = {
    id,
    data: {} as Record<string, unknown>,
    emit(event: string, payload: unknown) {
      emitted.push({ event, payload });
      return true;
    },
    to(room: string) {
      const api = {
        emit: (event: string, payload: unknown) => {
          broadcast.push({ room, event, payload });
          return true;
        },
      };
      return api;
    },
    join(room: string) {
      joined.push(room);
      return Promise.resolve();
    },
    __emitted: emitted,
    __broadcast: broadcast,
  } as unknown as SocketMock;

  void joined;
  return socket;
}

function makeNamespace(): {
  ns: Io.Namespace;
  sent: Array<{ target: string; event: string; payload: unknown }>;
} {
  const sent: Array<{ target: string; event: string; payload: unknown }> = [];
  const ns = {
    to(target: string) {
      return {
        emit(event: string, payload: unknown) {
          sent.push({ target, event, payload });
          return true;
        },
      };
    },
  } as unknown as Io.Namespace;
  return { ns, sent };
}

describe('SignalingGateway', () => {
  let gateway: SignalingGateway;
  let registry: RoomRegistry;
  let server: Io.Namespace;
  let sent: Array<{ target: string; event: string; payload: unknown }>;

  beforeEach(() => {
    registry = new RoomRegistry();
    gateway = new SignalingGateway(registry);
    const ns = makeNamespace();
    server = ns.ns;
    sent = ns.sent;
    gateway.server = server;
  });

  describe('handleConnection / handleDisconnect', () => {
    it('logs connection and does not throw', () => {
      expect(() =>
        gateway.handleConnection({ id: 'x' } as Io.Socket),
      ).not.toThrow();
    });

    it('broadcasts user-left for the rooms the socket was in', () => {
      registry.join('room-1', 'sock-A', 'alice');
      registry.join('room-2', 'sock-A', 'alice');
      gateway.handleDisconnect({ id: 'sock-A' } as Io.Socket);
      expect(sent).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ target: 'room-1', event: 'user-left' }),
          expect.objectContaining({ target: 'room-2', event: 'user-left' }),
        ]),
      );
    });

    it('does nothing for unknown sockets', () => {
      gateway.handleDisconnect({ id: 'unknown' } as Io.Socket);
      expect(sent).toHaveLength(0);
    });
  });

  describe('handleJoin()', () => {
    it('emits existing-users to the joiner and user-joined to the room', () => {
      registry.join('room-1', 'sock-A', 'alice');
      const socket = makeSocket('sock-B');

      const result = gateway.handleJoin(
        { roomId: 'room-1', userId: 'bob' },
        socket,
      );

      expect(result).toEqual({ ok: true, roomId: 'room-1', userId: 'bob' });
      expect(socket.__emitted).toHaveLength(1);
      const existingPayload = socket.__emitted[0];
      expect(existingPayload?.event).toBe('existing-users');
      const payload = existingPayload?.payload as {
        socketIds: string[];
        members: Array<{ socketId: string; userId: string; joinedAt: number }>;
      };
      expect(payload.socketIds).toEqual(['sock-A']);
      expect(payload.members).toHaveLength(1);
      expect(payload.members[0]?.socketId).toBe('sock-A');
      expect(payload.members[0]?.userId).toBe('alice');
      expect(typeof payload.members[0]?.joinedAt).toBe('number');
      expect(socket.__broadcast).toEqual([
        {
          room: 'room-1',
          event: 'user-joined',
          payload: { socketId: 'sock-B', userId: 'bob' },
        },
      ]);
    });

    it('rejects invalid payloads with WsException', () => {
      const socket = makeSocket('sock-B');
      expect(() =>
        gateway.handleJoin({ roomId: '', userId: 'bob' }, socket),
      ).toThrow(WsException);
    });

    it('rejects non-object payloads', () => {
      const socket = makeSocket('sock-B');
      expect(() =>
        gateway.handleJoin('garbage' as unknown as JoinPayload, socket),
      ).toThrow(WsException);
    });
  });

  describe('forward() (offer / answer / ice-candidate)', () => {
    beforeEach(() => {
      registry.join('room-1', 'sock-A', 'alice');
      registry.join('room-1', 'sock-B', 'bob');
    });

    const cases: Array<{
      label: 'offer' | 'answer' | 'ice-candidate';
      payload: SignalPayload;
      method: 'handleOffer' | 'handleAnswer' | 'handleIceCandidate';
    }> = [
      {
        label: 'offer',
        method: 'handleOffer',
        payload: {
          roomId: 'room-1',
          from: 'sock-A',
          to: 'sock-B',
          signal: { sdp: 'v=0...' },
        },
      },
      {
        label: 'answer',
        method: 'handleAnswer',
        payload: {
          roomId: 'room-1',
          from: 'sock-B',
          to: 'sock-A',
          signal: { sdp: 'v=0...' },
        },
      },
      {
        label: 'ice-candidate',
        method: 'handleIceCandidate',
        payload: {
          roomId: 'room-1',
          from: 'sock-A',
          to: 'sock-B',
          signal: { candidate: 'cand-1' },
        },
      },
    ];

    it.each(cases)(
      'forwards $label to target peer',
      ({ label, method, payload }) => {
        const socket = makeSocket('sock-A');
        const result = gateway[method](payload, socket);

        expect(result).toEqual({ ok: true, to: payload.to, type: label });
        expect(sent).toEqual([
          {
            target: payload.to,
            event: 'signal',
            payload: {
              from: payload.from,
              to: payload.to,
              signal: payload.signal,
              roomId: payload.roomId,
              type: label,
            },
          },
        ]);
      },
    );

    it('uses client.id as from when payload.from is empty', () => {
      const socket = makeSocket('sock-A');
      const result = gateway.handleOffer(
        {
          roomId: 'room-1',
          from: '',
          to: 'sock-B',
          signal: { sdp: 'v=0...' },
        },
        socket,
      );
      expect(result.ok).toBe(true);
      expect(sent[0]?.payload).toMatchObject({ from: 'sock-A' });
    });

    it('rejects invalid payloads', () => {
      const socket = makeSocket('sock-A');
      expect(() =>
        gateway.handleOffer(
          { roomId: 'room-1', from: 'sock-A' } as SignalPayload,
          socket,
        ),
      ).toThrow(WsException);
    });

    it('rejects when target peer is not in the room', () => {
      const socket = makeSocket('sock-A');
      expect(() =>
        gateway.handleOffer(
          {
            roomId: 'room-1',
            from: 'sock-A',
            to: 'sock-MISSING',
            signal: {},
          },
          socket,
        ),
      ).toThrow(/not in room/);
    });
  });
});
