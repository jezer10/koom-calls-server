import {
  AuditLogger,
  CallEventsRepository,
  CallEventInsertInput,
} from '../audit-logger.service';

class FakeRepository implements CallEventsRepository {
  public records: CallEventInsertInput[] = [];
  public failOnce = false;
  insert(input: CallEventInsertInput): void {
    if (this.failOnce) {
      this.failOnce = false;
      throw new Error('boom');
    }
    this.records.push(input);
  }
}

describe('AuditLogger', () => {
  let repo: FakeRepository;
  let now: Date;
  let logger: AuditLogger;

  beforeEach(() => {
    repo = new FakeRepository();
    now = new Date('2026-01-01T00:00:00.000Z');
    logger = new AuditLogger(repo, {
      defaultClock: () => now,
      logger: {
        log: () => undefined,
        error: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
        verbose: () => undefined,
      },
    });
  });

  it('calls repository.insert with redacted payload', async () => {
    const record = await logger.logCritical({
      callId: 'call-1',
      userId: 'alice',
      eventType: 'auth.success',
      payload: {
        sdp: 'v=0...',
        iceCandidates: [{ candidate: 'cand-1' }],
        password: 'shh',
        token: 'jwt',
        authorization: 'Bearer xxx',
        message: 'joined',
      },
    });

    expect(repo.records).toHaveLength(1);
    const inserted = repo.records[0];
    const insertedPayload = inserted.payload as Record<string, unknown>;
    expect(insertedPayload.sdp).toBe('[REDACTED]');
    expect(insertedPayload.iceCandidates).toBe('[REDACTED]');
    expect(insertedPayload.password).toBe('[REDACTED]');
    expect(insertedPayload.token).toBe('[REDACTED]');
    expect(insertedPayload.authorization).toBe('[REDACTED]');
    expect(insertedPayload.message).toBe('joined');
    expect(inserted.callId).toBe('call-1');
    expect(inserted.userId).toBe('alice');
    expect(inserted.eventType).toBe('auth.success');
    expect(record.payload).toEqual(inserted.payload);
  });

  it('returns a record containing callId, userId, eventType, createdAt', async () => {
    const record = await logger.logCritical({
      callId: 'call-2',
      userId: 'bob',
      eventType: 'rate_limit.exceeded',
      payload: { reason: 'too many' },
    });

    expect(record.callId).toBe('call-2');
    expect(record.userId).toBe('bob');
    expect(record.eventType).toBe('rate_limit.exceeded');
    expect(record.createdAt).toBe(now);
  });

  it('uses injected createdAt when provided', async () => {
    const custom = new Date('2025-06-15T12:34:56.000Z');
    const record = await logger.logCritical({
      callId: 'call-3',
      userId: null,
      eventType: 'call.terminated',
      createdAt: custom,
    });
    expect(record.createdAt).toBe(custom);
    expect(repo.records[0].createdAt).toBe(custom);
  });

  it('normalizes missing userId to null', async () => {
    const record = await logger.logCritical({
      callId: 'call-4',
      eventType: 'auth.failure',
    });
    expect(record.userId).toBeNull();
    expect(repo.records[0].userId).toBeNull();
  });

  it('swallows repository errors and does not throw', async () => {
    repo.failOnce = true;
    const record = await logger.logCritical({
      callId: 'call-5',
      eventType: 'moderation.action',
    });
    expect(record.callId).toBe('call-5');
    expect(repo.records).toHaveLength(0);
  });

  it('works without a repository (logs warn)', async () => {
    const noRepo = new AuditLogger(null, {
      defaultClock: () => now,
      logger: {
        log: () => undefined,
        error: () => undefined,
        warn: () => undefined,
        debug: () => undefined,
        verbose: () => undefined,
      },
    });
    const record = await noRepo.logCritical({
      callId: 'call-6',
      eventType: 'auth.success',
    });
    expect(record.callId).toBe('call-6');
  });

  it('validates callId is non-empty', async () => {
    await expect(
      logger.logCritical({ callId: '', eventType: 'auth.success' }),
    ).rejects.toThrow(/callId/);
  });

  it('validates eventType is non-empty', async () => {
    await expect(
      logger.logCritical({ callId: 'c', eventType: '' }),
    ).rejects.toThrow(/eventType/);
  });
});
