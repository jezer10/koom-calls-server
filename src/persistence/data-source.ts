import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { UserEntity } from '../auth/entities/user.entity';
import { Init1781655355076 } from './migrations/1781655355076-init';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [UserEntity],
  migrations: [Init1781655355076],
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
