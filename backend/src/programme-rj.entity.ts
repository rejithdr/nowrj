
import {
  Entity,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Programme } from './programme.entity';
import { Rj } from './rj.entity';

@Entity('programme_rjs')
export class ProgrammeRj {
  @PrimaryColumn({ type: 'uuid' })
  programmeId: string;

  @PrimaryColumn({ type: 'uuid' })
  rjId: string;

  @ManyToOne(() => Programme, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'programmeId' })
  programme: Programme;

  @ManyToOne(() => Rj, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rjId' })
  rj: Rj;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
