import type { CallState } from './domain/call-state.machine';

export const CALLS_REPOSITORY = Symbol('CALLS_REPOSITORY');
export const CALL_EVENTS_REPOSITORY = Symbol('CALL_EVENTS_REPOSITORY');

export type CallType = 'audio' | 'video';
export type CallMode = 'sfu' | 'p2p';
export type CallStatus = CallState;

export interface CallLike {
  id: string;
  type: CallType;
  mode: CallMode;
  status: CallStatus;
  createdBy: string;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallEventRecord {
  id: string;
  callId: string;
  userId: string | null;
  eventType: string;
  payload: unknown;
  createdAt: Date;
}

export interface CallsRepository {
  findById(id: string): Promise<CallLike | null>;
  findActiveForUser(userId: string): Promise<CallLike[]>;
  save(call: {
    id?: string;
    type: CallType;
    mode: CallMode;
    status: CallStatus;
    createdBy: string;
    startedAt?: Date | null;
    endedAt?: Date | null;
  }): Promise<CallLike>;
  updateStatus(
    id: string,
    status: CallStatus,
    ctx?: { startedAt?: Date; endedAt?: Date },
  ): Promise<CallLike>;
  delete(id: string): Promise<void>;
}

export interface CallEventsRepository {
  record(args: {
    callId: string;
    userId?: string | null;
    eventType: string;
    payload?: unknown;
  }): Promise<void>;
  listForCall(callId: string, limit?: number): Promise<CallEventRecord[]>;
}
