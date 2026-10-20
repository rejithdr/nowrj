import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type ClaimStatus =
  | 'awaiting_rj'
  | 'approved_by_rj'
  | 'rejected_by_rj'
  | 'approved_by_admin'
  | 'rejected_by_admin'
  | 'cancelled';

/** A station asking to take over an RJ-owned programme. */
@Entity('programme_claims')
export class ProgrammeClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  programmeId: string;

  @Column({ type: 'uuid' })
  stationId: string;

  @Column({ type: 'uuid', nullable: true })
  requestedByListenerId: string | null;

  @Column({ type: 'varchar', length: 30, default: 'awaiting_rj' })
  status: ClaimStatus;

  @Column({ type: 'timestamptz', nullable: true })
  rjDecisionAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  rjDecisionByListenerId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rjReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  adminDecisionAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  adminDecisionByListenerId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  adminReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
