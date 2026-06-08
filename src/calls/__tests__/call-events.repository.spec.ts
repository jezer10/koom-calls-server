import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallEventEntity } from '../domain/call-event.entity';
import { CallEventsRepository } from '../call-events.repository';

describe('CallEventsRepository', () => {
  let module: TestingModule;
  let repo: CallEventsRepository;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [CallEventEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([CallEventEntity]),
      ],
      providers: [CallEventsRepository],
    }).compile();
    repo = module.get(CallEventsRepository);
  });

  afterEach(async () => {
    await module.close();
  });

  it('records an event with no payload', async () => {
    const e = await repo.record({
      callId: 'call-1',
      eventType: 'created',
    });
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(e.callId).toBe('call-1');
    expect(e.eventType).toBe('created');
    expect(e.payload).toBeNull();
  });

  it('records payload as JSON string', async () => {
    const e = await repo.record({
      callId: 'call-1',
      userId: 'u-1',
      eventType: 'ringing',
      payload: { foo: 'bar', n: 1 },
    });
    expect(e.payload).toBe(JSON.stringify({ foo: 'bar', n: 1 }));
  });

  it('listForCall returns events for that call in order', async () => {
    await repo.record({ callId: 'call-1', eventType: 'created' });
    await repo.record({ callId: 'call-1', eventType: 'ringing' });
    await repo.record({ callId: 'call-2', eventType: 'created' });
    const events = await repo.listForCall('call-1');
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.eventType)).toEqual(['created', 'ringing']);
  });

  it('listForCall honors the limit parameter', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.record({ callId: 'call-1', eventType: `e-${i}` });
    }
    const events = await repo.listForCall('call-1', 3);
    expect(events).toHaveLength(3);
  });
});
