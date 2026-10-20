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

export type AffiliationStatus = 'pending' | 'verified' | 'rejected' | 'disputed';

/**
 * One period of an RJ working at a station, like a line on a CV.
 * leftOn is null while it is the RJ's current station.
 */
@Entity('rj_station_affiliations')
@Index('IDX_rj_station_affiliations_rjId', ['rjId'])
@Index('IDX_rj_station_affiliations_stationId', ['stationId'])
export class RjStationAffiliation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Rj, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rjId' })
  rj: Rj;

  @Column({ type: 'uuid' })
  rjId: string;

  @ManyToOne(() => Station, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stationId' })
  station: Station;

  @Column({ type: 'uuid' })
  stationId: string;

  @Column({ type: 'date' })
  joinedOn: string;

  @Column({ type: 'date', nullable: true })
  leftOn: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  verificationStatus: AffiliationStatus;

  @Column({ type: 'uuid', nullable: true })
  verifiedByListenerId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
