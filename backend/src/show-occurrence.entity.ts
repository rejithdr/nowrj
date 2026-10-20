import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Programme } from './programme.entity';

export type ShowStatus = 'scheduled' | 'cancelled';

/**
 * One airing of a programme, generated from its schedule. The station and
 * owner are a snapshot taken until the show starts, then kept as aired.
 */
@Entity('show_occurrences')
@Unique('UQ_show_occurrences_programme_original_start', ['programmeId', 'originalStartsAt'])
@Index('IDX_show_occurrences_startsAt', ['startsAt'])
@Index('IDX_show_occurrences_endsAt', ['endsAt'])
export class ShowOccurrence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Programme, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'programmeId' })
  programme: Programme;

  @Column({ type: 'uuid' })
  programmeId: string;

  @Column({ type: 'uuid', nullable: true })
  scheduleId: string | null;

  /** The date in India on which the show starts. */
  @Column({ type: 'date' })
  airDate: string;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  /** When the schedule said it would start; differs from startsAt only if the show was moved. */
  @Column({ type: 'timestamptz' })
  originalStartsAt: Date;

  @Column({ type: 'timestamptz' })
  endsAt: Date;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: ShowStatus;

  @Column({ type: 'uuid', nullable: true })
  stationId: string | null;

  @Column({ type: 'uuid', nullable: true })
  ownerRjId: string | null;

  @Column({ type: 'uuid', nullable: true })
  ownerStationId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
