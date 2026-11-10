import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** "Ask the guest": a pre-recorded show with a guest; questions open 24h to 2h before recording. */
@Entity('guest_sessions')
export class GuestSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  programmeId: string;

  @Column({ type: 'varchar', length: 100 })
  guestName: string;

  /** One line about the guest, e.g. "Actor" or "Cardiologist". */
  @Column({ type: 'varchar', length: 100, nullable: true })
  guestLine: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  photoUrl: string | null;

  @Column({ type: 'timestamptz' })
  recordingAt: Date;

  /** When the recorded show airs, if known. */
  @Column({ type: 'timestamptz', nullable: true })
  airAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: 'scheduled' | 'cancelled';

  @Column({ type: 'uuid', nullable: true })
  createdByListenerId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
