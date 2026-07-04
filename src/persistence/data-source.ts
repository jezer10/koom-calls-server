import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity';
import { validateEnv } from '../config/env.schema';
import { Init1781655355076 } from './migrations/1781655355076-init';

const config = validateEnv(process.env);

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.DATABASE_URL,
  entities: [UserEntity],
  migrations: [Init1781655355076],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false,
});
