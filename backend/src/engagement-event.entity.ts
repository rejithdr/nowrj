import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type EngagementType = 'call_tap';

/** A listener action such as tapping a show's Call button (intent, not a connected call). */
@Entity('engagement_events')
@Index('IDX_engagement_events_show', ['showOccurrenceId'])
@Index('IDX_engagement_events_programme_time', ['programmeId', 'createdAt'])
export class EngagementEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  type: EngagementType;

  @Column({ type: 'uuid' })
  programmeId: string;

  @Column({ type: 'uuid', nullable: true })
  showOccurrenceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  listenerId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  deviceId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
