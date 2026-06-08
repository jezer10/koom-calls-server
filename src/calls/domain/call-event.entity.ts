import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity({ name: 'call_events' })
@Index('idx_call_events_call_id', ['callId'])
export class CallEventEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'call_id', type: 'varchar', length: 36 })
  callId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType!: string;

  @Column({ type: 'text', nullable: true })
  payload!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    default: () => "datetime('now')",
  })
  createdAt!: Date;
}
