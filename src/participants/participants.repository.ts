import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { ParticipantRole, ParticipantStatus } from '../calls/domain/call.types';
import { CallParticipantEntity } from './domain/participant.entity';

export interface AddParticipantInput {
  callId: string;
  userId: string;
  role: ParticipantRole;
  id?: string;
  status?: ParticipantStatus;
}

export interface ParticipantTimestamps {
  joinedAt?: Date | null;
  leftAt?: Date | null;
}

@Injectable()
export class ParticipantsRepository {
  constructor(
    @InjectRepository(CallParticipantEntity)
    private readonly repo: Repository<CallParticipantEntity>,
  ) {}

  async add(input: AddParticipantInput): Promise<CallParticipantEntity> {
    const existing = await this.repo.findOne({
      where: { callId: input.callId, userId: input.userId },
    });
    if (existing) {
      existing.role = input.role;
      if (input.status !== undefined) existing.status = input.status;
      return this.repo.save(existing);
    }
    const entity = this.repo.create({
      id: input.id ?? randomUUID(),
      callId: input.callId,
      userId: input.userId,
      role: input.role,
      status: input.status ?? ParticipantStatus.Invited,
      joinedAt: null,
      leftAt: null,
    });
    return this.repo.save(entity);
  }

  async remove(input: { callId: string; userId: string }): Promise<void> {
    await this.repo.delete({
      callId: input.callId,
      userId: input.userId,
    });
  }

  async listForCall(callId: string): Promise<CallParticipantEntity[]> {
    return this.repo.find({
      where: { callId },
      order: { createdAt: 'ASC' },
    });
  }

  async findForUserAndCall(
    callId: string,
    userId: string,
  ): Promise<CallParticipantEntity | null> {
    return this.repo.findOne({ where: { callId, userId } });
  }

  async updateStatus(
    callId: string,
    userId: string,
    status: ParticipantStatus,
    timestamps: ParticipantTimestamps = {},
  ): Promise<CallParticipantEntity> {
    const existing = await this.repo.findOne({ where: { callId, userId } });
    if (!existing) {
      throw new Error(`Participant (call=${callId}, user=${userId}) not found`);
    }
    existing.status = status;
    if (timestamps.joinedAt !== undefined) {
      existing.joinedAt = timestamps.joinedAt;
    }
    if (timestamps.leftAt !== undefined) {
      existing.leftAt = timestamps.leftAt;
    }
    return this.repo.save(existing);
  }
}
