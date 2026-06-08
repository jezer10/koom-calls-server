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
});
