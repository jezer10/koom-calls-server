import {
  CALLS_EVENT_BUS,
  NoopCallsEventBus,
  CallsEventBus,
} from '../calls-event-bus';

class FakeCallsEventBus implements CallsEventBus {
  events: Array<{ callId: string; event: string; actorUserId: string }> = [];
  isParticipantCalls: Array<{ callId: string; userId: string }> = [];
  participantResult = { authorized: true, state: 'accepted' as const };

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

  isParticipant(callId: string, userId: string) {
    this.isParticipantCalls.push({ callId, userId });
    return this.participantResult;
  }
}

describe('CallsEventBus', () => {
  it('exposes a stable DI token', () => {
    expect(typeof CALLS_EVENT_BUS).toBe('symbol');
  });

  describe('NoopCallsEventBus', () => {
    it('onCallEvent accepts all arguments and does not throw', () => {
      const bus = new NoopCallsEventBus();
      expect(() =>
        bus.onCallEvent('call-1', 'call:accept', 'alice'),
      ).not.toThrow();
    });

    it('isParticipant returns authorized=false by default', () => {
      const bus = new NoopCallsEventBus();
      const result = bus.isParticipant('call-1', 'alice');
      expect(result.authorized).toBe(false);
    });

    it('isParticipant can be awaited when returning a promise', async () => {
      const bus = new NoopCallsEventBus();
      const result = bus.isParticipant('call-1', 'alice');
      await Promise.resolve(result);
    });
  });

  describe('custom impl with same interface', () => {
    it('records calls for assertions', () => {
      const fake = new FakeCallsEventBus();
      fake.onCallEvent('c1', 'call:ringing', 'alice');
      fake.onCallEvent('c1', 'call:accept', 'bob');
      expect(fake.events).toEqual([
        { callId: 'c1', event: 'call:ringing', actorUserId: 'alice' },
        { callId: 'c1', event: 'call:accept', actorUserId: 'bob' },
      ]);
    });

    it('isParticipant is called with the expected args', () => {
      const fake = new FakeCallsEventBus();
      const r = fake.isParticipant('c1', 'alice');
      expect(r.authorized).toBe(true);
      expect(fake.isParticipantCalls).toEqual([
        { callId: 'c1', userId: 'alice' },
      ]);
    });
  });
});
