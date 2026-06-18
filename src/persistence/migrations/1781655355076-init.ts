import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class Init1781655355076 implements MigrationInterface {
  name = 'Init1781655355076';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          {
            name: 'display_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'provider',
            type: 'varchar',
            length: '32',
            isNullable: false,
            default: "'dev'",
          },
          {
            name: 'provider_sub',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'picture',
            type: 'varchar',
            length: '512',
            isNullable: true,
          },
          { name: 'last_login_at', type: 'timestamp', isNullable: true },
        ],
        indices: [
          new TableIndex({
            name: 'idx_users_email',
            columnNames: ['email'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'uq_users_provider_provider_sub',
            columnNames: ['provider', 'provider_sub'],
            isUnique: true,
          }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users', true);
  }
}
