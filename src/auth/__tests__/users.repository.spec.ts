import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../entities/user.entity';
import { UsersRepository } from '../users.repository';

describe('UsersRepository', () => {
  let module: TestingModule;
  let repo: UsersRepository;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [UserEntity],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([UserEntity]),
      ],
      providers: [UsersRepository],
    }).compile();
    repo = module.get(UsersRepository);
  });

  afterEach(async () => {
    await module.close();
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

  it('findById returns the user', async () => {
    const u = await repo.create({ email: 'c@x.com', displayName: 'C' });
    const found = await repo.findById(u.id);
    expect(found?.email).toBe('c@x.com');
  });

  it('findById returns null for missing', async () => {
    const found = await repo.findById('missing');
    expect(found).toBeNull();
  });

  it('findByEmail returns the user', async () => {
    await repo.create({ email: 'd@x.com', displayName: 'D' });
    const found = await repo.findByEmail('d@x.com');
    expect(found?.displayName).toBe('D');
  });

  it('findByEmail returns null for missing', async () => {
    const found = await repo.findByEmail('nope@x.com');
    expect(found).toBeNull();
  });

  it('create accepts missing email (nullable column)', async () => {
    const u = await repo.create({ displayName: 'NoEmail' });
    expect(u.email).toBeNull();
    expect(u.provider).toBe('dev');
    expect(u.providerSub).toBe(u.id);
  });

  describe('upsertByProvider', () => {
    it('creates a new user when (provider, providerSub) does not exist', async () => {
      const u = await repo.upsertByProvider({
        provider: 'google',
        providerSub: 'goog-1',
        email: 'g@x.com',
        emailVerified: true,
        displayName: 'G',
        picture: 'http://x/p.png',
      });
      expect(u.provider).toBe('google');
      expect(u.providerSub).toBe('goog-1');
      expect(u.email).toBe('g@x.com');
      expect(u.picture).toBe('http://x/p.png');
      expect(u.lastLoginAt).toBeInstanceOf(Date);
    });

    it('updates an existing user when (provider, providerSub) matches', async () => {
      const first = await repo.upsertByProvider({
        provider: 'google',
        providerSub: 'goog-2',
        email: 'g2@x.com',
        emailVerified: true,
        displayName: 'G2-old',
        picture: null,
      });
      const firstLogin = first.lastLoginAt;
      await new Promise((r) => setTimeout(r, 5));
      const second = await repo.upsertByProvider({
        provider: 'google',
        providerSub: 'goog-2',
        email: 'g2@x.com',
        emailVerified: true,
        displayName: 'G2-new',
        picture: 'http://x/p2.png',
      });
      expect(second.id).toBe(first.id);
      expect(second.displayName).toBe('G2-new');
      expect(second.picture).toBe('http://x/p2.png');
      expect(second.lastLoginAt!.getTime()).toBeGreaterThan(
        firstLogin!.getTime(),
      );
    });

    it('handles null email from providers that do not expose one', async () => {
      const u = await repo.upsertByProvider({
        provider: 'google',
        providerSub: 'goog-3',
        email: null,
        emailVerified: true,
        displayName: 'Anon',
        picture: null,
      });
      expect(u.email).toBeNull();
    });
  });
});
