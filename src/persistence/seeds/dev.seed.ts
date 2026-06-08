import type { DataSource } from 'typeorm';
import { UserEntity } from '../../auth/entities/user.entity';

export const SEED_USERS: ReadonlyArray<{
  id: string;
  email: string;
  displayName: string;
}> = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'alice@koom.local',
    displayName: 'Alice',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'bob@koom.local',
    displayName: 'Bob',
  },
];

export async function runSeed(dataSource: DataSource): Promise<void> {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'production'
  ) {
    throw new Error(
      `Refusing to run dev seeds in NODE_ENV=${process.env.NODE_ENV}`,
    );
  }
  const repo = dataSource.getRepository(UserEntity);
  for (const u of SEED_USERS) {
    const existing = await repo.findOne({ where: { id: u.id } });
    if (existing) continue;
    await repo.insert({
      id: u.id,
      email: u.email,
      displayName: u.displayName,
    });
  }
}
