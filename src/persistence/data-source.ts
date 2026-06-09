import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity';
import { CallEntity } from '../calls/domain/call.entity';
import { CallEventEntity } from '../calls/domain/call-event.entity';
import { CallParticipantEntity } from '../participants/domain/participant.entity';
import { Init1700000000000 } from './migrations/1700000000000-init';

function parseDatabaseUrl(raw: string | undefined): string {
  if (!raw || raw === '') return ':memory:';
  if (raw === 'sqlite::memory:') return ':memory:';
  if (raw.startsWith('sqlite:')) return raw.slice('sqlite:'.length);
  return raw;
}

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: parseDatabaseUrl(process.env.DATABASE_URL),
  entities: [UserEntity, CallEntity, CallParticipantEntity, CallEventEntity],
  migrations: [Init1700000000000],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
