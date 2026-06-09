import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

export interface CreateUserInput {
  id?: string;
  email: string;
  displayName: string;
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

  async create(input: CreateUserInput): Promise<UserEntity> {
    const entity = this.repo.create({
      id: input.id ?? randomUUID(),
      email: input.email,
      displayName: input.displayName,
    });
    return this.repo.save(entity);
  }
}
