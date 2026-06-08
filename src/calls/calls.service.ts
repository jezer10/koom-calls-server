import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Call,
  CallEvent,
  CallEventType,
  CallParticipant,
  CreateCallInput,
} from './call.types';

@Injectable()
export class CallEventsStore {
  private readonly events: CallEvent[] = [];
  private nextId = 1;

  record(
    callId: string,
    type: CallEventType,
    userId: string,
    payload?: Record<string, unknown>,
  ): CallEvent {
    const event: CallEvent = {
      id: this.nextId++,
      callId,
      type,
      userId,
      payload,
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  forCall(callId: string): CallEvent[] {
    return this.events.filter((e) => e.callId === callId);
  }

  all(): CallEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
    this.nextId = 1;
  }
}

export class CallNotFoundError extends Error {
  constructor(callId: string) {
    super(`Call ${callId} not found`);
    this.name = 'CallNotFoundError';
  }
}

export class CallForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallForbiddenError';
  }
}

export class CallConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallConflictError';
  }
}

export class CallInvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CallInvalidStateError';
  }
}

@Injectable()
export class CallsService {
  private readonly calls = new Map<string, Call>();

  constructor(private readonly events: CallEventsStore) {}

  createCall(input: CreateCallInput): Call {
    const id = randomUUID();
    const now = new Date().toISOString();
    const roomId = input.roomId ?? `call-${id}`;
    const creator: CallParticipant = {
      userId: input.creatorId,
      role: 'creator',
      status: 'joined',
      invitedAt: now,
      joinedAt: now,
    };
    const call: Call = {
      id,
      roomId,
      status: 'pending',
      creatorId: input.creatorId,
      participants: [creator],
      createdAt: now,
    };
    this.calls.set(id, call);
    this.events.record(id, 'created', input.creatorId, { roomId });

    for (const invitee of input.invitees ?? []) {
      if (invitee === input.creatorId) continue;
      this.inviteInternal(call, invitee);
    }
    return call;
  }

  getCall(callId: string): Call {
    const call = this.calls.get(callId);
    if (!call) throw new CallNotFoundError(callId);
    return call;
  }

  invite(callId: string, inviterId: string, inviteeId: string): Call {
    if (inviterId === inviteeId) {
      throw new CallConflictError('Cannot invite yourself');
    }
    const call = this.getCall(callId);
    if (call.status === 'ended') {
      throw new CallInvalidStateError('Cannot invite to an ended call');
    }
    if (!this.isParticipant(call, inviterId)) {
      throw new CallForbiddenError('Only participants can invite');
    }
    this.inviteInternal(call, inviteeId);
    return call;
  }

  private inviteInternal(call: Call, inviteeId: string): void {
    const existing = call.participants.find((p) => p.userId === inviteeId);
    if (existing) return;
    const now = new Date().toISOString();
    call.participants.push({
      userId: inviteeId,
      role: 'invitee',
      status: 'invited',
      invitedAt: now,
    });
    this.events.record(call.id, 'invited', inviteeId, { by: call.creatorId });
  }

  accept(callId: string, userId: string): Call {
    const call = this.getCall(callId);
    if (call.status === 'ended') {
      throw new CallInvalidStateError('Cannot accept an ended call');
    }
    const participant = this.requireParticipant(call, userId);
    if (participant.status === 'joined') return call;
    participant.status = 'joined';
    participant.joinedAt = new Date().toISOString();
    if (call.status === 'pending') {
      call.status = 'active';
      call.startedAt = new Date().toISOString();
    }
    this.events.record(callId, 'accepted', userId);
    this.events.record(callId, 'joined', userId);
    return call;
  }

  join(callId: string, userId: string): Call {
    const call = this.getCall(callId);
    if (call.status === 'ended') {
      throw new CallInvalidStateError('Call has ended');
    }
    this.requireParticipant(call, userId);
    return call;
  }

  leave(callId: string, userId: string): Call {
    const call = this.getCall(callId);
    const participant = this.requireParticipant(call, userId);
    if (participant.status === 'left') return call;
    participant.status = 'left';
    participant.leftAt = new Date().toISOString();
    this.events.record(callId, 'left', userId);
    return call;
  }

  end(callId: string, userId: string): Call {
    const call = this.getCall(callId);
    if (!this.isParticipant(call, userId)) {
      throw new CallForbiddenError('Only participants can end the call');
    }
    if (call.status === 'ended') return call;
    call.status = 'ended';
    call.endedAt = new Date().toISOString();
    call.endedBy = userId;
    this.events.record(callId, 'ended', userId);
    return call;
  }

  isParticipant(call: Call, userId: string): boolean {
    return call.participants.some((p) => p.userId === userId);
  }

  isActive(call: Call): boolean {
    return call.status !== 'ended';
  }

  reset(): void {
    this.calls.clear();
    this.events.clear();
  }

  private requireParticipant(call: Call, userId: string): CallParticipant {
    const participant = call.participants.find((p) => p.userId === userId);
    if (!participant) {
      throw new CallForbiddenError(
        `User ${userId} is not a participant of call ${call.id}`,
      );
    }
    return participant;
  }
}
