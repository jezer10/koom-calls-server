import type { Repository } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { UsersRepository } from '../users.repository';

function makeRepoDouble(): Repository<UserEntity> {
  const store = new Map<string, UserEntity>();

  return {
    create: jest.fn((input: Partial<UserEntity>) => input as UserEntity),
    save: jest.fn(async (entity: UserEntity) => {
      store.set(entity.id, { ...entity });
      return { ...entity };
    }),
    findOne: jest.fn(async ({ where }: { where: Partial<UserEntity> }) => {
      for (const entity of store.values()) {
        if (
          Object.entries(where).every(
            ([key, value]) => entity[key as keyof UserEntity] === value,
          )
        ) {
          return { ...entity };
        }
      }
      return null;
    }),
  } as unknown as Repository<UserEntity>;
}

describe('UsersRepository', () => {
  let repo: UsersRepository;

  beforeEach(() => {
    repo = new UsersRepository(makeRepoDouble());
  });

  it('creates a user with generated id', async () => {
    const u = await repo.create({
      email: 'a@x.com',
      displayName: 'A',
    });
    expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(u.email).toBe('a@x.com');
    expect(u.displayName).toBe('A');
  });

  it('preserves explicit id', async () => {
    const u = await repo.create({
      id: 'user-fixed',
      email: 'b@x.com',
      displayName: 'B',
    });
    expect(u.id).toBe('user-fixed');
  });

  it('findById returns null for missing users', async () => {
    await expect(repo.findById('missing')).resolves.toBeNull();
  });

  it('upserts by provider and updates the existing user', async () => {
    const first = await repo.upsertByProvider({
      provider: 'google',
      providerSub: 'goog-1',
      email: 'g@x.com',
      emailVerified: true,
      displayName: 'First',
      picture: null,
    });
    const second = await repo.upsertByProvider({
      provider: 'google',
      providerSub: 'goog-1',
      email: 'g@x.com',
      emailVerified: true,
      displayName: 'Second',
      picture: 'http://x/p.png',
    });

    expect(second.id).toBe(first.id);
    expect(second.displayName).toBe('Second');
    expect(second.picture).toBe('http://x/p.png');
    expect(second.lastLoginAt).toBeInstanceOf(Date);
  });
});
