
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('follows')
@Unique('UQ_follows_listener_rj', ['listenerId', 'rjId'])
@Index('IDX_follows_listenerId', ['listenerId'])
@Index('IDX_follows_rjId', ['rjId'])
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  listenerId: string;

  @Column({ type: 'uuid' })
  rjId: string;

  @CreateDateColumn()
  createdAt: Date;
}
