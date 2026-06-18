import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'users' })
@Index('uq_users_provider_provider_sub', ['provider', 'providerSub'], {
  unique: true,
})
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  @Column({
    name: 'created_at',
    type: Date,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @Column({ type: 'varchar', length: 32, default: 'dev' })
  provider!: string;

  @Column({ name: 'provider_sub', type: 'varchar', length: 128 })
  providerSub!: string;

  @Column({ name: 'picture', type: 'varchar', length: 512, nullable: true })
  picture!: string | null;

  @Column({ name: 'last_login_at', type: Date, nullable: true })
  lastLoginAt!: Date | null;
}
