import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { redactPayload, RedactionOptions } from './redaction.util';

export type CallEventType =
  | 'auth.success'
  | 'auth.failure'
  | 'rate_limit.exceeded'
  | 'room.joined'
  | 'room.left'
  | 'call.terminated'
  | 'suspended'
  | 'moderation.action'
  | (string & {});

export interface CallEventRecord {
  callId: string;
  userId: string | null;
  eventType: CallEventType;
  payload: unknown;
  createdAt: Date;
}

export interface CallEventInsertInput {
  callId: string;
  userId: string | null;
  eventType: string;
  payload: unknown;
  createdAt: Date;
}

export type CallEventInsertResult = void | Promise<unknown>;

export interface CallEventsRepository {
  insert(input: CallEventInsertInput): CallEventInsertResult;
}

export const CALL_EVENTS_REPOSITORY = 'CALL_EVENTS_REPOSITORY';

export interface LogCriticalInput {
  callId: string;
  userId?: string | null;
  eventType: CallEventType;
  payload?: unknown;
  redaction?: RedactionOptions;
  createdAt?: Date;
}

export interface AuditLoggerOptions {
  repository?: CallEventsRepository | null;
  defaultClock?: () => Date;
  logger?: Pick<Logger, 'log' | 'error' | 'warn' | 'debug' | 'verbose'>;
}

const NOOP_LOGGER: AuditLoggerOptions['logger'] = {
  log: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  debug: () => undefined,
  verbose: () => undefined,
};

@Injectable()
export class AuditLogger {
  private readonly logger: NonNullable<AuditLoggerOptions['logger']>;
  private readonly clock: () => Date;
  private readonly repository: CallEventsRepository | null;

  constructor(
    @Optional()
    @Inject(CALL_EVENTS_REPOSITORY)
    repository: CallEventsRepository | null | undefined,
    @Optional() options: AuditLoggerOptions,
  ) {
    this.repository = repository ?? options?.repository ?? null;
    this.clock = options?.defaultClock ?? (() => new Date());
    this.logger = options?.logger ?? new Logger(AuditLogger.name);
  }

  async logCritical(input: LogCriticalInput): Promise<CallEventRecord> {
    if (!input || typeof input !== 'object') {
      throw new Error('logCritical requires a LogCriticalInput object');
    }
    if (!input.callId || typeof input.callId !== 'string') {
      throw new Error('logCritical requires a non-empty callId string');
    }
    if (!input.eventType || typeof input.eventType !== 'string') {
      throw new Error('logCritical requires a non-empty eventType string');
    }

    const record: CallEventRecord = {
      callId: input.callId,
      userId: input.userId ?? null,
      eventType: input.eventType,
      payload: redactPayload(input.payload, input.redaction),
      createdAt: input.createdAt ?? this.clock(),
    };

    if (this.repository) {
      try {
        await this.repository.insert({
          callId: record.callId,
          userId: record.userId,
          eventType: record.eventType,
          payload: record.payload,
          createdAt: record.createdAt,
        });
      } catch (err) {
        this.logger.error(
          `audit insert failed callId=${record.callId} eventType=${record.eventType}: ${describe(err)}`,
        );
      }
    } else {
      this.logger.warn(
        `audit (no repository) callId=${record.callId} eventType=${record.eventType}`,
      );
    }

    return record;
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'unknown';
  }
}

export const __test__ = { describe, NOOP_LOGGER };
