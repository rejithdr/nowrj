import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

export type ExceptionAction = 'cancel' | 'move';

/** One day's show cancelled or moved, leaving the weekly schedule alone. */
@Entity('programme_schedule_exceptions')
@Unique('UQ_programme_schedule_exceptions_show', ['programmeId', 'originalStartsAt'])
export class ScheduleException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  programmeId: string;

  /** When the show was scheduled to start; identifies the show. */
  @Column({ type: 'timestamptz' })
  originalStartsAt: Date;

  @Column({ type: 'varchar', length: 10 })
  action: ExceptionAction;

  @Column({ type: 'timestamptz', nullable: true })
  newStartsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  newEndsAt: Date | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByListenerId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
