import { randomUUID } from 'node:crypto';
import type {
  CallEventRecord,
  CallEventsRepository,
  CallLike,
  CallsRepository,
} from './calls.repository.interface';
import type { CallStatus } from './calls.repository.interface';

export class CallNotFoundError extends Error {
  constructor(public readonly callId: string) {
    super(`Call not found: ${callId}`);
    this.name = 'CallNotFoundError';
  }
}

export class InMemoryCallsRepository implements CallsRepository {
  private readonly calls = new Map<string, CallLike>();
  private readonly counter = { next: 1 };

  reset(): void {
    this.calls.clear();
    this.counter.next = 1;
  }

  findById(id: string): Promise<CallLike | null> {
    const call = this.calls.get(id);
    return Promise.resolve(call ?? null);
  }

  findActiveForUser(userId: string): Promise<CallLike[]> {
    const activeStatuses: CallStatus[] = [
      'created',
      'ringing',
      'accepted',
      'connecting',
      'active',
      'reconnecting',
    ];
    const result: CallLike[] = [];
    for (const call of this.calls.values()) {
      const isParticipant = call.createdBy === userId;
      if (isParticipant && activeStatuses.includes(call.status)) {
        result.push(call);
      }
    }
    return Promise.resolve(result);
  }

  save(input: {
    id?: string;
    type: CallLike['type'];
    mode: CallLike['mode'];
    status: CallStatus;
    createdBy: string;
    startedAt?: Date | null;
    endedAt?: Date | null;
  }): Promise<CallLike> {
    const now = new Date();
    const id = input.id ?? `call-${this.counter.next++}`;
    const call: CallLike = {
      id,
      type: input.type,
      mode: input.mode,
      status: input.status,
      createdBy: input.createdBy,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.calls.set(id, call);
    return Promise.resolve(call);
  }

  updateStatus(
    id: string,
    status: CallStatus,
    ctx: { startedAt?: Date; endedAt?: Date } = {},
  ): Promise<CallLike> {
    const current = this.calls.get(id);
    if (!current) {
      return Promise.reject(new CallNotFoundError(id));
    }
    const updated: CallLike = {
      ...current,
      status,
      startedAt: ctx.startedAt ?? current.startedAt,
      endedAt: ctx.endedAt ?? current.endedAt,
      updatedAt: new Date(),
    };
    this.calls.set(id, updated);
    return Promise.resolve(updated);
  }

  delete(id: string): Promise<void> {
    this.calls.delete(id);
    return Promise.resolve();
  }
}

export class InMemoryCallEventsRepository implements CallEventsRepository {
  private readonly events: CallEventRecord[] = [];

  reset(): void {
    this.events.length = 0;
  }

  record(args: {
    callId: string;
    userId?: string | null;
    eventType: string;
    payload?: unknown;
  }): Promise<void> {
    this.events.push({
      id: randomUUID(),
      callId: args.callId,
      userId: args.userId ?? null,
      eventType: args.eventType,
      payload: args.payload ?? null,
      createdAt: new Date(),
    });
    return Promise.resolve();
  }

  listForCall(callId: string, limit?: number): Promise<CallEventRecord[]> {
    const filtered = this.events.filter((e) => e.callId === callId);
    return Promise.resolve(
      typeof limit === 'number' ? filtered.slice(0, limit) : filtered,
    );
  }
}
