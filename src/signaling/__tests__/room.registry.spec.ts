import { RoomRegistry } from '../room.registry';

describe('RoomRegistry', () => {
  let registry: RoomRegistry;

  beforeEach(() => {
    registry = new RoomRegistry();
  });

  describe('join()', () => {
    it('adds the member and returns the new member', () => {
      const member = registry.join('call-1', 'sock-A', 'alice');
      expect(member).toEqual({
        socketId: 'sock-A',
        userId: 'alice',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        joinedAt: expect.any(Number),
      });
      expect(member.joinedAt).toBeGreaterThan(0);
    });

    it('returns the existing member when joining twice with same socketId', () => {
      registry.join('call-1', 'sock-A', 'alice');
      const second = registry.join('call-1', 'sock-A', 'alice2');
      expect(second.userId).toBe('alice2');
      expect(registry.members('call-1')).toHaveLength(1);
    });

    it('keeps different call rooms independent', () => {
      registry.join('call-1', 'sock-A', 'alice');
      registry.join('call-2', 'sock-A', 'alice');
      expect(registry.members('call-1')).toHaveLength(1);
      expect(registry.members('call-2')).toHaveLength(1);
    });
  });

  describe('leave()', () => {
    it('returns the rooms the socket was in', () => {
      registry.join('call-1', 'sock-A', 'alice');
      registry.join('call-2', 'sock-A', 'alice');
      const left = registry.leave('sock-A');
      expect(left).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ callId: 'call-1' }),
          expect.objectContaining({ callId: 'call-2' }),
        ]),
      );
      expect(registry.members('call-1')).toHaveLength(0);
      expect(registry.members('call-2')).toHaveLength(0);
    });

    it('returns an empty array for unknown sockets', () => {
      registry.join('call-1', 'sock-A', 'alice');
      expect(registry.leave('sock-MISSING')).toEqual([]);
      expect(registry.members('call-1')).toHaveLength(1);
    });

    it('keeps the room alive while other peers remain', () => {
      registry.join('call-1', 'sock-A', 'alice');
      registry.join('call-1', 'sock-B', 'bob');
      registry.leave('sock-A');
      expect(registry.members('call-1')).toHaveLength(1);
      expect(registry.members('call-1')[0]?.userId).toBe('bob');
    });
  });

  describe('members()', () => {
    it('returns an empty array for unknown call rooms', () => {
      expect(registry.members('missing')).toEqual([]);
    });

    it('returns all members of a call', () => {
      registry.join('call-1', 'sock-A', 'alice');
      registry.join('call-1', 'sock-B', 'bob');
      const members = registry.members('call-1');
      expect(members).toHaveLength(2);
      expect(members.map((m) => m.userId).sort()).toEqual(['alice', 'bob']);
    });
  });

  describe('member()', () => {
    it('returns the member when present and undefined otherwise', () => {
      registry.join('call-1', 'sock-A', 'alice');
      expect(registry.member('call-1', 'sock-A')?.userId).toBe('alice');
      expect(registry.member('call-1', 'sock-MISSING')).toBeUndefined();
      expect(registry.member('missing', 'sock-A')).toBeUndefined();
    });
  });

  describe('isParticipant() / hasMember()', () => {
    it('returns true if the user is in the call room', () => {
      registry.join('call-1', 'sock-A', 'alice');
      expect(registry.isParticipant('call-1', 'alice')).toBe(true);
      expect(registry.hasMember('call-1', 'alice')).toBe(true);
    });

    it('returns false otherwise', () => {
      registry.join('call-1', 'sock-A', 'alice');
      expect(registry.isParticipant('call-1', 'bob')).toBe(false);
      expect(registry.isParticipant('missing', 'alice')).toBe(false);
    });
  });

  describe('reset()', () => {
    it('clears all rooms and members', () => {
      registry.join('call-1', 'sock-A', 'alice');
      registry.join('call-2', 'sock-B', 'bob');
      registry.reset();
      expect(registry.members('call-1')).toEqual([]);
      expect(registry.members('call-2')).toEqual([]);
    });
  });
});
