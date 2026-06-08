export const CALL_STATE_MACHINE = Symbol('CALL_STATE_MACHINE');

export const CALL_STATES = [
  'created',
  'ringing',
  'accepted',
  'connecting',
  'active',
  'reconnecting',
  'ended',
  'cancelled',
  'rejected',
  'missed',
  'failed',
] as const;

export type CallState = (typeof CALL_STATES)[number];

export const CALL_EVENTS = [
  'invite',
  'accept',
  'reject',
  'cancel',
  'connect',
  'activate',
  'reconnect',
  'reconnected',
  'end',
  'timeout',
  'fail',
] as const;

export type CallEvent = (typeof CALL_EVENTS)[number];

export interface TransitionContext {
  actor?: { userId: string; hostUserId: string };
  participants?: number;
}

export interface CallStateMachine {
  canTransition(
    state: CallState,
    event: CallEvent,
    ctx?: TransitionContext,
  ): boolean;
  apply(state: CallState, event: CallEvent, ctx?: TransitionContext): CallState;
}

export class InvalidCallTransitionError extends Error {
  constructor(
    public readonly from: CallState,
    public readonly event: CallEvent,
    message?: string,
  ) {
    super(
      message ??
        `Invalid call transition: cannot apply event "${event}" while in state "${from}"`,
    );
    this.name = 'InvalidCallTransitionError';
  }
}

export function isHost(actor: { userId: string; hostUserId: string }): boolean {
  return actor.userId === actor.hostUserId;
}

export function hasParticipants(ctx: { participants: number }): boolean {
  return ctx.participants > 0;
}

export const TERMINAL_STATES: readonly CallState[] = [
  'ended',
  'cancelled',
  'rejected',
  'missed',
  'failed',
] as const;

export function isTerminal(state: CallState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function createCallStateMachine(): CallStateMachine {
  const transitions: ReadonlyMap<string, CallState> = new Map<
    string,
    CallState
  >([
    ['created+invite', 'ringing'],
    ['created+cancel', 'cancelled'],
    ['ringing+accept', 'accepted'],
    ['ringing+reject', 'rejected'],
    ['ringing+timeout', 'missed'],
    ['ringing+cancel', 'cancelled'],
    ['accepted+connect', 'connecting'],
    ['accepted+end', 'ended'],
    ['connecting+activate', 'active'],
    ['connecting+fail', 'failed'],
    ['connecting+end', 'ended'],
    ['active+reconnect', 'reconnecting'],
    ['active+end', 'ended'],
    ['reconnecting+reconnected', 'active'],
    ['reconnecting+end', 'ended'],
  ]);

  function key(state: CallState, event: CallEvent): string {
    return `${state}+${event}`;
  }

  function evaluateGuards(
    state: CallState,
    event: CallEvent,
    _next: CallState,
    ctx: TransitionContext,
  ): { ok: true } | { ok: false; reason: string } {
    if (state === 'connecting' && event === 'activate') {
      const participants = ctx.participants ?? 0;
      if (!hasParticipants({ participants })) {
        return {
          ok: false,
          reason: 'activate requires at least one participant',
        };
      }
    }

    return { ok: true };
  }

  return {
    canTransition(
      state: CallState,
      event: CallEvent,
      ctx: TransitionContext = {},
    ): boolean {
      if (isTerminal(state)) {
        return false;
      }
      const next = transitions.get(key(state, event));
      if (next === undefined) {
        return false;
      }
      const guard = evaluateGuards(state, event, next, ctx);
      return guard.ok;
    },

    apply(
      state: CallState,
      event: CallEvent,
      ctx: TransitionContext = {},
    ): CallState {
      if (isTerminal(state)) {
        throw new InvalidCallTransitionError(state, event);
      }
      const next = transitions.get(key(state, event));
      if (next === undefined) {
        throw new InvalidCallTransitionError(state, event);
      }
      const guard = evaluateGuards(state, event, next, ctx);
      if (!guard.ok) {
        throw new InvalidCallTransitionError(state, event, guard.reason);
      }
      return next;
    },
  };
}
