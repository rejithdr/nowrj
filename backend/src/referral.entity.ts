import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type ReferralKind = 'listener' | 'rj';

/** Someone who joined NowRJ through an RJ's referral link. One per person. */
@Entity('referrals')
@Index('IDX_referrals_referrer', ['referrerRjId', 'createdAt'])
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  referrerRjId: string;

  @Column({ type: 'uuid', unique: true })
  referredListenerId: string;

  @Column({ type: 'varchar', length: 20, default: 'listener' })
  kind: ReferralKind;

  @Column({ type: 'uuid', nullable: true })
  referredRjId: string | null;

  /** When the referred RJ was verified. */
  @Column({ type: 'timestamptz', nullable: true })
  activatedAt: Date | null;

  /** Unused: referral rewards were dropped on 10 Nov 2026. Kept so no data is lost. */
  @Column({ type: 'timestamptz', nullable: true })
  rewardEndsAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
