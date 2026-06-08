import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { CallEntity } from './domain/call.entity';
import { CallMode, CallStatus, CallType } from './domain/call.types';

export interface SaveCallInput {
  id?: string;
  type?: CallType;
  mode?: CallMode;
  status: CallStatus;
  createdBy: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
}

export interface CallUpdateContext {
  startedAt?: Date | null;
  endedAt?: Date | null;
}

@Injectable()
export class CallsRepository {
  constructor(
    @InjectRepository(CallEntity)
    private readonly repo: Repository<CallEntity>,
  ) {}

  async findById(id: string): Promise<CallEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findActiveForUser(userId: string): Promise<CallEntity[]> {
    return this.repo
      .createQueryBuilder('call')
      .innerJoin('call_participants', 'p', 'p.call_id = call.id')
      .where('p.user_id = :userId', { userId })
      .andWhere(
        "call.status IN ('created','ringing','accepted','connecting','active','reconnecting')",
      )
      .orderBy('call.created_at', 'DESC')
      .getMany();
  }

  async save(input: SaveCallInput): Promise<CallEntity> {
    const entity = this.repo.create({
      id: input.id ?? randomUUID(),
      type: input.type ?? CallType.Video,
      mode: input.mode ?? CallMode.Sfu,
      status: input.status,
      createdBy: input.createdBy,
      startedAt: input.startedAt ?? null,
      endedAt: input.endedAt ?? null,
    });
    return this.repo.save(entity);
  }

  async updateStatus(
    id: string,
    status: CallStatus,
    ctx: CallUpdateContext = {},
  ): Promise<CallEntity> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Call ${id} not found`);
    }
    existing.status = status;
    if (ctx.startedAt !== undefined) existing.startedAt = ctx.startedAt;
    if (ctx.endedAt !== undefined) existing.endedAt = ctx.endedAt;
    return this.repo.save(existing);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
