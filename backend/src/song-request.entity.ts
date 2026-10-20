import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type SongRequestStatus = 'new' | 'played' | 'skipped';

/** A listener's song request for one show. */
@Entity('song_requests')
@Index('IDX_song_requests_show', ['showOccurrenceId', 'createdAt'])
@Index('IDX_song_requests_listener', ['listenerId', 'showOccurrenceId'])
export class SongRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  showOccurrenceId: string;

  @Column({ type: 'uuid' })
  programmeId: string;

  @Column({ type: 'uuid' })
  listenerId: string;

  @Column({ type: 'varchar', length: 150 })
  songTitle: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  artist: string | null;

  @Column({ type: 'varchar', length: 280, nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: SongRequestStatus;

  @Column({ type: 'uuid', nullable: true })
  handledByListenerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  handledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
