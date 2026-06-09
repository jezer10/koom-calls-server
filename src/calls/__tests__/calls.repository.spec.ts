import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallParticipantEntity } from '../../participants/domain/participant.entity';
import { CallEventsRepository } from '../call-events.repository';
import { CallsRepository } from '../calls.repository';
import { CallEntity } from '../domain/call.entity';
import { CallEventEntity } from '../domain/call-event.entity';
import { CallMode, CallStatus, CallType } from '../domain/call.types';

describe('CallsRepository', () => {
  let module: TestingModule;
  let repo: CallsRepository;
  let callRepo: import('typeorm').Repository<CallEntity>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [CallEntity, CallParticipantEntity, CallEventEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([CallEntity, CallEventEntity]),
      ],
      providers: [CallsRepository, CallEventsRepository],
    }).compile();
    repo = module.get(CallsRepository);
    callRepo = module.get('CallEntityRepository');
  });

  afterEach(async () => {
    await module.close();
  });

  it('saves a call and assigns a uuid', async () => {
    const saved = await repo.save({
      status: CallStatus.Created,
      createdBy: 'user-1',
    });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(saved.type).toBe(CallType.Video);
    expect(saved.mode).toBe(CallMode.Sfu);
    expect(saved.status).toBe(CallStatus.Created);
  });

  it('preserves explicit id and enum values', async () => {
    const saved = await repo.save({
      id: 'fixed-id-1',
      type: CallType.Audio,
      mode: CallMode.Sfu,
      status: CallStatus.Ringing,
      createdBy: 'user-1',
    });
    expect(saved.id).toBe('fixed-id-1');
    expect(saved.type).toBe(CallType.Audio);
  });

  it('finds by id', async () => {
    const saved = await repo.save({
      status: CallStatus.Created,
      createdBy: 'user-1',
    });
    const found = await repo.findById(saved.id);
    expect(found?.id).toBe(saved.id);
  });

  it('returns null when findById misses', async () => {
    const found = await repo.findById('does-not-exist');
    expect(found).toBeNull();
  });

  it('updates status and writes timestamps via context', async () => {
    const saved = await repo.save({
      status: CallStatus.Created,
      createdBy: 'user-1',
    });
    const updated = await repo.updateStatus(saved.id, CallStatus.Active, {
      startedAt: new Date('2025-01-01T00:00:00Z'),
    });
    expect(updated.status).toBe(CallStatus.Active);
    expect(updated.startedAt?.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('throws NotFoundException when updating missing call', async () => {
    await expect(
      repo.updateStatus('missing', CallStatus.Ended),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a call', async () => {
    const saved = await repo.save({
      status: CallStatus.Created,
      createdBy: 'user-1',
    });
    await repo.delete(saved.id);
    const found = await repo.findById(saved.id);
    expect(found).toBeNull();
  });

  it('findActiveForUser returns calls of the given user', async () => {
    const call = await repo.save({
      status: CallStatus.Active,
      createdBy: 'user-1',
    });
    const other = await repo.save({
      status: CallStatus.Created,
      createdBy: 'user-2',
    });
    await callRepo.query(
      'INSERT INTO call_participants(id, call_id, user_id, role, status) VALUES (?,?,?,?,?)',
      ['p-1', call.id, 'user-1', 'host', 'joined'],
    );
    await callRepo.query(
      'INSERT INTO call_participants(id, call_id, user_id, role, status) VALUES (?,?,?,?,?)',
      ['p-2', other.id, 'user-2', 'host', 'joined'],
    );
    const active = await repo.findActiveForUser('user-1');
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(call.id);
  });
});
