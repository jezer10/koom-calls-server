import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ParticipantRole,
  ParticipantStatus,
} from '../../calls/domain/call.types';
import { CallParticipantEntity } from '../domain/participant.entity';
import { ParticipantsRepository } from '../participants.repository';

describe('ParticipantsRepository', () => {
  let module: TestingModule;
  let repo: ParticipantsRepository;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [CallParticipantEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([CallParticipantEntity]),
      ],
      providers: [ParticipantsRepository],
    }).compile();
    repo = module.get(ParticipantsRepository);
  });

  afterEach(async () => {
    await module.close();
  });

  it('adds a participant with invited status by default', async () => {
    const p = await repo.add({
      callId: 'call-1',
      userId: 'user-1',
      role: ParticipantRole.Host,
    });
    expect(p.callId).toBe('call-1');
    expect(p.userId).toBe('user-1');
    expect(p.role).toBe(ParticipantRole.Host);
    expect(p.status).toBe(ParticipantStatus.Invited);
  });

  it('add is idempotent: re-add updates role and status', async () => {
    await repo.add({
      callId: 'call-1',
      userId: 'user-1',
      role: ParticipantRole.Host,
    });
    const updated = await repo.add({
      callId: 'call-1',
      userId: 'user-1',
      role: ParticipantRole.Moderator,
      status: ParticipantStatus.Ringing,
    });
    expect(updated.role).toBe(ParticipantRole.Moderator);
    expect(updated.status).toBe(ParticipantStatus.Ringing);
    const all = await repo.listForCall('call-1');
    expect(all).toHaveLength(1);
  });

  it('removes a participant', async () => {
    await repo.add({
      callId: 'call-1',
      userId: 'user-1',
      role: ParticipantRole.Host,
    });
    await repo.remove({ callId: 'call-1', userId: 'user-1' });
    const all = await repo.listForCall('call-1');
    expect(all).toHaveLength(0);
  });

  it('listForCall returns participants in created order', async () => {
    await repo.add({
      id: 'p-a',
      callId: 'call-1',
      userId: 'user-a',
      role: ParticipantRole.Participant,
    });
    await new Promise((r) => setTimeout(r, 5));
    await repo.add({
      id: 'p-b',
      callId: 'call-1',
      userId: 'user-b',
      role: ParticipantRole.Host,
    });
    const all = await repo.listForCall('call-1');
    expect(all.map((p) => p.id)).toEqual(['p-a', 'p-b']);
  });

  it('findForUserAndCall returns a single row or null', async () => {
    await repo.add({
      callId: 'call-1',
      userId: 'user-1',
      role: ParticipantRole.Host,
    });
    const found = await repo.findForUserAndCall('call-1', 'user-1');
    expect(found?.userId).toBe('user-1');
    const miss = await repo.findForUserAndCall('call-1', 'user-x');
    expect(miss).toBeNull();
  });

  it('updateStatus writes joined_at and left_at via timestamps', async () => {
    await repo.add({
      callId: 'call-1',
      userId: 'user-1',
      role: ParticipantRole.Host,
    });
    const joined = new Date('2025-02-01T10:00:00Z');
    const left = new Date('2025-02-01T10:30:00Z');
    const updated = await repo.updateStatus(
      'call-1',
      'user-1',
      ParticipantStatus.Joined,
      { joinedAt: joined },
    );
    expect(updated.status).toBe(ParticipantStatus.Joined);
    expect(updated.joinedAt?.toISOString()).toBe('2025-02-01T10:00:00.000Z');
    const leftUpdated = await repo.updateStatus(
      'call-1',
      'user-1',
      ParticipantStatus.Left,
      { leftAt: left },
    );
    expect(leftUpdated.leftAt?.toISOString()).toBe('2025-02-01T10:30:00.000Z');
  });

  it('updateStatus throws when participant missing', async () => {
    await expect(
      repo.updateStatus('call-1', 'missing', ParticipantStatus.Joined),
    ).rejects.toThrow();
  });
});
