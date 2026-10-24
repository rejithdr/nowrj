
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Station } from './station.entity';

@Entity('programmes')
export class Programme {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  rjName: string | null;

  @Column({ type: 'time', nullable: true })
  startTime: string | null;

  @Column({ type: 'time', nullable: true })
  endTime: string | null;

  /** Live-show call-in number; editable by the hosting RJs and the owning station. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  callInPhone: string | null;

  /** What listeners send: song requests (default) or questions. */
  @Column({ type: 'varchar', length: 20, default: 'song' })
  interactionType: 'song' | 'question';

  /** Notice shown above the question box; null means the default health notice. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  noticeText: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** The station it airs on; empty while it waits on a station invite. */
  @ManyToOne(() => Station, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'stationId' })
  station: Station | null;

  @Column({ type: 'uuid', nullable: true })
  stationId: string | null;

  @Column({ type: 'uuid', nullable: true })
  stationInviteId: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByRjId: string | null;

  /** Current owner: exactly one of ownerRjId / ownerStationId is set. */
  @Column({ type: 'uuid', nullable: true })
  ownerRjId: string | null;

  @Column({ type: 'uuid', nullable: true })
  ownerStationId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
