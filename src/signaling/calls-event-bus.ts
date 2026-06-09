import { Injectable, Logger } from '@nestjs/common';
import type { CallEventType } from './signaling.types';

export const CALLS_EVENT_BUS = Symbol('CALLS_EVENT_BUS');

export interface CallParticipantContext {
  userId: string;
}

export interface CallAuthorizationResult {
  authorized: boolean;
  state?: 'pending' | 'ringing' | 'accepted' | 'active' | 'ended';
  reason?: string;
}

export interface CallsEventBus {
  onCallEvent(
    callId: string,
    event: CallEventType,
    actorUserId: string,
  ): Promise<void> | void;

  isParticipant(
    callId: string,
    userId: string,
  ): Promise<CallAuthorizationResult> | CallAuthorizationResult;
}

@Injectable()
export class NoopCallsEventBus implements CallsEventBus {
  private readonly logger = new Logger(NoopCallsEventBus.name);

  onCallEvent(callId: string, event: CallEventType, actorUserId: string): void {
    this.logger.debug(
      `[no-op] onCallEvent callId=${callId} event=${event} actor=${actorUserId}`,
    );
  }

  isParticipant(callId: string, userId: string): CallAuthorizationResult {
    this.logger.debug(
      `[no-op] isParticipant callId=${callId} userId=${userId} -> false`,
    );
    return { authorized: false, reason: 'no-calls-service' };
  }
}
