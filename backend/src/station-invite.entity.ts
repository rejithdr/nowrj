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
import { Rj } from './rj.entity';
import { Station } from './station.entity';

export type StationInviteStatus =
  | 'sent'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

/** An RJ's invitation to a station that is not on NowRJ yet. */
@Entity('station_invites')
@Index('IDX_station_invites_invitedByRjId', ['invitedByRjId'])
export class StationInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Rj, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invitedByRjId' })
  invitedByRj: Rj;

  @Column({ type: 'uuid' })
  invitedByRjId: string;

  @Column({ type: 'varchar', length: 150 })
  stationName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  contactPhone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  /** Secret link token; generate with crypto.randomBytes, never expose publicly. */
  @Column({ type: 'varchar', length: 64, unique: true })
  token: string;

  @Column({ type: 'varchar', length: 20, default: 'sent' })
  status: StationInviteStatus;

  @ManyToOne(() => Station, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stationId' })
  station: Station | null;

  @Column({ type: 'uuid', nullable: true })
  stationId: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
