import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';
import type { OAuthProfile } from './providers/oauth-provider.interface';

export interface CreateUserInput {
  id?: string;
  email?: string | null;
  displayName: string;
  provider?: string;
  providerSub?: string;
  picture?: string | null;
}

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByProviderSub(
    provider: string,
    providerSub: string,
  ): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { provider, providerSub } });
  }

  async create(input: CreateUserInput): Promise<UserEntity> {
    const id = input.id ?? randomUUID();
    const entity = this.repo.create({
      id,
      email: input.email ?? null,
      displayName: input.displayName,
      provider: input.provider ?? 'dev',
      providerSub: input.providerSub ?? id,
      picture: input.picture ?? null,
      lastLoginAt: null,
    });
    return this.repo.save(entity);
  }

  async upsertByProvider(profile: OAuthProfile): Promise<UserEntity> {
    const existing = await this.findByProviderSub(
      profile.provider,
      profile.providerSub,
    );
    const now = new Date();
    if (existing) {
      existing.email = profile.email;
      existing.displayName = profile.displayName;
      existing.picture = profile.picture;
      existing.lastLoginAt = now;
      return this.repo.save(existing);
    }
    return this.create({
      email: profile.email,
      displayName: profile.displayName,
      provider: profile.provider,
      providerSub: profile.providerSub,
      picture: profile.picture,
    }).then(async (u) => {
      u.lastLoginAt = now;
      return this.repo.save(u);
    });
  }
}
