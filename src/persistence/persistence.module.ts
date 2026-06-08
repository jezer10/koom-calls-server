import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { UserEntity } from '../auth/entities/user.entity';
import { CallEntity } from '../calls/domain/call.entity';
import { CallEventEntity } from '../calls/domain/call-event.entity';
import { CallParticipantEntity } from '../participants/domain/participant.entity';

/**
 * SQLite is the M1 database. Driver is `better-sqlite3` (synchronous, fast,
 * no native build for x64 Linux in dev — install succeeded at bootstrap).
 * Falls back to `sqlite3` only if the native build is missing, but in this
 * environment `better-sqlite3` is available so we commit to it.
 */
const SQLITE_DRIVER: 'better-sqlite3' | 'sqlite3' = 'better-sqlite3';

function parseDatabaseUrl(raw: string | undefined): string {
  if (!raw || raw === '') {
    return ':memory:';
  }
  if (raw === 'sqlite::memory:') {
    return ':memory:';
  }
  if (raw.startsWith('sqlite:')) {
    return raw.slice('sqlite:'.length);
  }
  return raw;
}

function isMigrationRun(): boolean {
  if (process.env.TYPEORM_MIGRATIONS_RUN === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

function isSyncEnabled(): boolean {
  if (process.env.TYPEORM_SYNC === 'true') return true;
  return process.env.NODE_ENV === 'test';
}

function buildLogging(): ('error' | 'warn' | 'migration')[] {
  return process.env.NODE_ENV === 'development'
    ? ['error', 'warn', 'migration']
    : ['error'];
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const database = parseDatabaseUrl(process.env.DATABASE_URL);
        return {
          type: SQLITE_DRIVER,
          database,
          entities: [
            UserEntity,
            CallEntity,
            CallParticipantEntity,
            CallEventEntity,
          ],
          migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
          migrationsRun: isMigrationRun(),
          synchronize: isSyncEnabled(),
          logging: buildLogging(),
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class PersistenceModule {}
