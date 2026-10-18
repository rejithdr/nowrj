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
  '(("rjId" IS NOT NULL AND "programmeId" IS NULL) OR ("rjId" IS NULL AND "programmeId" IS NOT NULL))',
)
@Check(
  'CHK_reactions_type',
  `"type" IN ('like', 'fire')`,
)
export class Reaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  listenerId: string;

  @Column({ type: 'uuid', nullable: true })
  rjId: string | null;

  @Column({ type: 'uuid', nullable: true })
  programmeId: string | null;

  @Column({ type: 'varchar', length: 10 })
  type: 'like' | 'fire';

  @CreateDateColumn()
  createdAt: Date;
}