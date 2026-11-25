import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type SongRequestStatus = 'new' | 'played' | 'skipped';
/** song: a request; dedication: for someone, with a message; message: a note to the RJ; question: question-mode programmes and Ask the guest. */
export type SongRequestKind = 'song' | 'question' | 'dedication' | 'message';

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

  /** Dedications: who it is for. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  dedicatedTo: string | null;

  @Column({ type: 'varchar', length: 20, default: 'new' })
  status: SongRequestStatus;

  /** Which name the listener agreed may be read on air. */
  @Column({ type: 'varchar', length: 10, default: 'display' })
  nameOnAir: 'display' | 'first' | 'none';

  /** Whether it may be read on air. Null: sent before listeners were asked. */
  @Column({ type: 'boolean', nullable: true })
  okOnAir: boolean | null;

  /** When the host RJ ('rj') or the station first saw it in their queue. */
  @Column({ type: 'timestamptz', nullable: true })
  seenAt: Date | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  seenBy: 'rj' | 'station' | null;

  @Column({ type: 'uuid', nullable: true })
  handledByListenerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  handledAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
