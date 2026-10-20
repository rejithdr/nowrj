import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

/** A verified RJ confirming they know a pending RJ. */
@Entity('rj_vouches')
@Unique('UQ_rj_vouches_pair', ['rjId', 'voucherRjId'])
export class RjVouch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  rjId: string;

  @Column({ type: 'uuid' })
  voucherRjId: string;

  @Column({ type: 'varchar', length: 280, nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
