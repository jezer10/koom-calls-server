import { RoomRegistry } from './room.registry';

describe('RoomRegistry', () => {
  let registry: RoomRegistry;

  beforeEach(() => {
    registry = new RoomRegistry();
  });

  describe('join()', () => {
    it('returns the member and no existing peers on first join', () => {
      const result = registry.join('room-1', 'sock-A', 'alice');
      expect(result.selfSocketId).toBe('sock-A');
      expect(result.existingPeers).toEqual([]);
    });

    it('returns existing peers when a second user joins', () => {
      registry.join('room-1', 'sock-A', 'alice');
      const result = registry.join('room-1', 'sock-B', 'bob');
      expect(result.existingPeers).toHaveLength(1);
      expect(result.existingPeers[0]).toMatchObject({
        socketId: 'sock-A',
        userId: 'alice',
      });
    });

    it('keeps rooms isolated', () => {
      registry.join('room-1', 'sock-A', 'alice');
      const r2 = registry.join('room-2', 'sock-B', 'bob');
      expect(r2.existingPeers).toEqual([]);
      expect(registry.members('room-1')).toHaveLength(1);
      expect(registry.members('room-2')).toHaveLength(1);
    });

    it('does not list the joining socket as an existing peer', () => {
      registry.join('room-1', 'sock-A', 'alice');
      const result = registry.join('room-1', 'sock-A', 'alice-2');
      expect(result.existingPeers).toEqual([]);
    });
  });

  describe('leave()', () => {
    it('returns the rooms the socket was in', () => {
      registry.join('room-1', 'sock-A', 'alice');
      registry.join('room-2', 'sock-A', 'alice');
      const left = registry.leave('sock-A');
      expect(left).toEqual(
        expect.arrayContaining([
          { roomId: 'room-1', userId: 'alice' },
          { roomId: 'room-2', userId: 'alice' },
        ]),
      );
      expect(registry.roomCount()).toBe(0);
    });

    it('returns an empty array for unknown sockets', () => {
      expect(registry.leave('unknown')).toEqual([]);
    });

    it('keeps the room alive while other peers remain', () => {
      registry.join('room-1', 'sock-A', 'alice');
      registry.join('room-1', 'sock-B', 'bob');
      registry.leave('sock-A');
      expect(registry.hasRoom('room-1')).toBe(true);
      expect(registry.members('room-1')).toHaveLength(1);
    });
  });

  describe('member()', () => {
    it('returns the member when present and undefined otherwise', () => {
      registry.join('room-1', 'sock-A', 'alice');
      expect(registry.member('room-1', 'sock-A')?.userId).toBe('alice');
      expect(registry.member('room-1', 'missing')).toBeUndefined();
      expect(registry.member('missing', 'sock-A')).toBeUndefined();
    });
  });

  describe('counters', () => {
    it('counts rooms and members', () => {
      expect(registry.roomCount()).toBe(0);
      expect(registry.memberCount()).toBe(0);
      registry.join('room-1', 'sock-A', 'alice');
      registry.join('room-1', 'sock-B', 'bob');
      registry.join('room-2', 'sock-C', 'carol');
      expect(registry.roomCount()).toBe(2);
      expect(registry.memberCount()).toBe(3);
    });
  });

  describe('reset()', () => {
    it('clears all rooms and members', () => {
      registry.join('room-1', 'sock-A', 'alice');
      registry.reset();
      expect(registry.roomCount()).toBe(0);
      expect(registry.memberCount()).toBe(0);
    });
  });
});
