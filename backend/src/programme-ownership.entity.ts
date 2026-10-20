import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Programme } from './programme.entity';

export type OwnershipReason =
  | 'created'
  | 'station_claim'
  | 'admin_transfer'
  | 'backfill';

/**
 * One period of a programme's ownership. Exactly one of ownerRjId and
 * ownerStationId is set; validTo is null for the current owner.
 * Revenue splits for a past date are read from this table.
 */
@Entity('programme_ownership_history')
@Index('IDX_programme_ownership_programmeId', ['programmeId'])
export class ProgrammeOwnership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Programme, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'programmeId' })
  programme: Programme;

  @Column({ type: 'uuid' })
  programmeId: string;

  @Column({ type: 'uuid', nullable: true })
  ownerRjId: string | null;

  @Column({ type: 'uuid', nullable: true })
  ownerStationId: string | null;

  @Column({ type: 'timestamptz' })
  validFrom: Date;

  @Column({ type: 'timestamptz', nullable: true })
  validTo: Date | null;

  @Column({ type: 'varchar', length: 30 })
  reason: OwnershipReason;

  @Column({ type: 'uuid', nullable: true })
  changedByListenerId: string | null;

  /** The station claim that caused this change, if any. */
  @Column({ type: 'uuid', nullable: true })
  claimId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
