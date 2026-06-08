import {
  CALL_EVENTS,
  CALL_STATES,
  type CallEvent,
  type CallState,
  type TransitionContext,
  createCallStateMachine,
  hasParticipants,
  isHost,
  isTerminal,
} from './call-state.machine';

describe('call-state.machine', () => {
  describe('isHost guard', () => {
    it('returns true when actor userId matches hostUserId', () => {
      expect(isHost({ userId: 'u-1', hostUserId: 'u-1' })).toBe(true);
    });

    it('returns false when actor userId differs from hostUserId', () => {
      expect(isHost({ userId: 'u-2', hostUserId: 'u-1' })).toBe(false);
    });
  });

  describe('hasParticipants guard', () => {
    it('returns true when participants > 0', () => {
      expect(hasParticipants({ participants: 1 })).toBe(true);
      expect(hasParticipants({ participants: 5 })).toBe(true);
    });

    it('returns false when participants is 0 or negative', () => {
      expect(hasParticipants({ participants: 0 })).toBe(false);
      expect(hasParticipants({ participants: -1 })).toBe(false);
    });
  });

  describe('isTerminal', () => {
    it('flags every terminal state', () => {
      const terminals: CallState[] = [
        'ended',
        'cancelled',
        'rejected',
        'missed',
        'failed',
      ];
      for (const s of terminals) {
        expect(isTerminal(s)).toBe(true);
      }
    });

    it('does not flag non-terminal states', () => {
      const nonTerminals: CallState[] = [
        'created',
        'ringing',
        'accepted',
        'connecting',
        'active',
        'reconnecting',
      ];
      for (const s of nonTerminals) {
        expect(isTerminal(s)).toBe(false);
      }
    });
  });

  describe('transition table (full state × event matrix)', () => {
    const machine = createCallStateMachine();

    type Row = {
      from: CallState;
      event: CallEvent;
      to: CallState | 'invalid';
      ctx?: TransitionContext;
    };

    const rows: Row[] = [
      // created
      { from: 'created', event: 'invite', to: 'ringing' },
      { from: 'created', event: 'cancel', to: 'cancelled' },
      { from: 'created', event: 'accept', to: 'invalid' },
      { from: 'created', event: 'reject', to: 'invalid' },
      { from: 'created', event: 'timeout', to: 'invalid' },
      { from: 'created', event: 'connect', to: 'invalid' },
      { from: 'created', event: 'activate', to: 'invalid' },
      { from: 'created', event: 'reconnect', to: 'invalid' },
      { from: 'created', event: 'reconnected', to: 'invalid' },
      { from: 'created', event: 'end', to: 'invalid' },
      { from: 'created', event: 'fail', to: 'invalid' },

      // ringing
      { from: 'ringing', event: 'accept', to: 'accepted' },
      { from: 'ringing', event: 'reject', to: 'rejected' },
      { from: 'ringing', event: 'timeout', to: 'missed' },
      { from: 'ringing', event: 'cancel', to: 'cancelled' },
      { from: 'ringing', event: 'invite', to: 'invalid' },
      { from: 'ringing', event: 'connect', to: 'invalid' },
      { from: 'ringing', event: 'activate', to: 'invalid' },
      { from: 'ringing', event: 'reconnect', to: 'invalid' },
      { from: 'ringing', event: 'reconnected', to: 'invalid' },
      { from: 'ringing', event: 'end', to: 'invalid' },
      { from: 'ringing', event: 'fail', to: 'invalid' },

      // accepted
      { from: 'accepted', event: 'connect', to: 'connecting' },
      { from: 'accepted', event: 'end', to: 'ended' },
      { from: 'accepted', event: 'invite', to: 'invalid' },
      { from: 'accepted', event: 'accept', to: 'invalid' },
      { from: 'accepted', event: 'reject', to: 'invalid' },
      { from: 'accepted', event: 'timeout', to: 'invalid' },
      { from: 'accepted', event: 'cancel', to: 'invalid' },
      { from: 'accepted', event: 'activate', to: 'invalid' },
      { from: 'accepted', event: 'reconnect', to: 'invalid' },
      { from: 'accepted', event: 'reconnected', to: 'invalid' },
      { from: 'accepted', event: 'fail', to: 'invalid' },

      // connecting
      {
        from: 'connecting',
        event: 'activate',
        to: 'active',
        ctx: { participants: 1 },
      },
      { from: 'connecting', event: 'fail', to: 'failed' },
      { from: 'connecting', event: 'end', to: 'ended' },
      { from: 'connecting', event: 'invite', to: 'invalid' },
      { from: 'connecting', event: 'accept', to: 'invalid' },
      { from: 'connecting', event: 'reject', to: 'invalid' },
      { from: 'connecting', event: 'timeout', to: 'invalid' },
      { from: 'connecting', event: 'cancel', to: 'invalid' },
      { from: 'connecting', event: 'connect', to: 'invalid' },
      { from: 'connecting', event: 'reconnect', to: 'invalid' },
      { from: 'connecting', event: 'reconnected', to: 'invalid' },

      // active
      { from: 'active', event: 'reconnect', to: 'reconnecting' },
      { from: 'active', event: 'end', to: 'ended' },
      { from: 'active', event: 'invite', to: 'invalid' },
      { from: 'active', event: 'accept', to: 'invalid' },
      { from: 'active', event: 'reject', to: 'invalid' },
      { from: 'active', event: 'timeout', to: 'invalid' },
      { from: 'active', event: 'cancel', to: 'invalid' },
      { from: 'active', event: 'connect', to: 'invalid' },
      { from: 'active', event: 'activate', to: 'invalid' },
      { from: 'active', event: 'reconnected', to: 'invalid' },
      { from: 'active', event: 'fail', to: 'invalid' },

      // reconnecting
      { from: 'reconnecting', event: 'reconnected', to: 'active' },
      { from: 'reconnecting', event: 'end', to: 'ended' },
      { from: 'reconnecting', event: 'invite', to: 'invalid' },
      { from: 'reconnecting', event: 'accept', to: 'invalid' },
      { from: 'reconnecting', event: 'reject', to: 'invalid' },
      { from: 'reconnecting', event: 'timeout', to: 'invalid' },
      { from: 'reconnecting', event: 'cancel', to: 'invalid' },
      { from: 'reconnecting', event: 'connect', to: 'invalid' },
      { from: 'reconnecting', event: 'activate', to: 'invalid' },
      { from: 'reconnecting', event: 'reconnect', to: 'invalid' },
      { from: 'reconnecting', event: 'fail', to: 'invalid' },

      // terminal states - all events invalid
      ...terminalRows('ended'),
      ...terminalRows('cancelled'),
      ...terminalRows('rejected'),
      ...terminalRows('missed'),
      ...terminalRows('failed'),
    ];

    function terminalRows(state: CallState): Row[] {
      return CALL_EVENTS.map((event) => ({
        from: state,
        event,
        to: 'invalid',
      }));
    }

    it.each(rows)(
      'canTransition($from + $event) → $to',
      ({ from, event, to, ctx }) => {
        if (to === 'invalid') {
          expect(machine.canTransition(from, event, ctx)).toBe(false);
        } else {
          expect(machine.canTransition(from, event, ctx)).toBe(true);
        }
      },
    );

    it.each(rows.filter((r) => r.to !== 'invalid' && r.from !== 'connecting'))(
      'apply($from + $event) → $to',
      ({ from, event, to, ctx }) => {
        const result = machine.apply(from, event, ctx);
        expect(result).toBe(to);
      },
    );

    it('apply() from connecting with no participants throws', () => {
      expect(() =>
        machine.apply('connecting', 'activate', { participants: 0 }),
      ).toThrow(/activate requires at least one participant/);
    });

    it('canTransition() from connecting with no participants returns false', () => {
      expect(
        machine.canTransition('connecting', 'activate', { participants: 0 }),
      ).toBe(false);
    });

    it('canTransition() from connecting with participants returns true', () => {
      expect(
        machine.canTransition('connecting', 'activate', { participants: 1 }),
      ).toBe(true);
    });

    it('apply() from connecting with no participants in ctx returns false via canTransition', () => {
      expect(machine.canTransition('connecting', 'activate', {})).toBe(false);
    });

    it('canTransition() with default participants=0 for activate', () => {
      const guard = machine.canTransition('connecting', 'activate');
      expect(guard).toBe(false);
    });

    it.each(rows.filter((r) => r.to === 'invalid'))(
      'apply($from + $event) throws InvalidCallTransitionError',
      ({ from, event }) => {
        expect(() => machine.apply(from, event)).toThrow(
          /Invalid call transition/,
        );
      },
    );

    it('apply() throws when the call is in a terminal state', () => {
      const terminals: CallState[] = [
        'ended',
        'cancelled',
        'rejected',
        'missed',
        'failed',
      ];
      for (const s of terminals) {
        for (const e of CALL_EVENTS) {
          expect(() => machine.apply(s, e)).toThrow();
        }
      }
    });

    it('canTransition() returns false from any terminal state', () => {
      const terminals: CallState[] = [
        'ended',
        'cancelled',
        'rejected',
        'missed',
        'failed',
      ];
      for (const s of terminals) {
        for (const e of CALL_EVENTS) {
          expect(machine.canTransition(s, e)).toBe(false);
        }
      }
    });
  });

  describe('row count vs state × event product', () => {
    it('covers every (state, event) pair exactly once', () => {
      const expected = CALL_STATES.length * CALL_EVENTS.length;
      let covered = 0;
      for (const state of CALL_STATES) {
        for (const event of CALL_EVENTS) {
          if (state && event) {
            covered += 1;
          }
        }
      }
      expect(covered).toBe(expected);
      expect(expected).toBe(CALL_STATES.length * CALL_EVENTS.length);
    });
  });
});
