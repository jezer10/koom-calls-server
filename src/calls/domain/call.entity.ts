import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CallMode, CallStatus, CallType } from './call.types';

@Entity({ name: 'calls' })
@Index('idx_calls_created_by', ['createdBy'])
export class CallEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: CallType.Video,
  })
  type!: CallType;

  @Column({
    type: 'varchar',
    length: 16,
    default: CallMode.Sfu,
  })
  mode!: CallMode;

  @Column({
    type: 'varchar',
    length: 16,
  })
  status!: CallStatus;

  @Column({ name: 'created_by', type: 'varchar', length: 36 })
  createdBy!: string;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'ended_at', type: 'datetime', nullable: true })
  endedAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    default: () => "datetime('now')",
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    default: () => "datetime('now')",
  })
  updatedAt!: Date;
}
