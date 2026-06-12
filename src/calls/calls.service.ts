import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Call,
  CallEvent,
  CallEventType,
  CallParticipant,
  CallStatus,
  CallVisibility,
  CreateCallInput,
} from './call.types';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_SEGMENT_LENGTH = 3;
const ROOM_CODE_SEGMENTS = 3;
const ROOM_CODE_MAX_ATTEMPTS = 16;

export function generateRoomCode(): string {
  const part = (): string => {
    let out = '';
    for (let i = 0; i < ROOM_CODE_SEGMENT_LENGTH; i += 1) {
      const idx = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
      out += ROOM_CODE_ALPHABET[idx];
    }
    return out;
  };
  return Array.from({ length: ROOM_CODE_SEGMENTS }, part).join('-');
}

export type ListStatus = 'all' | CallStatus;

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

export class CallCodeCollisionError extends Error {
  constructor() {
    super('Could not generate a unique room code after several attempts');
    this.name = 'CallCodeCollisionError';
  }
}

@Injectable()
export class CallsService {
  private readonly calls = new Map<string, Call>();
  private readonly codeIndex = new Map<string, string>();

  constructor(private readonly events: CallEventsStore) {}

  createCall(input: CreateCallInput): Call {
    const id = randomUUID();
    const now = new Date().toISOString();
    const roomId = this.reserveRoomCode();
    const visibility: CallVisibility = input.visibility ?? 'link';
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
      visibility,
      creatorId: input.creatorId,
      participants: [creator],
      createdAt: now,
    };
    this.calls.set(id, call);
    this.codeIndex.set(roomId, id);
    this.events.record(id, 'created', input.creatorId, { roomId, visibility });

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

  /**
   * Look up a call by its human-shareable room code (XXX-XXX-XXX). Used
   * by the controller when the client sends the code from a URL like
   * `/calls/YSU-3CG-2JK/turn-credentials`, since URLs only carry the
   * code, not the internal UUID.
   */
  getCallByRoomCode(roomCode: string): Call {
    const callId = this.codeIndex.get(roomCode);
    if (!callId) throw new CallNotFoundError(roomCode);
    const call = this.calls.get(callId);
    if (!call) throw new CallNotFoundError(roomCode);
    return call;
  }

  /**
   * Resolve a call by either its internal UUID or its human-shareable
   * room code. URLs and shareable links carry the code, while internal
   * API flows and the signaling layer use the UUID.
   */
  getCallByIdOrCode(idOrCode: string): Call {
    const byId = this.calls.get(idOrCode);
    if (byId) return byId;
    return this.getCallByRoomCode(idOrCode);
  }

  /**
   * Return calls the user participates in, sorted by `createdAt` desc.
   * @param status 'all' returns every call; any other value matches the
   *               call's status literally (pending, active, or ended).
   */
  listForUser(userId: string, options: { status?: ListStatus } = {}): Call[] {
    const status = options.status ?? 'all';
    const result: Call[] = [];
    for (const call of this.calls.values()) {
      if (!this.isParticipant(call, userId)) continue;
      if (status !== 'all' && call.status !== status) continue;
      result.push(call);
    }
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result;
  }

  private reserveRoomCode(): string {
    for (let attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt += 1) {
      const code = generateRoomCode();
      if (!this.codeIndex.has(code)) {
        return code;
      }
    }
    throw new CallCodeCollisionError();
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
    if (this.isParticipant(call, userId)) return call;
    if (call.visibility === 'link') {
      // Open calls: any authenticated user with the roomId may join.
      // The creator is implicitly in control of who gets the link.
      this.joinAsLinkParticipant(call, userId);
      return call;
    }
    this.requireParticipant(call, userId);
    return call;
  }

  private joinAsLinkParticipant(call: Call, userId: string): void {
    const now = new Date().toISOString();
    call.participants.push({
      userId,
      role: 'invitee',
      status: 'joined',
      invitedAt: now,
      joinedAt: now,
    });
    if (call.status === 'pending') {
      call.status = 'active';
      call.startedAt = now;
    }
    this.events.record(call.id, 'joined', userId, { via: 'link' });
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
    this.codeIndex.delete(call.roomId);
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
    this.codeIndex.clear();
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
