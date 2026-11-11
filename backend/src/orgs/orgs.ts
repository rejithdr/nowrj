import { Rj } from '../rj.entity';
import { RjStationAffiliation } from '../rj-station-affiliation.entity';
import { OrgRjsController, OrgRjsService } from './org-rjs';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  GoneException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Request } from 'express';
import { randomBytes } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { Listener } from '../listener.entity';
import { Station } from '../station.entity';
import { UserRole } from '../user-role.entity';
import { clean, EMAIL, PHONE, slugify, writeAudit } from '../onboarding/helpers';
import { AREAS, Area, isLevel, meets, withinScope, wouldCreateCycle } from './access';
import { Designation, Level, Organisation, OrgInvite, OrgMember, OrgUnit, ORG_ENTITIES } from './entities';
import { ensureStationOrganisation, FULL_LEVELS, HEAD_OFFICE_ADMIN, STATION_ADMIN } from './org-setup';

const DAY = 24 * 3600 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export { INVITE_DAYS, emailHint } from './invite-rules';
import { INVITE_DAYS, emailHint } from './invite-rules';

/** Who is acting: a staff manager in the organisation, or the NowRJ Super Admin. */
type Actor = {
  listenerId: string;
  superadmin: boolean;
  /** null: the whole organisation. */
  scopeUnitId: string | null;
  member: OrgMember | null;
  designation: Designation | null;
};

export type DesignationInput = Partial<Record<Area, string>> & { name?: string; manageStaff?: boolean };

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}


@Injectable()
export class OrgsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  private async isSuperadmin(m: EntityManager, listenerId: string) {
    const listener = await m.findOneBy(Listener, { id: listenerId });
    const email = listener?.email?.trim().toLowerCase();
    const admins = (this.config.get<string>('SUPERADMIN_EMAILS') ?? '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    return Boolean(email && admins.includes(email));
  }

  private async org(m: EntityManager, organisationId: string) {
    const org = await m.findOneBy(Organisation, { id: organisationId });
    if (!org) throw new NotFoundException('Organisation not found.');
    return org;
  }

  /** Throws unless the person may manage staff in this organisation (or is Super Admin). */
  private async actor(m: EntityManager, listenerId: string, organisationId: string): Promise<Actor> {
    const member = await m.findOneBy(OrgMember, { organisationId, listenerId, status: 'active' });
    const designation = member ? await m.findOneBy(Designation, { id: member.designationId }) : null;
    if (member && designation?.manageStaff) {
      return { listenerId, superadmin: false, scopeUnitId: member.unitId, member, designation };
    }
    if (await this.isSuperadmin(m, listenerId)) {
      return { listenerId, superadmin: true, scopeUnitId: null, member, designation };
    }
    throw new ForbiddenException('Only staff who can manage staff may do this.');
  }

  private assertWholeOrg(actor: Actor) {
    if (actor.scopeUnitId !== null) {
      throw new ForbiddenException('Only head-office admins can change the structure and designations.');
    }
  }

  private units(m: EntityManager, organisationId: string) {
    return m.find(OrgUnit, { where: { organisationId }, order: { name: 'ASC' } });
  }

  /**
   * Posts are ranked (1 = highest). Super Admin is above every post. A
   * manager acts only on people in a lower post than their own.
   */
  private rankOf(actor: Actor) {
    return actor.superadmin ? 0 : actor.designation?.rank ?? Number.MAX_SAFE_INTEGER;
  }

  /**
   * Admins hire ordinary staff (programme managers and the like) only for
   * their own place: head office, region or station. For the places under
   * them they appoint only the admins, who then hire their own staff.
   */
  private assertPlacement(actor: Actor, unitId: string | null, designation: Designation, placeName: string) {
    if (actor.superadmin || unitId === actor.scopeUnitId || designation.manageStaff) return;
    throw new ForbiddenException(
      `Staff at ${placeName} are added by its own admin. You can appoint its admin, or add "${designation.name}" at your own place.`,
    );
  }

  /** Staff may edit or delete a designation only if it is below their own post. */
  private assertBelow(actor: Actor, designation: Designation, what: string) {
    if (!actor.superadmin && designation.rank <= this.rankOf(actor)) {
      throw new ForbiddenException(`Only someone in a higher post, or the NowRJ team, can ${what} "${designation.name}".`);
    }
  }

  /** Head-office staff who can manage staff. At least one must remain. */
  private async headOfficeAdmins(m: EntityManager, organisationId: string) {
    const [row] = await m.query(
      `SELECT count(*)::int AS n FROM org_members om JOIN designations d ON d.id = om."designationId"
        WHERE om."organisationId" = $1 AND om.status = 'active' AND om."unitId" IS NULL AND d."manageStaff"`,
      [organisationId],
    );
    return row.n as number;
  }

  private async keepAnAdmin(m: EntityManager, organisationId: string, before: number) {
    if (before > 0 && (await this.headOfficeAdmins(m, organisationId)) === 0) {
      throw new ConflictException('This would leave no head-office admin who can manage staff. Make someone else one first.');
    }
  }

  private async unitInOrg(m: EntityManager, organisationId: string, unitId: unknown) {
    if (unitId === null || unitId === undefined || unitId === '') return null;
    if (typeof unitId !== 'string' || !UUID.test(unitId)) throw new BadRequestException('That place is not in this organisation.');
    const unit = await m.findOneBy(OrgUnit, { id: unitId, organisationId });
    if (!unit) throw new BadRequestException('That place is not in this organisation.');
    return unit;
  }

  private async designationInOrg(m: EntityManager, organisationId: string, designationId: unknown) {
    const d = typeof designationId === 'string' && UUID.test(designationId) ? await m.findOneBy(Designation, { id: designationId, organisationId }) : null;
    if (!d) throw new BadRequestException('Choose a designation from this organisation.');
    return d;
  }

  // ----------------------------------------------------------------- reading

  /** The organisations this person works in, with what they can do there. */
  async mine(listenerId: string) {
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT o.id, o.name, o.kind, d.name AS "designationName", d."manageStaff", d.rjs,
              om."unitId", u.name AS "unitName"
         FROM org_members om
         JOIN organisations o ON o.id = om."organisationId" AND o."isActive"
         JOIN designations d ON d.id = om."designationId"
         LEFT JOIN org_units u ON u.id = om."unitId"
        WHERE om."listenerId" = $1 AND om.status = 'active'
        ORDER BY o.name`,
      [listenerId],
    );
    return rows;
  }

  /** Structure, designations, staff and open invites, for someone who manages staff. */
  async overview(listenerId: string, organisationId: string, now = new Date()) {
    const m = this.dataSource.manager;
    const org = await this.org(m, organisationId);
    const actor = await this.actor(m, listenerId, organisationId);
    const units = await this.units(m, organisationId);
    const stations = await m.findBy(Station, { id: In(units.map((u) => u.stationId).filter((id): id is string => Boolean(id))) });
    const designations = await m.find(Designation, { where: { organisationId }, order: { rank: 'ASC', name: 'ASC' } });
    const members: { id: string; listenerId: string; name: string | null; email: string | null; unitId: string | null; designationId: string; createdAt: Date }[] =
      await m.query(
        `SELECT om.id, om."listenerId", l."displayName" AS name, l.email, om."unitId", om."designationId", om."createdAt"
           FROM org_members om JOIN listeners l ON l.id = om."listenerId"
          WHERE om."organisationId" = $1 AND om.status = 'active'
          ORDER BY l."displayName"`,
        [organisationId],
      );
    const invites = await m.find(OrgInvite, { where: { organisationId, status: In(['sent', 'awaiting_approval']) }, order: { createdAt: 'DESC' } });
    const inScope = (unitId: string | null) => withinScope(units, actor.scopeUnitId, unitId);

    return {
      organisation: { id: org.id, name: org.name, kind: org.kind, hidden: Boolean(org.hiddenAt) },
      me: {
        superadmin: actor.superadmin,
        memberId: actor.member?.id ?? null,
        wholeOrg: actor.scopeUnitId === null,
        scopeUnitId: actor.scopeUnitId,
        rank: this.rankOf(actor),
      },
      units: units.map((u) => ({
        id: u.id,
        parentId: u.parentId,
        kind: u.kind,
        name: u.name,
        stationId: u.stationId,
        stationSlug: stations.find((s) => s.id === u.stationId)?.slug ?? null,
        stationStatus: stations.find((s) => s.id === u.stationId)?.verificationStatus ?? null,
        hidden: Boolean(u.hiddenAt),
        inScope: inScope(u.id),
      })),
      designations: designations.map((d) => ({
        id: d.id,
        name: d.name,
        rank: d.rank,
        ...Object.fromEntries(AREAS.map((a) => [a, d[a]])),
        manageStaff: d.manageStaff,
        memberCount: members.filter((x) => x.designationId === d.id).length,
      })),
      members: members.map((x) => ({ ...x, inScope: inScope(x.unitId), isMe: x.listenerId === listenerId })),
      invites: invites
        .filter((i) => inScope(i.unitId))
        .map((i) => ({
          id: i.id,
          email: i.email,
          unitId: i.unitId,
          designationId: i.designationId,
          token: i.status === 'sent' ? i.token : null,
          status: i.status,
          expiresAt: i.expiresAt,
          expired: i.expiresAt < now,
        })),
    };
  }

  // --------------------------------------------------------------- structure

  async createRegion(listenerId: string, organisationId: string, input: { name?: string; parentId?: string | null }) {
    const name = clean(input.name);
    if (!name) throw new BadRequestException('Enter the region name.');
    if (name.length > 150) throw new BadRequestException('Region name is too long.');
    return this.dataSource.transaction(async (m) => {
      const org = await this.org(m, organisationId);
      const actor = await this.actor(m, listenerId, organisationId);
      this.assertWholeOrg(actor);
      if (org.kind !== 'network') throw new BadRequestException('Regions are for networks with several stations.');
      const parent = await this.unitInOrg(m, organisationId, input.parentId);
      if (parent && parent.kind !== 'region') throw new BadRequestException('A region can only sit under the head office or another region.');
      const unit = await m.save(m.create(OrgUnit, { organisationId, kind: 'region', name, parentId: parent?.id ?? null, stationId: null }));
      await writeAudit(m, listenerId, 'org_unit.created', 'org_unit', unit.id, { organisationId, name, parentId: unit.parentId });
      return { id: unit.id };
    });
  }

  /** Rename a region, or move a region or station under another region (or the head office). */
  async updateUnit(listenerId: string, organisationId: string, unitId: string, input: { name?: string; parentId?: string | null }) {
    return this.dataSource.transaction(async (m) => {
      await this.org(m, organisationId);
      const actor = await this.actor(m, listenerId, organisationId);
      this.assertWholeOrg(actor);
      const units = await this.units(m, organisationId);
      const unit = units.find((u) => u.id === unitId);
      if (!unit) throw new NotFoundException('Not found in this organisation.');
      const changes: Partial<OrgUnit> = {};
      if (input.name !== undefined) {
        const name = clean(input.name);
        if (unit.kind === 'station') throw new BadRequestException('A station keeps its own name.');
        if (!name || name.length > 150) throw new BadRequestException('Enter a region name of up to 150 characters.');
        changes.name = name;
      }
      if (input.parentId !== undefined) {
        const parent = await this.unitInOrg(m, organisationId, input.parentId);
        if (parent && parent.kind !== 'region') throw new BadRequestException('Only a region can hold other places.');
        if (wouldCreateCycle(units, unit.id, parent?.id ?? null)) {
          throw new BadRequestException('A region cannot be moved inside itself.');
        }
        changes.parentId = parent?.id ?? null;
      }
      if (!Object.keys(changes).length) return { id: unit.id };
      await m.update(OrgUnit, { id: unit.id }, changes);
      await writeAudit(m, listenerId, 'org_unit.updated', 'org_unit', unit.id, {
        organisationId,
        from: { name: unit.name, parentId: unit.parentId },
        to: changes,
      });
      return { id: unit.id };
    });
  }

  async deleteRegion(listenerId: string, organisationId: string, unitId: string) {
    return this.dataSource.transaction(async (m) => {
      const actor = await this.actor(m, listenerId, organisationId);
      this.assertWholeOrg(actor);
      const unit = await m.findOneBy(OrgUnit, { id: unitId, organisationId });
      if (!unit) throw new NotFoundException('Not found in this organisation.');
      if (unit.kind !== 'region') throw new BadRequestException('Only regions can be removed here.');
      if (await m.existsBy(OrgUnit, { parentId: unit.id })) throw new ConflictException('Move the stations and regions out of this region first.');
      if (await m.existsBy(OrgMember, { unitId: unit.id, status: 'active' })) throw new ConflictException('Move or remove the staff placed in this region first.');
      await m.delete(OrgInvite, { unitId: unit.id });
      await m.query(`UPDATE org_members SET "unitId" = NULL WHERE "unitId" = $1 AND status = 'removed'`, [unit.id]);
      await m.delete(OrgUnit, { id: unit.id });
      await writeAudit(m, listenerId, 'org_unit.deleted', 'org_unit', unit.id, { organisationId, name: unit.name });
      return { id: unit.id };
    });
  }

  // ------------------------------------------------------------ designations

  private designationFields(input: DesignationInput, current?: Designation) {
    const out: Partial<Designation> = {};
    if (input.name !== undefined || !current) {
      const name = clean(input.name);
      if (!name) throw new BadRequestException('Enter the designation name.');
      if (name.length > 80) throw new BadRequestException('Designation name is too long (80 characters at most).');
      out.name = name;
    }
    for (const area of AREAS) {
      const value = input[area];
      if (value === undefined) continue;
      if (!isLevel(value, area)) throw new BadRequestException(`Choose a valid level for ${area}.`);
      (out as Record<string, unknown>)[area] = value as Level;
    }
    if (input.manageStaff !== undefined) out.manageStaff = Boolean(input.manageStaff);
    return out;
  }

  private async nameFree(m: EntityManager, organisationId: string, name: string, exceptId?: string) {
    const clash = await m
      .createQueryBuilder(Designation, 'd')
      .where('d."organisationId" = :organisationId AND lower(d.name) = lower(:name)', { organisationId, name })
      .getOne();
    if (clash && clash.id !== exceptId) throw new ConflictException(`There is already a designation called "${clash.name}".`);
  }

  async createDesignation(listenerId: string, organisationId: string, input: DesignationInput) {
    const fields = this.designationFields(input ?? {});
    return this.dataSource.transaction(async (m) => {
      const actor = await this.actor(m, listenerId, organisationId);
      this.assertWholeOrg(actor);
      await this.nameFree(m, organisationId, fields.name!);
      const none = Object.fromEntries(AREAS.map((a) => [a, 'none']));
      // A new post goes to the bottom of the order; head office can move it up.
      const [{ max }] = await m.query(`SELECT coalesce(max(rank), 0)::int AS max FROM designations WHERE "organisationId" = $1`, [organisationId]);
      const d = m.create(Designation, { organisationId, ...none, manageStaff: false, ...fields, rank: max + 1 });
      const saved = await m.save(d);
      await writeAudit(m, listenerId, 'designation.created', 'designation', saved.id, { organisationId, ...fields });
      return { id: saved.id };
    });
  }

  async updateDesignation(listenerId: string, organisationId: string, designationId: string, input: DesignationInput) {
    return this.dataSource.transaction(async (m) => {
      const actor = await this.actor(m, listenerId, organisationId);
      this.assertWholeOrg(actor);
      const d = await m.findOne(Designation, { where: { id: designationId, organisationId }, lock: { mode: 'pessimistic_write' } });
      if (!d) throw new NotFoundException('Designation not found.');
      this.assertBelow(actor, d, 'change');
      const fields = this.designationFields(input ?? {}, d);
      if (fields.name) await this.nameFree(m, organisationId, fields.name, d.id);
      const before = { ...d };
      const admins = await this.headOfficeAdmins(m, organisationId);
      Object.assign(d, fields);
      await m.save(d);
      await this.keepAnAdmin(m, organisationId, admins);
      await writeAudit(m, listenerId, 'designation.updated', 'designation', d.id, {
        organisationId,
        from: Object.fromEntries(Object.keys(fields).map((k) => [k, (before as Record<string, unknown>)[k]])),
        to: fields,
      });
      return { id: d.id };
    });
  }

  async deleteDesignation(listenerId: string, organisationId: string, designationId: string) {
    return this.dataSource.transaction(async (m) => {
      const actor = await this.actor(m, listenerId, organisationId);
      this.assertWholeOrg(actor);
      const d = await m.findOneBy(Designation, { id: designationId, organisationId });
      if (!d) throw new NotFoundException('Designation not found.');
      this.assertBelow(actor, d, 'remove');
      if (await m.existsBy(OrgMember, { designationId: d.id, status: 'active' })) {
        throw new ConflictException('Staff still hold this designation. Give them another one first.');
      }
      await m.delete(OrgInvite, { designationId: d.id });
      await m.delete(OrgMember, { designationId: d.id, status: 'removed' });
      await m.delete(Designation, { id: d.id });
      await writeAudit(m, listenerId, 'designation.deleted', 'designation', d.id, { organisationId, name: d.name });
      return { id: d.id };
    });
  }

  /**
   * Head office sets the order of posts, highest first. Posts at or above
   * the admin's own keep their places; only those below can be reordered.
   */
  async reorderDesignations(listenerId: string, organisationId: string, ids: unknown) {
    if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) throw new BadRequestException('Send the designations in their new order.');
    return this.dataSource.transaction(async (m) => {
      const actor = await this.actor(m, listenerId, organisationId);
      this.assertWholeOrg(actor);
      const current = await m.find(Designation, { where: { organisationId }, order: { rank: 'ASC', name: 'ASC' }, lock: { mode: 'pessimistic_write' } });
      if (ids.length !== current.length || new Set(ids).size !== ids.length || !current.every((d) => ids.includes(d.id))) {
        throw new BadRequestException('Send every designation exactly once.');
      }
      if (!actor.superadmin) {
        const fixed = current.filter((d) => d.rank <= this.rankOf(actor)).map((d) => d.id);
        if (fixed.some((id, i) => ids[i] !== id)) {
          throw new ForbiddenException('You can only reorder posts below your own.');
        }
      }
      for (const [i, id] of (ids as string[]).entries()) await m.update(Designation, { id }, { rank: i + 1 });
      await writeAudit(m, listenerId, 'designation.reordered', 'organisation', organisationId, {
        order: (ids as string[]).map((id) => current.find((d) => d.id === id)!.name),
      });
      return { ok: true };
    });
  }

  // ------------------------------------------------------------------- staff

  async invite(listenerId: string, organisationId: string, input: { email?: string; unitId?: string | null; designationId?: string }, now = new Date()) {
    const email = clean(input.email)?.toLowerCase();
    if (!email || !EMAIL.test(email) || email.length > 255) throw new BadRequestException('Enter a valid email address.');
    return this.dataSource.transaction(async (m) => {
      const org = await this.org(m, organisationId);
      const actor = await this.actor(m, listenerId, organisationId);
      const units = await this.units(m, organisationId);
      const unit = await this.unitInOrg(m, organisationId, input.unitId);
      if (org.kind === 'standalone' && unit) throw new BadRequestException('In a single station, staff are placed at the station itself.');
      if (!withinScope(units, actor.scopeUnitId, unit?.id ?? null)) {
        throw new ForbiddenException('You can only invite staff to your own part of the organisation.');
      }
      const designation = await this.designationInOrg(m, organisationId, input.designationId);
      this.assertPlacement(actor, unit?.id ?? null, designation, unit?.name ?? 'the head office');
      // A post above the inviter's own needs the NowRJ team's approval before the link works.
      const needsApproval = !actor.superadmin && designation.rank < this.rankOf(actor);

      const [already] = await m.query(
        `SELECT 1 FROM org_members om JOIN listeners l ON l.id = om."listenerId"
          WHERE om."organisationId" = $1 AND om.status = 'active' AND lower(l.email) = $2`,
        [organisationId, email],
      );
      if (already) throw new ConflictException('This person is already on your staff. Change their designation instead.');
      const open = await m.findOne(OrgInvite, { where: { organisationId, email, status: In(['sent', 'awaiting_approval']) } });
      if (open && (open.status === 'awaiting_approval' || open.expiresAt > now)) {
        throw new ConflictException('An invite for this email is still open. Cancel it to send a new one.');
      }
      if (open) await m.update(OrgInvite, { id: open.id }, { status: 'cancelled' });

      const invite = await m.save(
        m.create(OrgInvite, {
          organisationId,
          unitId: unit?.id ?? null,
          designationId: designation.id,
          email,
          token: randomBytes(24).toString('hex'),
          status: needsApproval ? 'awaiting_approval' : 'sent',
          invitedByListenerId: listenerId,
          expiresAt: new Date(now.getTime() + INVITE_DAYS * DAY),
        }),
      );
      await writeAudit(m, listenerId, needsApproval ? 'org_invite.awaiting_approval' : 'org_invite.sent', 'org_invite', invite.id, {
        organisationId,
        email,
        unitId: invite.unitId,
        designation: designation.name,
      });
      return { id: invite.id, status: invite.status, token: needsApproval ? null : invite.token, expiresAt: invite.expiresAt };
    });
  }

  async cancelInvite(listenerId: string, organisationId: string, inviteId: string) {
    return this.dataSource.transaction(async (m) => {
      const actor = await this.actor(m, listenerId, organisationId);
      const invite = await m.findOneBy(OrgInvite, { id: inviteId, organisationId });
      if (!invite || (invite.status !== 'sent' && invite.status !== 'awaiting_approval')) throw new NotFoundException('Open invite not found.');
      if (!withinScope(await this.units(m, organisationId), actor.scopeUnitId, invite.unitId)) {
        throw new ForbiddenException('This invite is outside your part of the organisation.');
      }
      await m.update(OrgInvite, { id: invite.id }, { status: 'cancelled' });
      await writeAudit(m, listenerId, 'org_invite.cancelled', 'org_invite', invite.id, { organisationId, email: invite.email });
      return { id: invite.id, status: 'cancelled' };
    });
  }

  /**
   * removing: ordinary staff at a place below yours are removed by that
   * place's own admin. A change is judged by where it leaves the person.
   */
  private async memberForChange(m: EntityManager, actor: Actor, organisationId: string, memberId: string, removing = false) {
    const member = await m.findOne(OrgMember, { where: { id: memberId, organisationId, status: 'active' }, lock: { mode: 'pessimistic_write' } });
    if (!member) throw new NotFoundException('Staff member not found.');
    if (!actor.superadmin && member.listenerId === actor.listenerId) {
      throw new ForbiddenException('You cannot change your own access. Ask another admin.');
    }
    const units = await this.units(m, organisationId);
    if (!withinScope(units, actor.scopeUnitId, member.unitId)) {
      throw new ForbiddenException('This person works outside your part of the organisation.');
    }
    const post = await m.findOneByOrFail(Designation, { id: member.designationId });
    if (!actor.superadmin && post.rank <= this.rankOf(actor)) {
      throw new ForbiddenException(`Only someone in a higher post, or the NowRJ team, can change or remove a ${post.name}.`);
    }
    if (removing) this.assertPlacement(actor, member.unitId, post, units.find((u) => u.id === member.unitId)?.name ?? 'the head office');
    return { member, units };
  }

  /** Move a staff member to another place, or give them another designation. */
  async updateMember(listenerId: string, organisationId: string, memberId: string, input: { unitId?: string | null; designationId?: string }) {
    return this.dataSource.transaction(async (m) => {
      const org = await this.org(m, organisationId);
      const actor = await this.actor(m, listenerId, organisationId);
      const { member, units } = await this.memberForChange(m, actor, organisationId, memberId);
      const admins = await this.headOfficeAdmins(m, organisationId);
      const before = { unitId: member.unitId, designationId: member.designationId };
      if (input.unitId !== undefined) {
        const unit = await this.unitInOrg(m, organisationId, input.unitId);
        if (org.kind === 'standalone' && unit) throw new BadRequestException('In a single station, staff are placed at the station itself.');
        if (!withinScope(units, actor.scopeUnitId, unit?.id ?? null)) {
          throw new ForbiddenException('You can only place staff in your own part of the organisation.');
        }
        member.unitId = unit?.id ?? null;
      }
      if (input.designationId !== undefined) {
        const designation = await this.designationInOrg(m, organisationId, input.designationId);
        if (!actor.superadmin && designation.rank <= this.rankOf(actor)) {
          throw new ForbiddenException(`Only the NowRJ team can give someone a post at or above your own (${designation.name}).`);
        }
        member.designationId = designation.id;
      }
      const post = await m.findOneByOrFail(Designation, { id: member.designationId });
      this.assertPlacement(actor, member.unitId, post, units.find((u) => u.id === member.unitId)?.name ?? 'the head office');
      await m.save(member);
      await this.keepAnAdmin(m, organisationId, admins);
      await writeAudit(m, listenerId, 'org_member.updated', 'org_member', member.id, {
        organisationId,
        listenerId: member.listenerId,
        from: before,
        to: { unitId: member.unitId, designationId: member.designationId },
      });
      return { id: member.id };
    });
  }

  async removeMember(listenerId: string, organisationId: string, memberId: string, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const actor = await this.actor(m, listenerId, organisationId);
      const { member } = await this.memberForChange(m, actor, organisationId, memberId, true);
      const admins = await this.headOfficeAdmins(m, organisationId);
      member.status = 'removed';
      member.removedAt = now;
      await m.save(member);
      await this.keepAnAdmin(m, organisationId, admins);
      // Their old station-representative records end too.
      await m.query(
        `UPDATE user_roles SET status = 'revoked', note = 'Removed from organisation staff'
          WHERE "listenerId" = $1 AND role = 'station_rep' AND status = 'active'
            AND "stationId" IN (SELECT id FROM stations WHERE "organisationId" = $2)`,
        [member.listenerId, organisationId],
      );
      await writeAudit(m, listenerId, 'org_member.removed', 'org_member', member.id, { organisationId, listenerId: member.listenerId });
      return { id: member.id, status: member.status };
    });
  }

  // ----------------------------------------------------------------- invitee

  async inviteInfo(token: string, now = new Date()) {
    const m = this.dataSource.manager;
    const invite = await m.findOneBy(OrgInvite, { token });
    if (!invite) throw new NotFoundException('This invite link is not valid.');
    const org = await this.org(m, invite.organisationId);
    const unit = invite.unitId ? await m.findOneBy(OrgUnit, { id: invite.unitId }) : null;
    const designation = await m.findOneBy(Designation, { id: invite.designationId });
    return {
      organisationName: org.name,
      organisationKind: org.kind,
      place: unit?.name ?? (org.kind === 'network' ? 'Head office' : org.name),
      designationName: designation?.name ?? '',
      emailHint: emailHint(invite.email),
      status: invite.status,
      expired: invite.expiresAt < now,
    };
  }

  async acceptInvite(listenerId: string, token: string, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const invite = await m.findOne(OrgInvite, { where: { token }, lock: { mode: 'pessimistic_write' } });
      if (!invite) throw new NotFoundException('This invite link is not valid.');
      if (invite.status === 'awaiting_approval') throw new ForbiddenException('This invite is waiting for approval by the NowRJ team.');
      if (invite.status !== 'sent') throw new GoneException('This invite has already been used or cancelled.');
      if (invite.expiresAt < now) throw new GoneException('This invite has expired. Ask for a new one.');
      const listener = await m.findOneBy(Listener, { id: listenerId, isActive: true });
      if (!listener) throw new NotFoundException('Account not found.');
      if ((listener.email ?? '').trim().toLowerCase() !== invite.email) {
        throw new ForbiddenException(`This invite is for ${emailHint(invite.email)}. Sign in with that Google account.`);
      }
      const org = await this.org(m, invite.organisationId);
      if (await m.existsBy(OrgMember, { organisationId: org.id, listenerId, status: 'active' })) {
        throw new ConflictException(`You are already on the staff of ${org.name}.`);
      }
      const member = await m.save(
        m.create(OrgMember, {
          organisationId: org.id,
          listenerId,
          unitId: invite.unitId,
          designationId: invite.designationId,
          status: 'active',
          addedByListenerId: invite.invitedByListenerId,
        }),
      );
      invite.status = 'accepted';
      invite.acceptedByListenerId = listenerId;
      invite.acceptedAt = now;
      await m.save(invite);
      await writeAudit(m, listenerId, 'org_member.joined', 'org_member', member.id, { organisationId: org.id, inviteId: invite.id });
      return { organisationId: org.id, organisationName: org.name };
    });
  }

  /**
   * A head-office admin of a network asks for a new station under a region.
   * It stays hidden from the public until the NowRJ team approves it, but the
   * network can already place and invite staff there.
   */
  async requestStation(
    listenerId: string,
    organisationId: string,
    input: { name?: string; city?: string; parentId?: string | null; contactPhone?: string },
  ) {
    const name = clean(input?.name);
    const city = clean(input?.city);
    const contactPhone = clean(input?.contactPhone);
    if (!name) throw new BadRequestException('Enter the station name.');
    if (name.length > 150) throw new BadRequestException('Station name is too long.');
    if (city && city.length > 100) throw new BadRequestException('City is too long.');
    if (contactPhone && !PHONE.test(contactPhone)) throw new BadRequestException('Phone number is not valid.');
    return this.dataSource.transaction(async (m) => {
      const org = await this.org(m, organisationId);
      const actor = await this.actor(m, listenerId, organisationId);
      if (org.kind !== 'network') throw new BadRequestException('Only a network can add stations.');
      const parent = await this.unitInOrg(m, organisationId, input?.parentId);
      if (parent && parent.kind !== 'region') throw new BadRequestException('Choose a region, or leave it under the head office.');
      // Head office can add anywhere; a regional admin only inside their own region.
      if (!withinScope(await this.units(m, organisationId), actor.scopeUnitId, parent?.id ?? null)) {
        throw new ForbiddenException('You can add stations only inside your own region.');
      }
      const requester = await m.findOneBy(Listener, { id: listenerId });

      const base = slugify(name, 'station');
      let slug = base;
      for (let n = 2; await m.exists(Station, { where: { slug } }); n++) slug = `${base}-${n}`;
      const station = await m.save(
        m.create(Station, {
          name,
          slug,
          city,
          isActive: false,
          verificationStatus: 'pending',
          organisationId,
          createdByListenerId: listenerId,
          contactPhone,
          contactEmail: requester?.email?.toLowerCase() ?? null,
        }),
      );
      const unit = await m.save(
        m.create(OrgUnit, { organisationId, kind: 'station', name, stationId: station.id, parentId: parent?.id ?? null }),
      );
      await writeAudit(m, listenerId, 'station.requested', 'station', station.id, { organisationId, name, city, parentId: unit.parentId });
      return { stationId: station.id, unitId: unit.id };
    });
  }

  // ------------------------------------------------------------- Super Admin

  /** Hide a whole organisation from listeners, or show it again. Staff keep their access. */
  async adminSetOrgHidden(adminId: string, organisationId: string, hidden: unknown) {
    if (typeof hidden !== 'boolean') throw new BadRequestException('Say whether to hide or show.');
    return this.dataSource.transaction(async (m) => {
      const org = await this.org(m, organisationId);
      await m.update(Organisation, { id: org.id }, { hiddenAt: hidden ? new Date() : null });
      await writeAudit(m, adminId, hidden ? 'organisation.hidden' : 'organisation.shown', 'organisation', org.id, { name: org.name });
      return { id: org.id, hidden };
    });
  }

  /** Hide a region (and every station under it) or a single station from listeners. */
  async adminSetUnitHidden(adminId: string, organisationId: string, unitId: string, hidden: unknown) {
    if (typeof hidden !== 'boolean') throw new BadRequestException('Say whether to hide or show.');
    return this.dataSource.transaction(async (m) => {
      const unit = await m.findOneBy(OrgUnit, { id: unitId, organisationId });
      if (!unit) throw new NotFoundException('Not found in this organisation.');
      await m.update(OrgUnit, { id: unit.id }, { hiddenAt: hidden ? new Date() : null });
      await writeAudit(m, adminId, hidden ? 'org_unit.hidden' : 'org_unit.shown', 'org_unit', unit.id, { organisationId, name: unit.name, kind: unit.kind });
      return { id: unit.id, hidden };
    });
  }

  /** Invites to a post above the inviter's own, waiting for the NowRJ team. */
  async adminInviteApprovals() {
    return this.dataSource.query(`
      SELECT i.id, i.email, i."createdAt", o.name AS "organisationName", d.name AS "designationName",
             coalesce(u.name, CASE WHEN o.kind = 'network' THEN 'Head office' ELSE o.name END) AS place,
             l."displayName" AS "invitedBy", idd.name AS "inviterDesignation"
        FROM org_invites i
        JOIN organisations o ON o.id = i."organisationId"
        JOIN designations d ON d.id = i."designationId"
        LEFT JOIN org_units u ON u.id = i."unitId"
        LEFT JOIN listeners l ON l.id = i."invitedByListenerId"
        LEFT JOIN org_members im ON im."listenerId" = i."invitedByListenerId" AND im."organisationId" = i."organisationId" AND im.status = 'active'
        LEFT JOIN designations idd ON idd.id = im."designationId"
       WHERE i.status = 'awaiting_approval'
       ORDER BY i."createdAt"`);
  }

  async adminDecideInvite(adminId: string, inviteId: string, approve: boolean, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const invite = await m.findOne(OrgInvite, { where: { id: inviteId }, lock: { mode: 'pessimistic_write' } });
      if (!invite || invite.status !== 'awaiting_approval') throw new NotFoundException('Invite waiting for approval not found.');
      invite.status = approve ? 'sent' : 'cancelled';
      if (approve) invite.expiresAt = new Date(now.getTime() + INVITE_DAYS * DAY);
      await m.save(invite);
      await writeAudit(m, adminId, approve ? 'org_invite.approved' : 'org_invite.rejected', 'org_invite', invite.id, {
        organisationId: invite.organisationId,
        email: invite.email,
      });
      return { id: invite.id, status: invite.status };
    });
  }

  /** Super Admin sets up a single station and invites its first Station admin. */
  async adminCreateStandalone(adminId: string, input: { name?: string; city?: string; email?: string }, now = new Date()) {
    const name = clean(input?.name);
    const city = clean(input?.city);
    const email = clean(input?.email)?.toLowerCase();
    if (!name) throw new BadRequestException('Enter the station name.');
    if (name.length > 150) throw new BadRequestException('Station name is too long.');
    if (!email || !EMAIL.test(email)) throw new BadRequestException("Enter the station admin's email.");
    return this.dataSource.transaction(async (m) => {
      const base = slugify(name, 'station');
      let slug = base;
      for (let n = 2; await m.exists(Station, { where: { slug } }); n++) slug = `${base}-${n}`;
      const station = await m.save(
        m.create(Station, { name, slug, city, isActive: true, verificationStatus: 'verified', createdByListenerId: adminId, contactEmail: email }),
      );
      const org = await ensureStationOrganisation(m, station, adminId);
      const designation = await m.findOneByOrFail(Designation, { organisationId: org.id, name: STATION_ADMIN });
      const invite = await m.save(
        m.create(OrgInvite, {
          organisationId: org.id,
          unitId: null,
          designationId: designation.id,
          email,
          token: randomBytes(24).toString('hex'),
          status: 'sent',
          invitedByListenerId: adminId,
          expiresAt: new Date(now.getTime() + INVITE_DAYS * DAY),
        }),
      );
      await writeAudit(m, adminId, 'station.created_by_admin', 'station', station.id, { name, city, organisationId: org.id, invitedEmail: email });
      return { stationId: station.id, organisationId: org.id, token: invite.token };
    });
  }

  /** Stations networks have asked for, waiting for the NowRJ team. */
  async adminStationRequests() {
    return this.dataSource.query(`
      SELECT s.id, s.name, s.city, s."contactPhone", s."contactEmail", s."createdAt",
             o.id AS "organisationId", o.name AS "organisationName",
             p.name AS "regionName", l."displayName" AS "requestedBy"
        FROM stations s
        JOIN organisations o ON o.id = s."organisationId" AND o.kind = 'network'
        JOIN org_units u ON u."stationId" = s.id
        LEFT JOIN org_units p ON p.id = u."parentId"
        LEFT JOIN listeners l ON l.id = s."createdByListenerId"
       WHERE s."verificationStatus" = 'pending'
       ORDER BY s."createdAt"`);
  }

  async adminDecideStation(adminId: string, stationId: string, approve: boolean, reasonInput?: unknown) {
    const reason = clean(reasonInput);
    if (!approve && !reason) throw new BadRequestException('Give a reason so the network knows why.');
    return this.dataSource.transaction(async (m) => {
      const station = await m.findOne(Station, { where: { id: stationId }, lock: { mode: 'pessimistic_write' } });
      if (!station || station.verificationStatus !== 'pending') throw new NotFoundException('Pending station not found.');
      const unit = await m.findOneBy(OrgUnit, { stationId: station.id });
      if (approve) {
        await m.update(Station, { id: station.id }, { verificationStatus: 'verified', isActive: true });
      } else {
        // Staff placed at the refused station move up to its region (or the head office).
        if (unit) {
          await m.query(`UPDATE org_members SET "unitId" = $2 WHERE "unitId" = $1`, [unit.id, unit.parentId]);
          await m.delete(OrgInvite, { unitId: unit.id });
          await m.delete(OrgUnit, { id: unit.id });
        }
        await m.update(Station, { id: station.id }, { verificationStatus: 'rejected', isActive: false, organisationId: null });
      }
      await writeAudit(m, adminId, approve ? 'station.request_approved' : 'station.request_rejected', 'station', station.id, {
        organisationId: station.organisationId,
        reason,
      });
      return { stationId: station.id, status: approve ? 'verified' : 'rejected' };
    });
  }

  async adminList() {
    const organisations: Record<string, unknown>[] = await this.dataSource.query(`
      SELECT o.id, o.name, o.kind, o."isActive", o."createdAt", o."hiddenAt" IS NOT NULL AS hidden,
             (SELECT count(*)::int FROM stations s WHERE s."organisationId" = o.id) AS "stationCount",
             (SELECT count(*)::int FROM org_members m WHERE m."organisationId" = o.id AND m.status = 'active') AS "staffCount",
             (SELECT count(*)::int FROM org_invites i WHERE i."organisationId" = o.id AND i.status = 'sent') AS "openInvites"
        FROM organisations o
       ORDER BY o.kind, o.name`);
    const stations: Record<string, unknown>[] = await this.dataSource.query(`
      SELECT s.id, s.name, s.city, s."organisationId", o.kind AS "organisationKind"
        FROM stations s LEFT JOIN organisations o ON o.id = s."organisationId"
       WHERE s."verificationStatus" IN ('verified','legacy')
       ORDER BY s.name`);
    return { organisations, stations };
  }

  async adminCreateNetwork(adminId: string, input: { name?: string }) {
    const name = clean(input?.name);
    if (!name) throw new BadRequestException('Enter the organisation name.');
    if (name.length > 150) throw new BadRequestException('Organisation name is too long.');
    return this.dataSource.transaction(async (m) => {
      const org = await m.save(m.create(Organisation, { name, kind: 'network', createdByListenerId: adminId }));
      const d = await m.save(m.create(Designation, { organisationId: org.id, name: HEAD_OFFICE_ADMIN, ...FULL_LEVELS }));
      await writeAudit(m, adminId, 'organisation.created', 'organisation', org.id, { name, kind: 'network' });
      return { id: org.id, adminDesignationId: d.id };
    });
  }

  /**
   * Moves a standalone station into a network. Its staff join the network at
   * that station, keeping designations of the same name (copied over if the
   * network has none). The empty standalone organisation is removed.
   */
  async adminMoveStation(adminId: string, organisationId: string, input: { stationId?: string; parentUnitId?: string | null }) {
    return this.dataSource.transaction(async (m) => {
      const target = await this.org(m, organisationId);
      if (target.kind !== 'network') throw new BadRequestException('Stations can only be moved into a network.');
      const stationId = input?.stationId;
      const station = typeof stationId === 'string' && UUID.test(stationId)
        ? await m.findOne(Station, { where: { id: stationId }, lock: { mode: 'pessimistic_write' } })
        : null;
      if (!station) throw new NotFoundException('Station not found.');
      if (station.organisationId === target.id) throw new ConflictException(`${station.name} is already in ${target.name}.`);
      const source = station.organisationId ? await m.findOneBy(Organisation, { id: station.organisationId }) : null;
      if (source?.kind === 'network') throw new ConflictException(`${station.name} belongs to the network ${source.name}.`);
      const parent = await this.unitInOrg(m, target.id, input?.parentUnitId);
      if (parent && parent.kind !== 'region') throw new BadRequestException('Choose a region, or leave it under the head office.');

      let unit = await m.findOneBy(OrgUnit, { stationId: station.id });
      if (unit) {
        await m.update(OrgUnit, { id: unit.id }, { organisationId: target.id, parentId: parent?.id ?? null, name: station.name });
      } else {
        unit = await m.save(m.create(OrgUnit, { organisationId: target.id, kind: 'station', name: station.name, stationId: station.id, parentId: parent?.id ?? null }));
      }

      const moved: { listenerId: string; designation: string }[] = [];
      const skipped: string[] = [];
      if (source) {
        const members = await m.findBy(OrgMember, { organisationId: source.id, status: 'active' });
        const sourceDesignations = await m.findBy(Designation, { organisationId: source.id });
        for (const member of members) {
          if (await m.existsBy(OrgMember, { organisationId: target.id, listenerId: member.listenerId, status: 'active' })) {
            skipped.push(member.listenerId);
            continue;
          }
          const old = sourceDesignations.find((d) => d.id === member.designationId)!;
          let d = await m
            .createQueryBuilder(Designation, 'd')
            .where('d."organisationId" = :org AND lower(d.name) = lower(:name)', { org: target.id, name: old.name })
            .getOne();
          if (!d) {
            const [{ max }] = await m.query(`SELECT coalesce(max(rank), 0)::int AS max FROM designations WHERE "organisationId" = $1`, [target.id]);
            d = await m.save(
              m.create(Designation, {
                organisationId: target.id,
                rank: max + 1,
                name: old.name,
                ...Object.fromEntries(AREAS.map((a) => [a, old[a]])),
                manageStaff: old.manageStaff,
              }),
            );
          }
          await m.save(
            m.create(OrgMember, {
              organisationId: target.id,
              listenerId: member.listenerId,
              unitId: unit.id,
              designationId: d.id,
              status: 'active',
              addedByListenerId: adminId,
            }),
          );
          moved.push({ listenerId: member.listenerId, designation: d.name });
        }
        await m.delete(OrgInvite, { organisationId: source.id });
        await m.delete(OrgMember, { organisationId: source.id });
        await m.delete(Designation, { organisationId: source.id });
        await m.delete(OrgUnit, { organisationId: source.id });
        await m.delete(Organisation, { id: source.id });
      }
      await m.update(Station, { id: station.id }, { organisationId: target.id });
      await writeAudit(m, adminId, 'station.moved_to_organisation', 'station', station.id, {
        from: source ? { id: source.id, name: source.name } : null,
        to: { id: target.id, name: target.name },
        parentUnitId: parent?.id ?? null,
        moved,
        skipped,
      });
      return { stationId: station.id, unitId: unit.id, moved: moved.length, skipped: skipped.length };
    });
  }
}

/** Staff management for organisation admins: /orgs/... */
@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get('mine')
  mine(@Req() req: Request) {
    return this.orgs.mine(listenerId(req));
  }

  @Get(':id')
  overview(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.orgs.overview(listenerId(req), id);
  }

  @Post(':id/stations')
  requestStation(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name?: string; city?: string; parentId?: string | null; contactPhone?: string },
  ) {
    return this.orgs.requestStation(listenerId(req), id, body ?? {});
  }

  @Post(':id/regions')
  createRegion(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { name?: string; parentId?: string | null }) {
    return this.orgs.createRegion(listenerId(req), id, body ?? {});
  }

  @Patch(':id/units/:unitId')
  updateUnit(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() body: { name?: string; parentId?: string | null },
  ) {
    return this.orgs.updateUnit(listenerId(req), id, unitId, body ?? {});
  }

  @Delete(':id/units/:unitId')
  deleteRegion(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Param('unitId', ParseUUIDPipe) unitId: string) {
    return this.orgs.deleteRegion(listenerId(req), id, unitId);
  }

  @Post(':id/designations')
  createDesignation(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: DesignationInput) {
    return this.orgs.createDesignation(listenerId(req), id, body ?? {});
  }

  @Post(':id/designations/order')
  reorderDesignations(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { ids?: unknown }) {
    return this.orgs.reorderDesignations(listenerId(req), id, body?.ids);
  }

  @Patch(':id/designations/:designationId')
  updateDesignation(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('designationId', ParseUUIDPipe) designationId: string,
    @Body() body: DesignationInput,
  ) {
    return this.orgs.updateDesignation(listenerId(req), id, designationId, body ?? {});
  }

  @Delete(':id/designations/:designationId')
  deleteDesignation(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Param('designationId', ParseUUIDPipe) designationId: string) {
    return this.orgs.deleteDesignation(listenerId(req), id, designationId);
  }

  @Post(':id/invites')
  invite(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { email?: string; unitId?: string | null; designationId?: string }) {
    return this.orgs.invite(listenerId(req), id, body ?? {});
  }

  @Delete(':id/invites/:inviteId')
  cancelInvite(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Param('inviteId', ParseUUIDPipe) inviteId: string) {
    return this.orgs.cancelInvite(listenerId(req), id, inviteId);
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() body: { unitId?: string | null; designationId?: string },
  ) {
    return this.orgs.updateMember(listenerId(req), id, memberId, body ?? {});
  }

  @Delete(':id/members/:memberId')
  removeMember(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Param('memberId', ParseUUIDPipe) memberId: string) {
    return this.orgs.removeMember(listenerId(req), id, memberId);
  }
}

/** The link an invited staff member opens. */
@Controller('org-invites')
export class OrgInvitesController {
  constructor(private readonly orgs: OrgsService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.orgs.inviteInfo(token);
  }

  @Post(':token/accept')
  accept(@Req() req: Request, @Param('token') token: string) {
    return this.orgs.acceptInvite(listenerId(req), token);
  }
}

/** Super Admin: create networks and move stations into them. */
@Controller('admin/orgs')
@UseGuards(SuperadminGuard)
export class AdminOrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  list() {
    return this.orgs.adminList();
  }

  @Post(':id/visibility')
  setOrgHidden(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { hidden?: unknown }) {
    return this.orgs.adminSetOrgHidden(listenerId(req), id, body?.hidden);
  }

  @Post(':id/units/:unitId/visibility')
  setUnitHidden(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('unitId', ParseUUIDPipe) unitId: string,
    @Body() body: { hidden?: unknown },
  ) {
    return this.orgs.adminSetUnitHidden(listenerId(req), id, unitId, body?.hidden);
  }

  @Get('invite-approvals')
  inviteApprovals() {
    return this.orgs.adminInviteApprovals();
  }

  @Post('invite-approvals/:inviteId/approve')
  approveInvite(@Req() req: Request, @Param('inviteId', ParseUUIDPipe) inviteId: string) {
    return this.orgs.adminDecideInvite(listenerId(req), inviteId, true);
  }

  @Post('invite-approvals/:inviteId/reject')
  rejectInvite(@Req() req: Request, @Param('inviteId', ParseUUIDPipe) inviteId: string) {
    return this.orgs.adminDecideInvite(listenerId(req), inviteId, false);
  }

  @Post('standalone')
  createStandalone(@Req() req: Request, @Body() body: { name?: string; city?: string; email?: string }) {
    return this.orgs.adminCreateStandalone(listenerId(req), body ?? {});
  }

  @Get('station-requests')
  stationRequests() {
    return this.orgs.adminStationRequests();
  }

  @Post('station-requests/:stationId/approve')
  approveStation(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.orgs.adminDecideStation(listenerId(req), stationId, true);
  }

  @Post('station-requests/:stationId/reject')
  rejectStation(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Body() body: { reason?: string }) {
    return this.orgs.adminDecideStation(listenerId(req), stationId, false, body?.reason);
  }

  @Post()
  create(@Req() req: Request, @Body() body: { name?: string }) {
    return this.orgs.adminCreateNetwork(listenerId(req), body ?? {});
  }

  @Post(':id/stations')
  moveStation(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { stationId?: string; parentUnitId?: string | null }) {
    return this.orgs.adminMoveStation(listenerId(req), id, body ?? {});
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([...ORG_ENTITIES, Listener, Station, UserRole, Rj, RjStationAffiliation])],
  controllers: [OrgsController, OrgInvitesController, AdminOrgsController, OrgRjsController],
  providers: [OrgsService, OrgRjsService],
})
export class OrgsModule {}
