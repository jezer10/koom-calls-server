import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  name = 'Init1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'email', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'display_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: "datetime('now')",
          },
        ],
        indices: [
          new TableIndex({
            name: 'idx_users_email',
            columnNames: ['email'],
            isUnique: true,
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'calls',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          {
            name: 'type',
            type: 'varchar',
            length: '16',
            isNullable: false,
            default: "'video'",
          },
          {
            name: 'mode',
            type: 'varchar',
            length: '16',
            isNullable: false,
            default: "'sfu'",
          },
          { name: 'status', type: 'varchar', length: '16', isNullable: false },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          { name: 'started_at', type: 'datetime', isNullable: true },
          { name: 'ended_at', type: 'datetime', isNullable: true },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: "datetime('now')",
          },
          {
            name: 'updated_at',
            type: 'datetime',
            isNullable: false,
            default: "datetime('now')",
          },
        ],
        indices: [
          new TableIndex({
            name: 'idx_calls_created_by',
            columnNames: ['created_by'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'call_participants',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'call_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'user_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'role', type: 'varchar', length: '16', isNullable: false },
          { name: 'status', type: 'varchar', length: '16', isNullable: false },
          { name: 'joined_at', type: 'datetime', isNullable: true },
          { name: 'left_at', type: 'datetime', isNullable: true },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: "datetime('now')",
          },
          {
            name: 'updated_at',
            type: 'datetime',
            isNullable: false,
            default: "datetime('now')",
          },
        ],
        indices: [
          new TableIndex({
            name: 'idx_call_participants_call_id',
            columnNames: ['call_id'],
          }),
          new TableIndex({
            name: 'idx_call_participants_user_id',
            columnNames: ['user_id'],
          }),
        ],
        uniques: [
          new TableUnique({
            name: 'uq_call_participants_call_user',
            columnNames: ['call_id', 'user_id'],
          }),
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'call_events',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'call_id', type: 'varchar', length: '36', isNullable: false },
          { name: 'user_id', type: 'varchar', length: '36', isNullable: true },
          {
            name: 'event_type',
            type: 'varchar',
            length: '64',
            isNullable: false,
          },
          { name: 'payload', type: 'text', isNullable: true },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: "datetime('now')",
          },
        ],
        indices: [
          new TableIndex({
            name: 'idx_call_events_call_id',
            columnNames: ['call_id'],
          }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('call_events', true);
    await queryRunner.dropTable('call_participants', true);
    await queryRunner.dropTable('calls', true);
    await queryRunner.dropTable('users', true);
  }
}
