import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type RoleName = 'superadmin' | 'station_rep';
export type RoleStatus = 'pending' | 'active' | 'revoked';

/** A role a listener holds, e.g. representative of one station. */
@Entity('user_roles')
@Index('IDX_user_roles_stationId', ['stationId'])
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  listenerId: string;

  @Column({ type: 'varchar', length: 30 })
  role: RoleName;

  @Column({ type: 'uuid', nullable: true })
  stationId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: RoleStatus;

  @Column({ type: 'uuid', nullable: true })
  grantedByListenerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  grantedAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
