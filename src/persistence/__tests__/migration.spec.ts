import { DataSource } from 'typeorm';
import { UserEntity } from '../../auth/entities/user.entity';
import { CallEntity } from '../../calls/domain/call.entity';
import { CallEventEntity } from '../../calls/domain/call-event.entity';
import { CallParticipantEntity } from '../../participants/domain/participant.entity';
import { Init1700000000000 } from '../migrations/1700000000000-init';

interface TableNameRow {
  name: string;
}

interface ColumnInfoRow {
  name: string;
  type: string;
  notnull: number;
}

interface IndexListRow {
  name: string;
  unique: number;
}

interface IndexInfoRow {
  name: string;
}

describe('persistence init migration', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [
        UserEntity,
        CallEntity,
        CallParticipantEntity,
        CallEventEntity,
      ],
      migrations: [Init1700000000000],
      synchronize: false,
    });
    await ds.initialize();
    await ds.runMigrations();
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('creates all four tables', async () => {
    const tables: TableNameRow[] = await ds.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'users',
        'calls',
        'call_participants',
        'call_events',
      ]),
    );
  });

  it('users has the expected columns', async () => {
    const cols: ColumnInfoRow[] = await ds.query(`PRAGMA table_info('users')`);
    const byName = new Map(cols.map((c) => [c.name, c]));
    expect(byName.get('id')?.type).toBe('varchar(36)');
    expect(byName.get('email')?.type).toBe('varchar(255)');
    expect(byName.get('email')?.notnull).toBe(1);
    expect(byName.get('display_name')?.type).toBe('varchar(255)');
    expect(byName.get('created_at')?.type).toMatch(/datetime/);
  });

  it('calls has the expected columns', async () => {
    const cols: ColumnInfoRow[] = await ds.query(`PRAGMA table_info('calls')`);
    const names = cols.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'type',
        'mode',
        'status',
        'created_by',
        'started_at',
        'ended_at',
        'created_at',
        'updated_at',
      ]),
    );
  });

  it('call_participants has unique (call_id, user_id)', async () => {
    const indexes: IndexListRow[] = await ds.query(
      `PRAGMA index_list('call_participants')`,
    );
    const uniqueIdx = indexes.find((i) => i.unique === 1);
    expect(uniqueIdx).toBeDefined();
    const cols: IndexInfoRow[] = await ds.query(
      `PRAGMA index_info('${uniqueIdx?.name}')`,
    );
    const colNames = cols.map((c) => c.name);
    expect(colNames).toEqual(expect.arrayContaining(['call_id', 'user_id']));
  });

  it('call_events has the expected columns', async () => {
    const cols: ColumnInfoRow[] = await ds.query(
      `PRAGMA table_info('call_events')`,
    );
    const names = cols.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'call_id',
        'user_id',
        'event_type',
        'payload',
        'created_at',
      ]),
    );
  });

  it('reverts cleanly', async () => {
    await ds.undoLastMigration();
    const tables: TableNameRow[] = await ds.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const names = tables.map((t) => t.name);
    expect(names).not.toContain('users');
    expect(names).not.toContain('calls');
    expect(names).not.toContain('call_participants');
    expect(names).not.toContain('call_events');
  });
});
