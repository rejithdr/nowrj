import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Check,
  Index,
} from 'typeorm';

@Entity('reactions')

@Index('IDX_reactions_listenerId', ['listenerId'])
@Check(
  'CHK_reactions_one_target',
  'num_nonnulls("rjId", "programmeId", "showOccurrenceId") = 1',
)
@Check(
  'CHK_reactions_type',
  `"type" IN ('like', 'fire')`,
)
export class Reaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null for a signed-out listener's reaction, which has a deviceId instead. */
  @Column({ type: 'uuid', nullable: true })
  listenerId: string | null;

  /** Signed-out reactions to a show: the random id in the phone's cookie (see device.ts). */
  @Column({ type: 'uuid', nullable: true })
  deviceId: string | null;

  @Column({ type: 'uuid', nullable: true })
  rjId: string | null;

  @Column({ type: 'uuid', nullable: true })
  programmeId: string | null;

  /** A reaction to one particular show (Like or Fire on a live-show card). */
  @Column({ type: 'uuid', nullable: true })
  showOccurrenceId: string | null;

  @Column({ type: 'varchar', length: 10 })
  type: 'like' | 'fire';

  @CreateDateColumn()
  createdAt: Date;
}