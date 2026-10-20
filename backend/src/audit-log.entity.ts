import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** One recorded approval, rejection or ownership change. */
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  actorListenerId: string | null;

  @Column({ type: 'varchar', length: 60 })
  action: string;

  @Column({ type: 'varchar', length: 40 })
  entityType: string;

  @Column({ type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
