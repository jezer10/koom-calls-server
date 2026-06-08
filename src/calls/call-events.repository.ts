import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { CallEventEntity } from './domain/call-event.entity';

export interface RecordCallEventInput {
  id?: string;
  callId: string;
  userId?: string | null;
  eventType: string;
  payload?: unknown;
}

@Injectable()
export class CallEventsRepository {
  constructor(
    @InjectRepository(CallEventEntity)
    private readonly repo: Repository<CallEventEntity>,
  ) {}

  async record(input: RecordCallEventInput): Promise<CallEventEntity> {
    const entity = this.repo.create({
      id: input.id ?? randomUUID(),
      callId: input.callId,
      userId: input.userId ?? null,
      eventType: input.eventType,
      payload:
        input.payload === undefined || input.payload === null
          ? null
          : JSON.stringify(input.payload),
    });
    return this.repo.save(entity);
  }

  async listForCall(
    callId: string,
    limit: number = 100,
  ): Promise<CallEventEntity[]> {
    return this.repo.find({
      where: { callId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }
}
