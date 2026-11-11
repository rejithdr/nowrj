import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type OrgKind = 'network' | 'standalone';
export type UnitKind = 'region' | 'station';
export type Level = 'none' | 'view' | 'edit' | 'authorise';
export type StatsLevel = 'none' | 'view';

/** A radio network, or a single standalone station. */
@Entity('organisations')
export class Organisation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'varchar', length: 20 }) kind: OrgKind;
  /** Release 2b: a change of designation waits for a second admin. */
  @Column({ type: 'boolean', default: false }) designationChangesNeedApproval: boolean;
  @Column({ type: 'boolean', default: true }) isActive: boolean;
  /** Set by Super Admin: the whole network is hidden from listeners. */
  @Column({ type: 'timestamptz', nullable: true }) hiddenAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) createdByListenerId: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

/** A region or a station inside an organisation. No parent: directly under the head office. */
@Entity('org_units')
export class OrgUnit {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organisationId: string;
  @Column({ type: 'uuid', nullable: true }) parentId: string | null;
  @Column({ type: 'varchar', length: 20 }) kind: UnitKind;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'uuid', nullable: true }) stationId: string | null;
  /** Set by Super Admin: this region (and everything under it) or station is hidden from listeners. */
  @Column({ type: 'timestamptz', nullable: true }) hiddenAt: Date | null;
  @CreateDateColumn() createdAt: Date;
}

/** A name an organisation gives its staff, with a level for each area. */
@Entity('designations')
export class Designation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organisationId: string;
  @Column({ type: 'varchar', length: 80 }) name: string;
  @Column({ type: 'varchar', length: 10, default: 'none' }) programmes: Level;
  @Column({ type: 'varchar', length: 10, default: 'none' }) rjs: Level;
  @Column({ type: 'varchar', length: 10, default: 'none' }) adsSponsored: Level;
  @Column({ type: 'varchar', length: 10, default: 'none' }) adsShoutout: Level;
  @Column({ type: 'varchar', length: 10, default: 'none' }) adsAired: Level;
  @Column({ type: 'varchar', length: 10, default: 'none' }) stats: StatsLevel;
  /** Order of posts in the organisation: 1 is the highest. */
  @Column({ type: 'integer', default: 1000 }) rank: number;
  /** May invite, move and remove staff within their part of the organisation. */
  @Column({ type: 'boolean', default: false }) manageStaff: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

/** A person working in an organisation. No unit: at the head office (the whole organisation). */
@Entity('org_members')
export class OrgMember {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organisationId: string;
  @Column({ type: 'uuid' }) listenerId: string;
  @Column({ type: 'uuid', nullable: true }) unitId: string | null;
  @Column({ type: 'uuid' }) designationId: string;
  @Column({ type: 'varchar', length: 20, default: 'active' }) status: 'active' | 'removed';
  @Column({ type: 'uuid', nullable: true }) addedByListenerId: string | null;
  @Column({ type: 'timestamptz', nullable: true }) removedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

/** A link for one email address to join an organisation as staff. */
@Entity('org_invites')
export class OrgInvite {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) organisationId: string;
  @Column({ type: 'uuid', nullable: true }) unitId: string | null;
  @Column({ type: 'uuid' }) designationId: string;
  @Column({ type: 'varchar', length: 255 }) email: string;
  @Column({ type: 'varchar', length: 64 }) token: string;
  /** awaiting_approval: a post above the inviter's own, waiting for Super Admin. */
  @Column({ type: 'varchar', length: 20, default: 'sent' }) status: 'awaiting_approval' | 'sent' | 'accepted' | 'cancelled';
  @Column({ type: 'uuid', nullable: true }) invitedByListenerId: string | null;
  @Column({ type: 'uuid', nullable: true }) acceptedByListenerId: string | null;
  @Column({ type: 'timestamptz', nullable: true }) acceptedAt: Date | null;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @CreateDateColumn() createdAt: Date;
}

export const ORG_ENTITIES = [Organisation, OrgUnit, Designation, OrgMember, OrgInvite];
