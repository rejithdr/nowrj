import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Programme } from './programme.entity';

/**
 * One time slot of a programme: the weekdays it airs (1 = Monday ...
 * 7 = Sunday) and its start and end time. An end before the start runs
 * past midnight. validTo (inclusive) is null while the slot is current.
 */
@Entity('programme_schedules')
@Index('IDX_programme_schedules_programmeId', ['programmeId'])
export class ProgrammeSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Programme, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'programmeId' })
  programme: Programme;

  @Column({ type: 'uuid' })
  programmeId: string;

  @Column({ type: 'smallint', array: true })
  daysOfWeek: number[];

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'date' })
  validFrom: string;

  @Column({ type: 'date', nullable: true })
  validTo: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
