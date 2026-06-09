import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  @Column({
    name: 'created_at',
    type: 'datetime',
    default: () => "datetime('now')",
  })
  createdAt!: Date;
}
