import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CALL_STATE_MACHINE,
  type CallEvent,
  type CallStateMachine,
  type TransitionContext,
} from './domain/call-state.machine';
import {
  CALLS_REPOSITORY,
  CALL_EVENTS_REPOSITORY,
  type CallEventRecord,
  type CallLike,
  type CallMode,
  type CallsRepository,
  type CallEventsRepository,
  type CallType,
} from './calls.repository.interface';

export interface CreateCallInput {
  type: CallType;
  createdBy: string;
  mode?: CallMode;
}

export interface HostActor {
  userId: string;
  hostUserId: string;
}

export interface UserActor {
  userId: string;
}

export interface ActivateContext {
  userId: string;
  participants: number;
}

export class CallForbiddenError extends Error {
  constructor(message = 'forbidden') {
    super(message);
    this.name = 'CallForbiddenError';
  }
}

export class CallNotFoundError extends Error {
  constructor(public readonly callId: string) {
    super(`Call not found: ${callId}`);
    this.name = 'CallNotFoundError';
  }
}

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    @Inject(CALL_STATE_MACHINE) private readonly machine: CallStateMachine,
    @Inject(CALLS_REPOSITORY) private readonly calls: CallsRepository,
    @Inject(CALL_EVENTS_REPOSITORY)
    private readonly events: CallEventsRepository,
  ) {}

  async createCall(input: CreateCallInput): Promise<CallLike> {
    const call = await this.calls.save({
      type: input.type,
      mode: input.mode ?? 'sfu',
      status: 'created',
      createdBy: input.createdBy,
    });
    await this.events.record({
      callId: call.id,
      userId: input.createdBy,
      eventType: 'created',
      payload: { type: call.type, mode: call.mode },
    });
    return call;
  }

  async invite(callId: string, actor: HostActor): Promise<CallLike> {
    return this.runTransition(callId, 'invite', actor, {
      requireHost: true,
    });
  }

  async accept(callId: string, actor: UserActor): Promise<CallLike> {
    return this.runTransition(callId, 'accept', actor);
  }

  async reject(callId: string, actor: UserActor): Promise<CallLike> {
    return this.runTransition(callId, 'reject', actor);
  }

  async cancel(callId: string, actor: HostActor): Promise<CallLike> {
    return this.runTransition(callId, 'cancel', actor, {
      requireHost: true,
    });
  }

  async connect(callId: string, actor: UserActor): Promise<CallLike> {
    return this.runTransition(callId, 'connect', actor);
  }

  async activate(callId: string, ctx: ActivateContext): Promise<CallLike> {
    return this.runTransition(
      callId,
      'activate',
      { userId: ctx.userId },
      { participants: ctx.participants, timestamp: { startedAt: new Date() } },
    );
  }

  async reconnect(callId: string, actor: UserActor): Promise<CallLike> {
    return this.runTransition(callId, 'reconnect', actor);
  }

  async reconnected(callId: string, actor: UserActor): Promise<CallLike> {
    return this.runTransition(callId, 'reconnected', actor);
  }

  async end(callId: string, actor: HostActor): Promise<CallLike> {
    return this.runTransition(callId, 'end', actor, {
      requireHost: true,
      timestamp: { endedAt: new Date() },
    });
  }

  async findById(callId: string): Promise<CallLike> {
    const call = await this.calls.findById(callId);
    if (!call) {
      throw new CallNotFoundError(callId);
    }
    return call;
  }

  findActiveForUser(userId: string): Promise<CallLike[]> {
    return this.calls.findActiveForUser(userId);
  }

  listEvents(callId: string, limit?: number): Promise<CallEventRecord[]> {
    return this.events.listForCall(callId, limit);
  }

  private async runTransition(
    callId: string,
    event: CallEvent,
    actor: { userId: string },
    options: {
      requireHost?: boolean;
      participants?: number;
      timestamp?: { startedAt?: Date; endedAt?: Date };
    } = {},
  ): Promise<CallLike> {
    const current = await this.calls.findById(callId);
    if (!current) {
      throw new CallNotFoundError(callId);
    }

    if (options.requireHost && actor.userId !== current.createdBy) {
      throw new CallForbiddenError(
        `user ${actor.userId} is not the host of call ${callId}`,
      );
    }

    const ctx: TransitionContext = {
      actor: { userId: actor.userId, hostUserId: current.createdBy },
      participants: options.participants,
    };

    const next = this.machine.apply(current.status, event, ctx);

    const updated = await this.calls.updateStatus(
      callId,
      next,
      options.timestamp,
    );

    await this.events.record({
      callId,
      userId: actor.userId,
      eventType: 'state_change',
      payload: { from: current.status, to: next, event },
    });

    this.logger.log(
      `call ${callId}: ${current.status} → ${next} (event=${event}, actor=${actor.userId})`,
    );

    return updated;
  }
}
