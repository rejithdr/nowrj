import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { assertStationAccess } from '../orgs/access';
import { meets, withinScope } from '../orgs/access-rules';
import type { Level } from '../orgs/entities';
import { RJ_CAN_ACT } from '../rjs/rj-can-act';
import { parseSlots, programmeSettings, RjDashboardService, todayInIndia } from '../rjs/rj-dashboard.service';
import { describeDays, sortSlots, type SlotInput } from '../programmes/schedule-rules';
import { Programme } from '../programme.entity';
import { ProgrammeRj } from '../programme-rj.entity';
import { ProgrammeOwnership } from '../programme-ownership.entity';
import { ProgrammeSchedule } from '../programme-schedule.entity';
import { writeAudit } from '../onboarding/helpers';
import { hasContactDetails, CONTACT_RULE_MESSAGE } from '../shows/text-rules';
import { participationSettings } from './participation-settings';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Active network programmes an organisation may have. */
const MAX_PER_ORG = 100;
const MAX_RJS = 6;

export type NetworkProgrammeInput = {
  name?: string;
  unitId?: string | null;
  rjIds?: string[];
  interactionType?: string;
  noticeText?: string | null;
  participation?: string;
  participationPrompt?: string | null;
};

type Office = { organisationId: string; organisationName: string; unitId: string | null; unitName: string | null; programmes: Level };
type Unit = { id: string; parentId: string | null; kind: string; name: string; stationId: string | null };

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().replace(/\s+/g, ' ');
  return t || null;
}

/**
 * Network programmes: a network's regional (or head) office makes the
 * programme once, with its name, RJs and listener settings. Each station
 * under that office that carries it gets its own programme (a copy) and
 * sets its own times and repeats. Changes by the office reach every copy.
 */
@Injectable()
export class NetworkProgrammesService {
  constructor(private readonly dataSource: DataSource) {}

  private get schedules() {
    return new RjDashboardService(this.dataSource);
  }

  // ------------------------------------------------------------------ offices

  /** Network offices this person works in, with their Programmes level. */
  async offices(listenerId: string): Promise<Office[]> {
    return this.dataSource.query(
      `SELECT o.id AS "organisationId", o.name AS "organisationName", om."unitId", u.name AS "unitName", d.programmes
         FROM org_members om
         JOIN organisations o ON o.id = om."organisationId" AND o."isActive" AND o.kind = 'network'
         JOIN designations d ON d.id = om."designationId"
         LEFT JOIN org_units u ON u.id = om."unitId"
        WHERE om."listenerId" = $1 AND om.status = 'active' AND d.programmes <> 'none'
          AND (om."unitId" IS NULL OR u.kind = 'region')
        ORDER BY o.name`,
      [listenerId],
    );
  }

  private async office(m: EntityManager, listenerId: string, organisationId: string, need: Level): Promise<Office> {
    const offices: Office[] = await m.query(
      `SELECT o.id AS "organisationId", o.name AS "organisationName", om."unitId", u.name AS "unitName", d.programmes
         FROM org_members om
         JOIN organisations o ON o.id = om."organisationId" AND o."isActive" AND o.kind = 'network'
         JOIN designations d ON d.id = om."designationId"
         LEFT JOIN org_units u ON u.id = om."unitId"
        WHERE om."listenerId" = $1 AND om."organisationId" = $2 AND om.status = 'active'`,
      [listenerId, organisationId],
    );
    const office = offices.find((o) => meets(o.programmes, need));
    if (!office) {
      throw new ForbiddenException(
        need === 'view' ? 'You do not work at an office of this network.' : 'Your designation does not allow changing programmes (it needs Programmes: edit).',
      );
    }
    return office;
  }

  private units(m: EntityManager, organisationId: string): Promise<Unit[]> {
    return m.query(`SELECT id, "parentId", kind, name, "stationId" FROM org_units WHERE "organisationId" = $1`, [organisationId]);
  }

  /** Validates the fields of the office form. */
  private async validate(m: EntityManager, organisationId: string, input: NetworkProgrammeInput, creating: boolean) {
    const out: {
      name?: string;
      rjIds?: string[];
      interactionType?: 'song' | 'question';
      noticeText?: string | null;
      participation?: 'off' | 'take_part' | 'nominate' | 'both';
      participationPrompt?: string | null;
    } = {};
    if (creating || input.name !== undefined) {
      const name = clean(input.name);
      if (!name) throw new BadRequestException('Enter the programme name.');
      if (name.length > 150) throw new BadRequestException('Programme name is too long.');
      out.name = name;
    }
    Object.assign(out, programmeSettings(input), participationSettings(input));
    for (const text of [out.name, out.noticeText, out.participationPrompt]) {
      if (text && hasContactDetails(text)) throw new BadRequestException(CONTACT_RULE_MESSAGE);
    }
    if (input.rjIds !== undefined) {
      if (!Array.isArray(input.rjIds) || input.rjIds.some((id) => typeof id !== 'string' || !UUID.test(id))) {
        throw new BadRequestException('Choose the RJs from the list.');
      }
      const ids = [...new Set(input.rjIds)];
      if (ids.length > MAX_RJS) throw new BadRequestException(`A programme can have up to ${MAX_RJS} RJs.`);
      if (ids.length) {
        const linked: { id: string }[] = await m.query(
          `SELECT r.id FROM rjs r
             JOIN org_rjs o ON o."rjId" = r.id AND o."organisationId" = $1 AND o.status = 'active'
            WHERE r.id = ANY($2) AND ${RJ_CAN_ACT('r')}`,
          [organisationId, ids],
        );
        if (linked.length !== ids.length) throw new BadRequestException('Choose RJs who work with this network.');
      }
      out.rjIds = ids;
    }
    return out;
  }

  /** The office's network programmes (its place and the places under it), with the stations carrying each. */
  async listForOffice(listenerId: string, organisationId: string) {
    const m = this.dataSource.manager;
    const office = await this.office(m, listenerId, organisationId, 'view');
    const units = await this.units(m, organisationId);
    const inScope = (unitId: string | null) => withinScope(units, office.unitId, unitId);

    const rows: {
      id: string; name: string; unitId: string | null; interactionType: string; noticeText: string | null;
      participation: string; participationPrompt: string | null; isActive: boolean; createdAt: Date;
      rjs: { id: string; name: string }[];
    }[] = await m.query(
      `SELECT np.id, np.name, np."unitId", np."interactionType", np."noticeText", np.participation, np."participationPrompt",
              np."isActive", np."createdAt",
              COALESCE((SELECT json_agg(json_build_object('id', r.id, 'name', r.name) ORDER BY r.name)
                          FROM network_programme_rjs x JOIN rjs r ON r.id = x."rjId" WHERE x."networkProgrammeId" = np.id), '[]') AS rjs
         FROM network_programmes np
        WHERE np."organisationId" = $1
        ORDER BY np."isActive" DESC, np.name`,
      [organisationId],
    );
    const visible = rows.filter((r) => inScope(r.unitId));
    const copies: { id: string; slug: string; networkProgrammeId: string; isActive: boolean; stationId: string; stationName: string }[] =
      visible.length
        ? await m.query(
            `SELECT p.id, p.slug, p."networkProgrammeId", p."isActive", s.id AS "stationId", s.name AS "stationName"
               FROM programmes p JOIN stations s ON s.id = p."stationId"
              WHERE p."networkProgrammeId" = ANY($1) ORDER BY s.name`,
            [visible.map((r) => r.id)],
          )
        : [];
    const slots = copies.length
      ? await m.find(ProgrammeSchedule, { where: copies.map((c) => ({ programmeId: c.id, validTo: IsNull() })) })
      : [];
    const unitName = new Map(units.map((u) => [u.id, u.name]));
    const rjOptions: { id: string; name: string }[] = await m.query(
      `SELECT r.id, r.name FROM rjs r JOIN org_rjs o ON o."rjId" = r.id AND o."organisationId" = $1 AND o.status = 'active'
        WHERE ${RJ_CAN_ACT('r')} ORDER BY r.name`,
      [organisationId],
    );
    return {
      office: { organisationId, organisationName: office.organisationName, unitId: office.unitId, unitName: office.unitName, canEdit: meets(office.programmes, 'edit') },
      places: [
        ...(office.unitId === null ? [{ id: null, name: 'Head office (all stations)' }] : []),
        ...units.filter((u) => u.kind === 'region' && inScope(u.id)).map((u) => ({ id: u.id, name: u.name })),
      ],
      rjOptions,
      programmes: visible.map((r) => ({
        ...r,
        placeName: r.unitId ? unitName.get(r.unitId) ?? 'A region' : 'Head office (all stations)',
        stations: copies
          .filter((c) => c.networkProgrammeId === r.id)
          .map((c) => ({
            programmeId: c.id,
            slug: c.slug,
            stationId: c.stationId,
            stationName: c.stationName,
            carrying: c.isActive,
            schedule: sortSlots(slots.filter((s) => s.programmeId === c.id))
              .map((s) => `${describeDays(s.daysOfWeek)} ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}${s.isRepeat ? ' (repeat)' : ''}`)
              .join(' · '),
          })),
      })),
    };
  }

  async create(listenerId: string, organisationId: string, input: NetworkProgrammeInput) {
    return this.dataSource.transaction(async (m) => {
      const office = await this.office(m, listenerId, organisationId, 'edit');
      const units = await this.units(m, organisationId);
      const unitId = input.unitId === undefined || input.unitId === null || input.unitId === '' ? office.unitId : input.unitId;
      if (unitId !== null) {
        const unit = units.find((u) => u.id === unitId);
        if (!unit || unit.kind !== 'region') throw new BadRequestException('Choose a region of this network.');
      }
      if (!withinScope(units, office.unitId, unitId)) {
        throw new ForbiddenException('You can make programmes only for your own office or the regions under it.');
      }
      const v = await this.validate(m, organisationId, input, true);
      const [{ n }] = await m.query(`SELECT count(*)::int AS n FROM network_programmes WHERE "organisationId" = $1 AND "isActive"`, [organisationId]);
      if (n >= MAX_PER_ORG) throw new BadRequestException(`This network already has ${MAX_PER_ORG} active programmes.`);

      const [row] = await m.query(
        `INSERT INTO network_programmes ("organisationId", "unitId", name, "interactionType", "noticeText", participation, "participationPrompt", "createdByListenerId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [organisationId, unitId, v.name, v.interactionType ?? 'song', v.noticeText ?? null, v.participation ?? 'off', v.participationPrompt ?? null, listenerId],
      );
      for (const rjId of v.rjIds ?? []) {
        await m.query(`INSERT INTO network_programme_rjs ("networkProgrammeId", "rjId") VALUES ($1, $2)`, [row.id, rjId]);
      }
      await writeAudit(m, listenerId, 'network_programme.created', 'network_programme', row.id, { organisationId, unitId, name: v.name });
      return { id: row.id };
    });
  }

  /** Loads a network programme for its office (edit), or throws. */
  private async forOffice(m: EntityManager, listenerId: string, id: string) {
    const [np] = await m.query(`SELECT * FROM network_programmes WHERE id = $1 FOR UPDATE`, [id]);
    if (!np) throw new NotFoundException('Programme not found.');
    const office = await this.office(m, listenerId, np.organisationId, 'edit');
    if (!withinScope(await this.units(m, np.organisationId), office.unitId, np.unitId)) {
      throw new ForbiddenException('This programme belongs to another office.');
    }
    return np as { id: string; organisationId: string; unitId: string | null; name: string; isActive: boolean };
  }

  /** Saves the office form; name, RJs and listener settings reach every station's copy. */
  async update(listenerId: string, id: string, input: NetworkProgrammeInput) {
    return this.dataSource.transaction(async (m) => {
      const np = await this.forOffice(m, listenerId, id);
      const v = await this.validate(m, np.organisationId, input, false);
      const fields: [string, unknown][] = [];
      if (v.name !== undefined) fields.push(['name', v.name]);
      if (v.interactionType !== undefined) fields.push(['interactionType', v.interactionType]);
      if (v.noticeText !== undefined) fields.push(['noticeText', v.noticeText]);
      if (v.participation !== undefined) fields.push(['participation', v.participation]);
      if (v.participationPrompt !== undefined) fields.push(['participationPrompt', v.participationPrompt]);
      if (fields.length) {
        const set = fields.map(([k], i) => `"${k}" = $${i + 2}`).join(', ');
        await m.query(`UPDATE network_programmes SET ${set}, "updatedAt" = now() WHERE id = $1`, [id, ...fields.map(([, val]) => val)]);
        await m.query(`UPDATE programmes SET ${set} WHERE "networkProgrammeId" = $1`, [id, ...fields.map(([, val]) => val)]);
      }
      if (v.rjIds !== undefined) {
        await m.query(`DELETE FROM network_programme_rjs WHERE "networkProgrammeId" = $1`, [id]);
        for (const rjId of v.rjIds) {
          await m.query(`INSERT INTO network_programme_rjs ("networkProgrammeId", "rjId") VALUES ($1, $2)`, [id, rjId]);
        }
        const copies: { id: string }[] = await m.query(`SELECT id FROM programmes WHERE "networkProgrammeId" = $1`, [id]);
        for (const copy of copies) await this.setHosts(m, copy.id, v.rjIds);
      }
      await writeAudit(m, listenerId, 'network_programme.updated', 'network_programme', id, { changed: [...fields.map(([k]) => k), ...(v.rjIds ? ['rjs'] : [])] });
      return { id };
    });
  }

  /** Turning a programme off stops it on every station; turning it back on lets stations carry it again. */
  async setActive(listenerId: string, id: string, active: unknown) {
    if (typeof active !== 'boolean') throw new BadRequestException('Say whether the programme is on or off.');
    return this.dataSource.transaction(async (m) => {
      const np = await this.forOffice(m, listenerId, id);
      if (np.isActive === active) return { id, isActive: active };
      await m.query(`UPDATE network_programmes SET "isActive" = $2, "updatedAt" = now() WHERE id = $1`, [id, active]);
      if (!active) {
        const copies: { id: string }[] = await m.query(`SELECT id FROM programmes WHERE "networkProgrammeId" = $1 AND "isActive"`, [id]);
        for (const copy of copies) await this.stop(m, copy.id);
      }
      await writeAudit(m, listenerId, active ? 'network_programme.restarted' : 'network_programme.stopped', 'network_programme', id, {});
      return { id, isActive: active };
    });
  }

  // ----------------------------------------------------------------- stations

  /** Network programmes offered to this station (by its region or above), and whether and when it carries each. */
  async forStation(listenerId: string, stationId: string) {
    const m = this.dataSource.manager;
    await assertStationAccess(m, listenerId, stationId, 'programmes', 'view');
    const rows: {
      id: string; name: string; placeName: string | null; isActive: boolean; noticeText: string | null;
      rjs: { name: string }[]; programmeId: string | null; slug: string | null; carrying: boolean | null;
    }[] = await m.query(
      `WITH RECURSIVE up AS (
         SELECT u.id, u."parentId", 0 AS depth FROM org_units u WHERE u."stationId" = $1
         UNION ALL
         SELECT x.id, x."parentId", up.depth + 1 FROM org_units x JOIN up ON x.id = up."parentId" WHERE up.depth < 20
       )
       SELECT np.id, np.name, u.name AS "placeName", np."isActive", np."noticeText",
              COALESCE((SELECT json_agg(json_build_object('name', r.name) ORDER BY r.name)
                          FROM network_programme_rjs x JOIN rjs r ON r.id = x."rjId" WHERE x."networkProgrammeId" = np.id), '[]') AS rjs,
              p.id AS "programmeId", p.slug, p."isActive" AS carrying
         FROM stations s
         JOIN network_programmes np ON np."organisationId" = s."organisationId"
         LEFT JOIN org_units u ON u.id = np."unitId"
         LEFT JOIN programmes p ON p."networkProgrammeId" = np.id AND p."stationId" = s.id
        WHERE s.id = $1
          AND (np."unitId" IS NULL OR np."unitId" IN (SELECT id FROM up))
          AND (np."isActive" OR p.id IS NOT NULL)
        ORDER BY np.name`,
      [stationId],
    );
    const ids = rows.map((r) => r.programmeId).filter((id): id is string => Boolean(id));
    const slots = ids.length ? await m.find(ProgrammeSchedule, { where: ids.map((programmeId) => ({ programmeId, validTo: IsNull() })) }) : [];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      placeName: r.placeName ?? 'Head office',
      isActive: r.isActive,
      noticeText: r.noticeText,
      rjs: r.rjs.map((x) => x.name),
      programmeId: r.programmeId,
      slug: r.slug,
      carrying: Boolean(r.carrying),
      slots: sortSlots(slots.filter((s) => s.programmeId === r.programmeId)).map((s) => ({
        id: s.id,
        days: s.daysOfWeek,
        startTime: s.startTime.slice(0, 5),
        endTime: s.endTime.slice(0, 5),
        repeat: s.isRepeat,
      })),
    }));
  }

  /**
   * The station carries the programme with these weekly times (first airings
   * and repeats). The first time makes the station's copy; later calls
   * replace its times.
   */
  async carry(listenerId: string, stationId: string, networkProgrammeId: string, input: { schedule?: SlotInput[]; confirmDrop?: unknown }) {
    const slots = parseSlots(input.schedule);
    if (!slots.length) throw new BadRequestException('Add at least one time.');
    return this.dataSource.transaction(async (m) => {
      await assertStationAccess(m, listenerId, stationId, 'programmes', 'edit');
      const [np] = await m.query(
        `WITH RECURSIVE up AS (
           SELECT u.id, u."parentId", 0 AS depth FROM org_units u WHERE u."stationId" = $2
           UNION ALL
           SELECT x.id, x."parentId", up.depth + 1 FROM org_units x JOIN up ON x.id = up."parentId" WHERE up.depth < 20
         )
         SELECT np.* FROM network_programmes np JOIN stations s ON s."organisationId" = np."organisationId" AND s.id = $2
          WHERE np.id = $1 AND (np."unitId" IS NULL OR np."unitId" IN (SELECT id FROM up))
          FOR UPDATE OF np`,
        [networkProgrammeId, stationId],
      );
      if (!np) throw new NotFoundException('This programme is not offered to your station.');
      if (!np.isActive) throw new ConflictException('The network office has stopped this programme.');
      const rjIds: string[] = (await m.query(`SELECT "rjId" FROM network_programme_rjs WHERE "networkProgrammeId" = $1`, [np.id])).map(
        (r: { rjId: string }) => r.rjId,
      );

      let copy = await m.findOneBy(Programme, { networkProgrammeId: np.id, stationId });
      if (!copy) {
        const base = np.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'programme';
        const [{ slug: stationSlug }] = await m.query(`SELECT slug FROM stations WHERE id = $1`, [stationId]);
        const root = `${base}-${String(stationSlug).slice(0, 40)}`;
        let slug = root;
        for (let n = 2; await m.exists(Programme, { where: { slug } }); n++) slug = `${root}-${n}`;
        copy = await m.save(
          m.create(Programme, {
            name: np.name,
            slug,
            rjName: null,
            startTime: null,
            endTime: null,
            callInPhone: null,
            stationId,
            stationInviteId: null,
            createdByRjId: null,
            ownerRjId: null,
            ownerStationId: stationId,
            networkProgrammeId: np.id,
            interactionType: np.interactionType,
            noticeText: np.noticeText,
            participation: np.participation,
            participationPrompt: np.participationPrompt,
            isActive: true,
          }),
        );
        await m.save(
          m.create(ProgrammeOwnership, {
            programmeId: copy.id,
            ownerRjId: null,
            ownerStationId: stationId,
            validFrom: new Date(),
            reason: 'created',
            changedByListenerId: listenerId,
          }),
        );
        await writeAudit(m, listenerId, 'network_programme.carried', 'programme', copy.id, { networkProgrammeId: np.id, stationId });
      } else if (!copy.isActive) {
        copy.isActive = true;
        await m.save(copy);
        await writeAudit(m, listenerId, 'network_programme.carried', 'programme', copy.id, { networkProgrammeId: np.id, stationId, again: true });
      }
      await this.setHosts(m, copy.id, rjIds);
      await this.schedules.replaceSlots(m, listenerId, copy.id, slots, input.confirmDrop === true);
      return { programmeId: copy.id, slug: copy.slug };
    });
  }

  /** The station stops carrying the programme: its times end today; its shows, messages and counts stay as history. */
  async stopCarrying(listenerId: string, stationId: string, networkProgrammeId: string, confirmDrop: boolean) {
    return this.dataSource.transaction(async (m) => {
      await assertStationAccess(m, listenerId, stationId, 'programmes', 'edit');
      const copy = await m.findOneBy(Programme, { networkProgrammeId, stationId });
      if (!copy || !copy.isActive) throw new NotFoundException('Your station does not carry this programme.');
      await this.schedules.replaceSlots(m, listenerId, copy.id, [], confirmDrop);
      await m.update(Programme, { id: copy.id }, { isActive: false });
      await writeAudit(m, listenerId, 'network_programme.dropped', 'programme', copy.id, { networkProgrammeId, stationId });
      return { programmeId: copy.id, carrying: false };
    });
  }

  /** Ends a copy's times and turns it off (the office stopped the programme). */
  private async stop(m: EntityManager, programmeId: string) {
    const today = todayInIndia();
    await m.query(`DELETE FROM programme_schedules WHERE "programmeId" = $1 AND "validTo" IS NULL AND "validFrom" >= $2`, [programmeId, today]);
    await m.query(
      `UPDATE programme_schedules SET "validTo" = ($2::date - 1) WHERE "programmeId" = $1 AND "validTo" IS NULL`,
      [programmeId, today],
    );
    await m.query(`UPDATE programmes SET "isActive" = false, "startTime" = NULL, "endTime" = NULL WHERE id = $1`, [programmeId]);
  }

  private async setHosts(m: EntityManager, programmeId: string, rjIds: string[]) {
    await m.delete(ProgrammeRj, { programmeId });
    for (const rjId of rjIds) await m.save(m.create(ProgrammeRj, { programmeId, rjId }));
    const names: { name: string }[] = rjIds.length ? await m.query(`SELECT name FROM rjs WHERE id = ANY($1) ORDER BY name`, [rjIds]) : [];
    await m.update(Programme, { id: programmeId }, { rjName: names.map((n) => n.name).join(', ').slice(0, 150) || null });
  }
}

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/**
 * /network-programmes
 *   GET  offices                         network offices the person works at
 *   GET  ?organisationId=                the office's programmes
 *   POST /                               make one (body: organisationId + fields)
 *   PATCH :id                            edit; reaches every station's copy
 *   PUT  :id/active                      stop or restart everywhere
 * /stations/:stationId/network-programmes
 *   GET                                  offered to the station
 *   PUT  :id                             carry it with these times (body: schedule, confirmDrop)
 *   DELETE :id?confirm=true              stop carrying it
 */
@Controller()
export class NetworkProgrammesController {
  constructor(private readonly service: NetworkProgrammesService) {}

  @Get('network-programmes/offices')
  offices(@Req() req: Request) {
    return this.service.offices(listenerId(req));
  }

  @Get('network-programmes')
  list(@Req() req: Request, @Query('organisationId', ParseUUIDPipe) organisationId: string) {
    return this.service.listForOffice(listenerId(req), organisationId);
  }

  @Post('network-programmes')
  create(@Req() req: Request, @Body() body: NetworkProgrammeInput & { organisationId?: string }) {
    if (typeof body?.organisationId !== 'string' || !UUID.test(body.organisationId)) throw new BadRequestException('Choose the network.');
    return this.service.create(listenerId(req), body.organisationId, body);
  }

  @Patch('network-programmes/:id')
  update(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: NetworkProgrammeInput) {
    return this.service.update(listenerId(req), id, body ?? {});
  }

  @Put('network-programmes/:id/active')
  setActive(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { active?: unknown }) {
    return this.service.setActive(listenerId(req), id, body?.active);
  }

  @Get('stations/:stationId/network-programmes')
  forStation(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.service.forStation(listenerId(req), stationId);
  }

  @Put('stations/:stationId/network-programmes/:id')
  carry(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { schedule?: SlotInput[]; confirmDrop?: unknown },
  ) {
    return this.service.carry(listenerId(req), stationId, id, body ?? {});
  }

  @Delete('stations/:stationId/network-programmes/:id')
  stopCarrying(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('confirm') confirm?: string,
  ) {
    return this.service.stopCarrying(listenerId(req), stationId, id, confirm === 'true');
  }
}

@Module({ controllers: [NetworkProgrammesController], providers: [NetworkProgrammesService] })
export class NetworkProgrammesModule {}
