import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  ParticipantRole,
  ParticipantStatus,
} from '../../calls/domain/call.types';

@Entity({ name: 'call_participants' })
@Unique('uq_call_participants_call_user', ['callId', 'userId'])
@Index('idx_call_participants_call_id', ['callId'])
@Index('idx_call_participants_user_id', ['userId'])
export class CallParticipantEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'call_id', type: 'varchar', length: 36 })
  callId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 16 })
  role!: ParticipantRole;

  @Column({ type: 'varchar', length: 16 })
  status!: ParticipantStatus;

  @Column({ name: 'joined_at', type: 'datetime', nullable: true })
  joinedAt!: Date | null;

  @Column({ name: 'left_at', type: 'datetime', nullable: true })
  leftAt!: Date | null;

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
