import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  GoneException,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { randomBytes } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { Listener } from '../listener.entity';
import { Rj } from '../rj.entity';
import { RjStationAffiliation } from '../rj-station-affiliation.entity';
import { clean, EMAIL, writeAudit } from '../onboarding/helpers';
import { Programme } from '../programme.entity';
import { activateRjReferral } from '../referrals/referral-rules';
import { todayInIndia } from '../rjs/dates';
import { meets, withinScope } from './access-rules';
import { Designation, Level, Notice, Organisation, OrgMember, OrgRj, OrgUnit, RjInvite } from './entities';
import { emailHint, INVITE_DAYS } from './invite-rules';

const DAY = 24 * 3600 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RjActor = { superadmin: boolean; scopeUnitId: string | null; level: Level };

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/**
 * Release 3a: RJs join a place (head office, a region or a station) by
 * invite. Staff with Edit on RJs invite and remove RJs at their own place;
 * Super Admin can do it anywhere.
 */
@Injectable()
export class OrgRjsService {
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

  private async actor(m: EntityManager, listenerId: string, organisationId: string, need: Level): Promise<RjActor> {
    const member = await m.findOneBy(OrgMember, { organisationId, listenerId, status: 'active' });
    const designation = member ? await m.findOneBy(Designation, { id: member.designationId }) : null;
    if (member && designation && meets(designation.rjs, need)) {
      return { superadmin: false, scopeUnitId: member.unitId, level: designation.rjs };
    }
    if (await this.isSuperadmin(m, listenerId)) return { superadmin: true, scopeUnitId: null, level: 'authorise' };
    throw new ForbiddenException(need === 'view' ? 'Your designation does not include RJs.' : 'Your designation does not let you invite or remove RJs.');
  }

  /** RJs are added and removed only at the person's own place (Super Admin: anywhere). */
  private assertOwnPlace(actor: RjActor, unitId: string | null) {
    if (!actor.superadmin && unitId !== actor.scopeUnitId) {
      throw new ForbiddenException('RJs are added and removed by staff at that place. You can manage RJs at your own place.');
    }
  }

  private async org(m: EntityManager, organisationId: string) {
    const org = await m.findOneBy(Organisation, { id: organisationId });
    if (!org) throw new NotFoundException('Organisation not found.');
    return org;
  }

  /** Stations at a place: the station itself, every station under a region, or every station at head office level. */
  private stationsAt(units: OrgUnit[], unitId: string | null) {
    return units.filter((u) => u.kind === 'station' && u.stationId && withinScope(units, unitId, u.id)).map((u) => u.stationId!);
  }

  // ------------------------------------------------------------------ staff

  async list(listenerId: string, organisationId: string, now = new Date()) {
    const m = this.dataSource.manager;
    const org = await this.org(m, organisationId);
    const actor = await this.actor(m, listenerId, organisationId, 'view');
    const units = await m.findBy(OrgUnit, { organisationId });
    const inScope = (unitId: string | null) => withinScope(units, actor.scopeUnitId, unitId);
    const canEdit = actor.superadmin || meets(actor.level, 'edit');
    const rjs: { id: string; rjId: string; name: string; slug: string; photoUrl: string | null; unitId: string | null; joinedOn: string }[] =
      await m.query(
        `SELECT o.id, o."rjId", r.name, r.slug, r."photoUrl", o."unitId", o."joinedOn"::text AS "joinedOn"
           FROM org_rjs o JOIN rjs r ON r.id = o."rjId"
          WHERE o."organisationId" = $1 AND o.status = 'active'
          ORDER BY r.name`,
        [organisationId],
      );
    const invites = await m.find(RjInvite, { where: { organisationId, status: 'sent' }, order: { createdAt: 'DESC' } });
    return {
      organisation: { id: org.id, name: org.name, kind: org.kind },
      canEdit,
      ownPlace: actor.scopeUnitId,
      superadmin: actor.superadmin,
      places: units.filter((u) => inScope(u.id)).map((u) => ({ id: u.id, name: u.name, kind: u.kind, parentId: u.parentId })),
      rjs: rjs
        .filter((r) => inScope(r.unitId))
        .map((r) => ({ ...r, editable: canEdit && (actor.superadmin || r.unitId === actor.scopeUnitId) })),
      invites: invites
        .filter((i) => inScope(i.unitId))
        .map((i) => ({
          id: i.id,
          email: i.email,
          unitId: i.unitId,
          token: i.token,
          expiresAt: i.expiresAt,
          expired: i.expiresAt < now,
          editable: canEdit && (actor.superadmin || i.unitId === actor.scopeUnitId),
        })),
    };
  }

  async invite(listenerId: string, organisationId: string, input: { email?: string; unitId?: string | null }, now = new Date()) {
    const email = clean(input?.email)?.toLowerCase();
    if (!email || !EMAIL.test(email) || email.length > 255) throw new BadRequestException("Enter the RJ's email address.");
    return this.dataSource.transaction(async (m) => {
      const org = await this.org(m, organisationId);
      const actor = await this.actor(m, listenerId, organisationId, 'edit');
      let unit: OrgUnit | null = null;
      if (input?.unitId) {
        if (typeof input.unitId !== 'string' || !UUID.test(input.unitId)) throw new BadRequestException('Choose a place in this organisation.');
        unit = await m.findOneBy(OrgUnit, { id: input.unitId, organisationId });
        if (!unit) throw new BadRequestException('Choose a place in this organisation.');
      }
      if (org.kind === 'standalone' && unit) throw new BadRequestException('In a single station, RJs join the station itself.');
      this.assertOwnPlace(actor, unit?.id ?? null);

      const [already] = await m.query(
        `SELECT 1 FROM org_rjs o JOIN rjs r ON r.id = o."rjId" JOIN listeners l ON l.id = r."ownerListenerId"
          WHERE o."organisationId" = $1 AND o.status = 'active' AND lower(l.email) = $2`,
        [organisationId, email],
      );
      if (already) throw new ConflictException(`This RJ already works with ${org.name}.`);
      const open = await m.findOneBy(RjInvite, { organisationId, email, status: 'sent' });
      if (open && open.expiresAt > now) throw new ConflictException('An invite for this RJ is still open. Cancel it to send a new one.');
      if (open) await m.update(RjInvite, { id: open.id }, { status: 'cancelled' });

      const invite = await m.save(
        m.create(RjInvite, {
          organisationId,
          unitId: unit?.id ?? null,
          email,
          token: randomBytes(24).toString('hex'),
          status: 'sent',
          invitedByListenerId: listenerId,
          expiresAt: new Date(now.getTime() + INVITE_DAYS * DAY),
        }),
      );
      await writeAudit(m, listenerId, 'rj_invite.sent', 'rj_invite', invite.id, { organisationId, email, unitId: invite.unitId });
      return { id: invite.id, token: invite.token, expiresAt: invite.expiresAt };
    });
  }

  async cancelInvite(listenerId: string, organisationId: string, inviteId: string) {
    return this.dataSource.transaction(async (m) => {
      const actor = await this.actor(m, listenerId, organisationId, 'edit');
      const invite = await m.findOneBy(RjInvite, { id: inviteId, organisationId, status: 'sent' });
      if (!invite) throw new NotFoundException('Open invite not found.');
      this.assertOwnPlace(actor, invite.unitId);
      await m.update(RjInvite, { id: invite.id }, { status: 'cancelled', decidedAt: new Date() });
      await writeAudit(m, listenerId, 'rj_invite.cancelled', 'rj_invite', invite.id, { organisationId, email: invite.email });
      return { id: invite.id, status: 'cancelled' };
    });
  }

  /**
   * The RJ leaves the place. Their account, profile and followers stay with
   * them. They stop hosting the place's station programmes from today; past
   * shows keep them as host.
   */
  async remove(listenerId: string, organisationId: string, orgRjId: string, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const org = await this.org(m, organisationId);
      const actor = await this.actor(m, listenerId, organisationId, 'edit');
      const link = await m.findOne(OrgRj, { where: { id: orgRjId, organisationId, status: 'active' }, lock: { mode: 'pessimistic_write' } });
      if (!link) throw new NotFoundException('RJ not found at this organisation.');
      this.assertOwnPlace(actor, link.unitId);
      const today = todayInIndia(now);
      link.status = 'removed';
      link.leftOn = today;
      link.removedByListenerId = listenerId;
      await m.save(link);

      const units = await m.findBy(OrgUnit, { organisationId });
      const stationIds = this.stationsAt(units, link.unitId);
      if (stationIds.length) {
        await m.query(
          `UPDATE rj_station_affiliations SET "leftOn" = $3
            WHERE "rjId" = $1 AND "stationId" = ANY($2) AND "leftOn" IS NULL AND "joinedOn" <= $3`,
          [link.rjId, stationIds, today],
        );
        await m.query(
          `DELETE FROM show_occurrence_hosts h USING show_occurrences o, programmes p
            WHERE h."occurrenceId" = o.id AND p.id = o."programmeId" AND h."rjId" = $1
              AND p."ownerStationId" = ANY($2) AND o."startsAt" > $3`,
          [link.rjId, stationIds, now],
        );
        await m.query(
          `DELETE FROM programme_rjs pr USING programmes p
            WHERE pr."programmeId" = p.id AND pr."rjId" = $1 AND p."ownerStationId" = ANY($2)`,
          [link.rjId, stationIds],
        );
        await m.query(`UPDATE rjs SET "stationId" = NULL WHERE id = $1 AND "stationId" = ANY($2)`, [link.rjId, stationIds]);
      }

      const rj = await m.findOne(Rj, { where: { id: link.rjId }, relations: { ownerListener: true } });
      const place = link.unitId ? (await m.findOneBy(OrgUnit, { id: link.unitId }))?.name : org.kind === 'network' ? `${org.name} head office` : org.name;
      if (rj?.ownerListener) {
        await m.save(
          m.create(Notice, {
            listenerId: rj.ownerListener.id,
            text: `You are no longer an RJ at ${place} from ${today}. Your profile and followers stay with you; past shows still list you as host.`,
          }),
        );
      }
      await writeAudit(m, listenerId, 'org_rj.removed', 'org_rj', link.id, { organisationId, rjId: link.rjId, unitId: link.unitId, stationIds });
      return { id: link.id, status: link.status, leftOn: today };
    });
  }

  // --------------------------------------------------------------------- RJ

  private async inviteView(m: EntityManager, invite: RjInvite, now: Date) {
    const org = await m.findOneByOrFail(Organisation, { id: invite.organisationId });
    const unit = invite.unitId ? await m.findOneBy(OrgUnit, { id: invite.unitId }) : null;
    return {
      id: invite.id,
      token: invite.token,
      organisationName: org.name,
      organisationKind: org.kind,
      place: unit?.name ?? (org.kind === 'network' ? 'Head office' : org.name),
      placeKind: unit?.kind ?? (org.kind === 'network' ? 'head_office' : 'station'),
      emailHint: emailHint(invite.email),
      status: invite.status,
      expired: invite.expiresAt < now,
    };
  }

  /** Open invites for the signed-in person's email, for the RJ dashboard. */
  async mine(listenerId: string, now = new Date()) {
    const m = this.dataSource.manager;
    const listener = await m.findOneBy(Listener, { id: listenerId });
    const email = listener?.email?.trim().toLowerCase();
    if (!email) return [];
    const invites = await m
      .createQueryBuilder(RjInvite, 'i')
      .where('lower(i.email) = :email AND i.status = :status AND i."expiresAt" > :now', { email, status: 'sent', now })
      .orderBy('i."createdAt"', 'DESC')
      .getMany();
    return Promise.all(invites.map((i) => this.inviteView(m, i, now)));
  }

  async info(token: string, now = new Date()) {
    const m = this.dataSource.manager;
    const invite = await m.findOneBy(RjInvite, { token });
    if (!invite) throw new NotFoundException('This invite link is not valid.');
    return this.inviteView(m, invite, now);
  }

  async decide(listenerId: string, token: string, accept: boolean, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const invite = await m.findOne(RjInvite, { where: { token }, lock: { mode: 'pessimistic_write' } });
      if (!invite) throw new NotFoundException('This invite link is not valid.');
      if (invite.status !== 'sent') throw new GoneException('This invite has already been answered or cancelled.');
      if (invite.expiresAt < now) throw new GoneException('This invite has expired. Ask the station for a new one.');
      const listener = await m.findOneBy(Listener, { id: listenerId, isActive: true });
      if (!listener) throw new NotFoundException('Account not found.');
      if ((listener.email ?? '').trim().toLowerCase() !== invite.email) {
        throw new ForbiddenException(`This invite is for ${emailHint(invite.email)}. Sign in with that Google account.`);
      }
      const org = await this.org(m, invite.organisationId);

      if (!accept) {
        await m.update(RjInvite, { id: invite.id }, { status: 'declined', decidedAt: now });
        await writeAudit(m, listenerId, 'rj_invite.declined', 'rj_invite', invite.id, { organisationId: org.id });
        return { status: 'declined', organisationName: org.name };
      }

      const rj = await m.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
      if (!rj) throw new ConflictException('Create your RJ profile first, then open this invite again.');
      if (await m.existsBy(OrgRj, { organisationId: org.id, rjId: rj.id, status: 'active' })) {
        throw new ConflictException(`You already work with ${org.name}.`);
      }
      const today = todayInIndia(now);
      const link = await m.save(
        m.create(OrgRj, {
          organisationId: org.id,
          rjId: rj.id,
          unitId: invite.unitId,
          status: 'active',
          joinedOn: today,
          addedByListenerId: invite.invitedByListenerId,
        }),
      );

      // Joining a station also adds it, confirmed, to the RJ's station history.
      const unit = invite.unitId ? await m.findOneBy(OrgUnit, { id: invite.unitId }) : null;
      const stationId =
        unit?.kind === 'station'
          ? unit.stationId
          : org.kind === 'standalone'
            ? (await m.findOneBy(OrgUnit, { organisationId: org.id, kind: 'station' }))?.stationId ?? null
            : null;
      if (stationId) {
        // The station history keeps one current station per RJ. If they already
        // have a different current station, that stays; the invite link still
        // gives them this place.
        const open = await m.findOneBy(RjStationAffiliation, { rjId: rj.id, leftOn: IsNull() });
        if (open?.stationId === stationId) {
          await m.update(RjStationAffiliation, { id: open.id }, { verificationStatus: 'verified', verifiedByListenerId: invite.invitedByListenerId, verifiedAt: now });
        } else if (!open) {
          await m.save(
            m.create(RjStationAffiliation, {
              rjId: rj.id,
              stationId,
              joinedOn: today,
              leftOn: null,
              verificationStatus: 'verified',
              verifiedByListenerId: invite.invitedByListenerId,
              verifiedAt: now,
            }),
          );
        }
        if (!rj.stationId) await m.update(Rj, { id: rj.id }, { stationId });
      }

      // A network vouches for the RJs it invites: no separate NowRJ verification.
      // A single station's invite still leaves verification to the NowRJ team.
      let verified = false;
      if (org.kind === 'network' && rj.verificationStatus === 'pending') {
        await m.update(Rj, { id: rj.id }, { verificationStatus: 'verified', isActive: true });
        await m.update(Programme, { ownerRjId: rj.id }, { isActive: true });
        await activateRjReferral(m, rj.id, now);
        await writeAudit(m, invite.invitedByListenerId, 'rj.verified_by_network', 'rj', rj.id, { organisationId: org.id, inviteId: invite.id });
        verified = true;
      }

      await m.update(RjInvite, { id: invite.id }, { status: 'accepted', rjId: rj.id, decidedAt: now });
      await writeAudit(m, listenerId, 'org_rj.joined', 'org_rj', link.id, { organisationId: org.id, unitId: link.unitId, inviteId: invite.id });
      return { status: 'accepted', organisationName: org.name, verified };
    });
  }

  /** Where this RJ works now, for their dashboard. */
  async myPlaces(listenerId: string) {
    return this.dataSource.query(
      `SELECT o.id, org.name AS "organisationName", org.kind AS "organisationKind",
              coalesce(u.name, CASE WHEN org.kind = 'network' THEN 'Head office' ELSE org.name END) AS place,
              o."joinedOn"::text AS "joinedOn"
         FROM org_rjs o
         JOIN rjs r ON r.id = o."rjId"
         JOIN organisations org ON org.id = o."organisationId"
         LEFT JOIN org_units u ON u.id = o."unitId"
        WHERE r."ownerListenerId" = $1 AND o.status = 'active'
        ORDER BY org.name`,
      [listenerId],
    );
  }

  async notices(listenerId: string) {
    return this.dataSource.manager.find(Notice, { where: { listenerId, readAt: IsNull() }, order: { createdAt: 'DESC' }, take: 20 });
  }

  async readNotice(listenerId: string, noticeId: string) {
    await this.dataSource.manager.update(Notice, { id: noticeId, listenerId }, { readAt: new Date() });
    return { id: noticeId };
  }
}

@Controller()
export class OrgRjsController {
  constructor(private readonly rjs: OrgRjsService) {}

  @Get('orgs/:id/rjs')
  list(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.rjs.list(listenerId(req), id);
  }

  @Post('orgs/:id/rj-invites')
  invite(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { email?: string; unitId?: string | null }) {
    return this.rjs.invite(listenerId(req), id, body ?? {});
  }

  @Delete('orgs/:id/rj-invites/:inviteId')
  cancel(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Param('inviteId', ParseUUIDPipe) inviteId: string) {
    return this.rjs.cancelInvite(listenerId(req), id, inviteId);
  }

  @Delete('orgs/:id/rjs/:orgRjId')
  remove(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Param('orgRjId', ParseUUIDPipe) orgRjId: string) {
    return this.rjs.remove(listenerId(req), id, orgRjId);
  }

  @Get('rj-invites/mine')
  mine(@Req() req: Request) {
    return this.rjs.mine(listenerId(req));
  }

  @Get('rj-invites/places')
  places(@Req() req: Request) {
    return this.rjs.myPlaces(listenerId(req));
  }

  @Get('rj-invites/:token')
  info(@Param('token') token: string) {
    return this.rjs.info(token);
  }

  @Post('rj-invites/:token/accept')
  accept(@Req() req: Request, @Param('token') token: string) {
    return this.rjs.decide(listenerId(req), token, true);
  }

  @Post('rj-invites/:token/decline')
  decline(@Req() req: Request, @Param('token') token: string) {
    return this.rjs.decide(listenerId(req), token, false);
  }

  @Get('notices/mine')
  notices(@Req() req: Request) {
    return this.rjs.notices(listenerId(req));
  }

  @Post('notices/:id/read')
  read(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.rjs.readNotice(listenerId(req), id);
  }
}
