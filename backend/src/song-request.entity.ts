import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type SongRequestStatus = 'new' | 'played' | 'skipped';
export type SongRequestKind = 'song' | 'question';

/**
 * A listener's song request or question. It belongs to one show, or (for
 * "Ask the guest") to one guest session. 'played' means answered on air, or
 * used in the recording for a guest question.
 */
@Entity('song_requests')
@Index('IDX_song_requests_show', ['showOccurrenceId', 'createdAt'])
@Index('IDX_song_requests_listener', ['listenerId', 'showOccurrenceId'])
export class SongRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  showOccurrenceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  guestSessionId: string | null;

  @Column({ type: 'uuid' })
  programmeId: string;

  @Column({ type: 'uuid' })
  listenerId: string;

  @Column({ type: 'varchar', length: 20, default: 'song' })
  kind: SongRequestKind;

  /** Null for questions; the question text is in `message`. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  songTitle: string | null;

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
