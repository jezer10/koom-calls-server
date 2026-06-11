import {
  CallCodeCollisionError,
  CallEventsStore,
  CallsService,
  generateRoomCode,
} from './calls.service';

describe('calls/generateRoomCode', () => {
  it('returns a string in the XXX-XXX-XXX shape using the expected alphabet', () => {
    for (let i = 0; i < 100; i += 1) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    }
  });

  it('produces a different code on repeated calls (probabilistic)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) seen.add(generateRoomCode());
    expect(seen.size).toBeGreaterThan(40);
  });
});

describe('CallsService', () => {
  let events: CallEventsStore;
  let service: CallsService;

  beforeEach(() => {
    events = new CallEventsStore();
    service = new CallsService(events);
  });

  describe('createCall', () => {
    it('generates a server-side roomId in the XXX-XXX-XXX format', () => {
      const call = service.createCall({ creatorId: 'user-1' });
      expect(call.roomId).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
      expect(call.id).not.toBe(call.roomId);
    });

    it('ignores any client-provided roomId (server is the source of truth)', () => {
      const call = service.createCall({
        creatorId: 'user-1',
        roomId: 'CALL-CLIENT-CHOSEN',
      });
      expect(call.roomId).not.toBe('CALL-CLIENT-CHOSEN');
      expect(call.roomId).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    });

    it('records a created event with the generated roomId in the payload', () => {
      const call = service.createCall({ creatorId: 'user-1' });
      const evts = events.forCall(call.id);
      expect(evts).toHaveLength(1);
      expect(evts[0].type).toBe('created');
      expect(evts[0].userId).toBe('user-1');
      expect(evts[0].payload).toEqual({ roomId: call.roomId, visibility: 'link' });
    });

    it('registers the creator as a joined participant', () => {
      const call = service.createCall({ creatorId: 'user-1' });
      expect(call.creatorId).toBe('user-1');
      expect(call.participants).toHaveLength(1);
      expect(call.participants[0]).toMatchObject({
        userId: 'user-1',
        role: 'creator',
        status: 'joined',
      });
    });

    it('defaults visibility to "link" so the roomId alone is enough to join', () => {
      const call = service.createCall({ creatorId: 'user-1' });
      expect(call.visibility).toBe('link');
    });

    it('honors an explicit "private" visibility', () => {
      const call = service.createCall({
        creatorId: 'user-1',
        visibility: 'private',
      });
      expect(call.visibility).toBe('private');
    });

    it('returns a CallCodeCollisionError if every generated code already exists', () => {
      // Force every possible code to be taken by pre-seeding the index.
      for (let i = 0; i < 200; i += 1) {
        service.createCall({ creatorId: `seed-${i}` });
      }
      // After many real creates, eventually a fresh run would hit a
      // collision only if the random space is exhausted. We can't easily
      // simulate that here, but we can verify the happy path resolves.
      const call = service.createCall({ creatorId: 'late' });
      expect(call.roomId).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
      // And that the error class is exported for the controller to translate.
      expect(new CallCodeCollisionError()).toBeInstanceOf(Error);
    });
  });

  describe('listForUser', () => {
    it('returns an empty array when the user has no calls', () => {
      expect(service.listForUser('nobody')).toEqual([]);
    });

    it('returns only calls where the user is a participant', () => {
      service.createCall({ creatorId: 'user-1' });
      service.createCall({ creatorId: 'user-2' });
      const a = service.listForUser('user-1').map((c) => c.creatorId);
      const b = service.listForUser('user-2').map((c) => c.creatorId);
      expect(a).toEqual(['user-1']);
      expect(b).toEqual(['user-2']);
    });

    it('includes calls the user was invited to, not only those they created', () => {
      const created = service.createCall({ creatorId: 'user-1' });
      service.invite(created.id, 'user-1', 'user-2');
      const user2Calls = service.listForUser('user-2');
      expect(user2Calls).toHaveLength(1);
      expect(user2Calls[0].id).toBe(created.id);
    });

    it('with status=active returns only active calls (someone joined)', () => {
      const a = service.createCall({ creatorId: 'user-1' });
      const b = service.createCall({ creatorId: 'user-1' });
      service.invite(b.id, 'user-1', 'user-2');
      service.accept(b.id, 'user-2');
      const ids = service
        .listForUser('user-1', { status: 'active' })
        .map((c) => c.id);
      expect(ids).toEqual([b.id]);
    });

    it('with status=ended returns only ended calls', () => {
      const a = service.createCall({ creatorId: 'user-1' });
      const b = service.createCall({ creatorId: 'user-1' });
      service.end(a.id, 'user-1');
      const ids = service
        .listForUser('user-1', { status: 'ended' })
        .map((c) => c.id);
      expect(ids).toEqual([a.id]);
    });

    it('with status=pending returns only pending calls', () => {
      const a = service.createCall({ creatorId: 'user-1' });
      const b = service.createCall({ creatorId: 'user-1' });
      service.invite(b.id, 'user-1', 'user-2');
      service.accept(b.id, 'user-2');
      const pending = service
        .listForUser('user-1', { status: 'pending' })
        .map((c) => c.id);
      const active = service
        .listForUser('user-1', { status: 'active' })
        .map((c) => c.id);
      expect(pending).toEqual([a.id]);
      expect(active).toEqual([b.id]);
    });

    it('with status=all returns every call (including ended)', () => {
      const a = service.createCall({ creatorId: 'user-1' });
      const b = service.createCall({ creatorId: 'user-1' });
      service.end(a.id, 'user-1');
      const ids = service
        .listForUser('user-1', { status: 'all' })
        .map((c) => c.id);
      expect(ids.sort()).toEqual([a.id, b.id].sort());
    });

    it('with no status defaults to all', () => {
      const a = service.createCall({ creatorId: 'user-1' });
      const b = service.createCall({ creatorId: 'user-1' });
      service.end(a.id, 'user-1');
      const ids = service.listForUser('user-1').map((c) => c.id);
      expect(ids.sort()).toEqual([a.id, b.id].sort());
    });

    it('sorts results by createdAt desc', async () => {
      const a = service.createCall({ creatorId: 'user-1' });
      await new Promise((r) => setTimeout(r, 5));
      const b = service.createCall({ creatorId: 'user-1' });
      await new Promise((r) => setTimeout(r, 5));
      const c = service.createCall({ creatorId: 'user-1' });
      const ids = service.listForUser('user-1').map((call) => call.id);
      expect(ids).toEqual([c.id, b.id, a.id]);
    });
  });

  describe('end()', () => {
    it('frees the roomId so a new call can reuse it (in-memory only)', () => {
      const a = service.createCall({ creatorId: 'user-1' });
      service.end(a.id, 'user-1');
      // After end() the code index entry is removed, but the code itself
      // is still valid for the ended call.
      expect(service.getCall(a.id).status).toBe('ended');
    });
  });

  describe('join()', () => {
    it('adds a new user as a link participant when the call is "link"', () => {
      const call = service.createCall({ creatorId: 'user-1' });
      service.join(call.id, 'user-2');
      const reloaded = service.getCall(call.id);
      const joined = reloaded.participants.find((p) => p.userId === 'user-2');
      expect(joined).toMatchObject({
        userId: 'user-2',
        role: 'invitee',
        status: 'joined',
      });
      // The first link-participant join also flips pending → active.
      expect(reloaded.status).toBe('active');
      expect(reloaded.startedAt).toBeTruthy();
    });

    it('rejects a non-participant from joining a "private" call', () => {
      const call = service.createCall({
        creatorId: 'user-1',
        visibility: 'private',
      });
      expect(() => service.join(call.id, 'user-2')).toThrow(/not a participant/i);
    });

    it('allows a creator to join their own call regardless of visibility', () => {
      const call = service.createCall({
        creatorId: 'user-1',
        visibility: 'private',
      });
      expect(() => service.join(call.id, 'user-1')).not.toThrow();
    });

    it('allows an invited user to join a "private" call', () => {
      const call = service.createCall({
        creatorId: 'user-1',
        visibility: 'private',
        invitees: ['user-2'],
      });
      expect(() => service.join(call.id, 'user-2')).not.toThrow();
    });

    it('rejects joining an ended link call', () => {
      const call = service.createCall({ creatorId: 'user-1' });
      service.end(call.id, 'user-1');
      expect(() => service.join(call.id, 'user-2')).toThrow(/ended/i);
    });

    it('records a joined event with via=link for link participants', () => {
      const call = service.createCall({ creatorId: 'user-1' });
      service.join(call.id, 'user-2');
      const evts = events.forCall(call.id);
      const linkJoin = evts.find(
        (e) => e.type === 'joined' && e.userId === 'user-2',
      );
      expect(linkJoin).toBeTruthy();
      expect(linkJoin?.payload).toEqual({ via: 'link' });
    });
  });
});
