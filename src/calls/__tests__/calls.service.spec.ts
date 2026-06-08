import {
  InvalidCallTransitionError,
  createCallStateMachine,
} from '../domain/call-state.machine';
import {
  CallForbiddenError,
  CallNotFoundError,
  CallsService,
} from '../calls.service';
import {
  InMemoryCallEventsRepository,
  InMemoryCallsRepository,
} from '../in-memory.repositories';

describe('CallsService', () => {
  let service: CallsService;
  let callsRepo: InMemoryCallsRepository;
  let eventsRepo: InMemoryCallEventsRepository;

  beforeEach(() => {
    callsRepo = new InMemoryCallsRepository();
    eventsRepo = new InMemoryCallEventsRepository();
    service = new CallsService(createCallStateMachine(), callsRepo, eventsRepo);
  });

  describe('createCall()', () => {
    it('creates a call in "created" state', async () => {
      const call = await service.createCall({
        type: 'video',
        createdBy: 'user-1',
      });
      expect(call.status).toBe('created');
      expect(call.type).toBe('video');
      expect(call.createdBy).toBe('user-1');
      expect(call.startedAt).toBeNull();
      expect(call.endedAt).toBeNull();
    });

    it('records a "created" event for the call', async () => {
      const call = await service.createCall({
        type: 'audio',
        createdBy: 'user-1',
      });
      const events = await service.listEvents(call.id);
      expect(events).toHaveLength(1);
      expect(events[0]?.eventType).toBe('created');
      expect(events[0]?.userId).toBe('user-1');
      expect(events[0]?.payload).toEqual({ type: 'audio', mode: 'sfu' });
    });
  });

  describe('happy path: invite → accept → connect → activate → end', () => {
    it('records the correct sequence of state_change events', async () => {
      const host = 'user-host';
      const callee = 'user-callee';
      const call = await service.createCall({
        type: 'video',
        createdBy: host,
      });
      const cid = call.id;

      await service.invite(cid, { userId: host, hostUserId: host });
      await service.accept(cid, { userId: callee });
      await service.connect(cid, { userId: callee });
      await service.activate(cid, { userId: callee, participants: 2 });

      const endResult = await service.end(cid, {
        userId: host,
        hostUserId: host,
      });

      expect(endResult.status).toBe('ended');
      expect(endResult.endedAt).toBeInstanceOf(Date);

      const events = await service.listEvents(cid);
      const transitions = events
        .filter((e) => e.eventType === 'state_change')
        .map((e) => (e.payload as { from: string; to: string }).to);

      expect(transitions).toEqual([
        'ringing',
        'accepted',
        'connecting',
        'active',
        'ended',
      ]);

      const final = await service.findById(cid);
      expect(final.status).toBe('ended');
      expect(final.endedAt).toBeInstanceOf(Date);
    });

    it('sets startedAt when transitioning to active', async () => {
      const host = 'user-host';
      const callee = 'user-callee';
      const call = await service.createCall({
        type: 'video',
        createdBy: host,
      });
      await service.invite(call.id, { userId: host, hostUserId: host });
      await service.accept(call.id, { userId: callee });
      await service.connect(call.id, { userId: callee });
      const active = await service.activate(call.id, {
        userId: callee,
        participants: 1,
      });
      expect(active.startedAt).toBeInstanceOf(Date);
    });
  });

  describe('host guard', () => {
    it('invite from a non-host throws CallForbiddenError', async () => {
      const call = await service.createCall({
        type: 'video',
        createdBy: 'host-1',
      });
      await expect(
        service.invite(call.id, {
          userId: 'other',
          hostUserId: 'host-1',
        }),
      ).rejects.toBeInstanceOf(CallForbiddenError);
    });

    it('cancel from a non-host throws CallForbiddenError', async () => {
      const call = await service.createCall({
        type: 'video',
        createdBy: 'host-1',
      });
      await expect(
        service.cancel(call.id, {
          userId: 'other',
          hostUserId: 'host-1',
        }),
      ).rejects.toBeInstanceOf(CallForbiddenError);
    });

    it('end from a non-host throws CallForbiddenError', async () => {
      const call = await service.createCall({
        type: 'video',
        createdBy: 'host-1',
      });
      await expect(
        service.end(call.id, {
          userId: 'other',
          hostUserId: 'host-1',
        }),
      ).rejects.toBeInstanceOf(CallForbiddenError);
    });
  });

  describe('participants guard', () => {
    it('activate with no participants throws InvalidCallTransitionError', async () => {
      const host = 'user-host';
      const call = await service.createCall({
        type: 'video',
        createdBy: host,
      });
      await service.invite(call.id, { userId: host, hostUserId: host });
      await service.accept(call.id, { userId: host });
      await service.connect(call.id, { userId: host });
      await expect(
        service.activate(call.id, { userId: host, participants: 0 }),
      ).rejects.toBeInstanceOf(InvalidCallTransitionError);
    });
  });

  describe('terminal state', () => {
    it('rejects any transition from "ended"', async () => {
      const host = 'user-host';
      const call = await service.createCall({
        type: 'video',
        createdBy: host,
      });
      await service.invite(call.id, { userId: host, hostUserId: host });
      await service.accept(call.id, { userId: host });
      await service.end(call.id, { userId: host, hostUserId: host });

      await expect(
        service.activate(call.id, { userId: host, participants: 1 }),
      ).rejects.toBeInstanceOf(InvalidCallTransitionError);
    });
  });

  describe('not-found', () => {
    it('invite on unknown call throws CallNotFoundError', async () => {
      await expect(
        service.invite('missing', {
          userId: 'u',
          hostUserId: 'u',
        }),
      ).rejects.toBeInstanceOf(CallNotFoundError);
    });

    it('findById on unknown call throws CallNotFoundError', async () => {
      await expect(service.findById('nope')).rejects.toBeInstanceOf(
        CallNotFoundError,
      );
    });
  });

  describe('read methods', () => {
    it('findActiveForUser returns only non-terminal calls for that user', async () => {
      const host = 'u-1';
      const a = await service.createCall({ type: 'video', createdBy: host });
      const b = await service.createCall({ type: 'video', createdBy: host });
      await service.invite(a.id, { userId: host, hostUserId: host });
      await service.invite(b.id, { userId: host, hostUserId: host });
      await service.accept(b.id, { userId: host });
      await service.end(b.id, { userId: host, hostUserId: host });

      const active = await service.findActiveForUser(host);
      expect(active.map((c) => c.id)).toEqual([a.id]);
    });

    it('listEvents respects limit', async () => {
      const call = await service.createCall({
        type: 'video',
        createdBy: 'u',
      });
      await service.invite(call.id, { userId: 'u', hostUserId: 'u' });
      const events = await service.listEvents(call.id, 1);
      expect(events).toHaveLength(1);
    });
  });
});
