import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Programme } from '../programme.entity';
import { ProgrammeRj } from '../programme-rj.entity';
import { ProgrammeSchedule } from '../programme-schedule.entity';
import { ShowOccurrence } from '../show-occurrence.entity';
import { ShowOccurrenceHost } from '../show-occurrence-host.entity';
import { Reaction } from '../reaction.entity';
import { Listener } from '../listener.entity';
import { ScheduleException } from '../schedule-exception.entity';
import { addDays, canReact, indiaDate, planShows } from './occurrence-rules';

export type ReactionType = 'like' | 'fire';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOUR = 3600 * 1000;
const key = (programmeId: string, startsAt: Date) => `${programmeId}|${startsAt.toISOString()}`;

@Injectable()
export class ShowsService {
  /** Generation runs at most this often; schedule changes show up within it. */
  static readonly REFRESH_MS = 30_000;
  private lastRefresh = 0;

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Makes sure every show from yesterday to tomorrow (India time) exists.
   * Shows that have not started yet follow the current schedule, owner and
   * hosts; shows that have started keep what they aired with.
   */
  async refreshShows(now = new Date(), force = false) {
    if (!force && now.getTime() - this.lastRefresh < ShowsService.REFRESH_MS) return;
    this.lastRefresh = now.getTime();

    const today = indiaDate(now);
    const fromDate = addDays(today, -1);
    const toDate = addDays(today, 1);

    await this.dataSource.transaction(async (m) => {
      const slots = await m
        .createQueryBuilder(ProgrammeSchedule, 's')
        .innerJoin(Programme, 'p', 'p.id = s.programmeId AND p.isActive = true')
        .where('s.validFrom <= :toDate', { toDate })
        .andWhere('(s.validTo IS NULL OR s.validTo >= :fromDate)', { fromDate })
        .getMany();

      const planned = planShows(slots, fromDate, toDate);
      const plannedKeys = new Set(planned.map((show) => key(show.programmeId, show.startsAt)));

      const existing = await m
        .createQueryBuilder(ShowOccurrence, 'o')
        .where('o.airDate BETWEEN :fromDate AND :toDate', { fromDate, toDate })
        .getMany();
      // Shows are matched by when the schedule said they start, so a moved show stays the same show.
      const existingByKey = new Map(existing.map((o) => [key(o.programmeId, o.originalStartsAt), o]));

      // Future shows that no longer match a current slot go away.
      const stale = existing.filter(
        (o) => o.startsAt > now && !plannedKeys.has(key(o.programmeId, o.originalStartsAt)),
      );
      if (stale.length) {
        await m.delete(ShowOccurrence, { id: In(stale.map((o) => o.id)) });
      }

      const programmeIds = [...new Set(planned.map((show) => show.programmeId))];
      if (!programmeIds.length) return;
      const programmes = new Map(
        (await m.findBy(Programme, { id: In(programmeIds) })).map((p) => [p.id, p]),
      );
      const exceptions = new Map(
        (await m.findBy(ScheduleException, { programmeId: In(programmeIds) })).map((e) => [
          key(e.programmeId, e.originalStartsAt),
          e,
        ]),
      );
      const hostsByProgramme = new Map<string, string[]>();
      for (const row of await m.findBy(ProgrammeRj, { programmeId: In(programmeIds) })) {
        hostsByProgramme.set(row.programmeId, [...(hostsByProgramme.get(row.programmeId) ?? []), row.rjId]);
      }

      for (const show of planned) {
        const programme = programmes.get(show.programmeId)!;
        const snapshot = {
          scheduleId: show.scheduleId,
          stationId: programme.stationId,
          ownerRjId: programme.ownerRjId,
          ownerStationId: programme.ownerStationId,
        };
        const change = exceptions.get(key(show.programmeId, show.startsAt));
        const timing = {
          startsAt: change?.action === 'move' ? change.newStartsAt! : show.startsAt,
          endsAt: change?.action === 'move' ? change.newEndsAt! : show.endsAt,
          status: (change?.action === 'cancel' ? 'cancelled' : 'scheduled') as 'cancelled' | 'scheduled',
        };
        const current = existingByKey.get(key(show.programmeId, show.startsAt));

        if (!current) {
          const id = randomUUID();
          const inserted = await m
            .createQueryBuilder()
            .insert()
            .into(ShowOccurrence)
            .values({ id, programmeId: show.programmeId, airDate: show.airDate, originalStartsAt: show.startsAt, ...timing, ...snapshot })
            .orIgnore()
            .returning(['id'])
            .execute();
          if (inserted.raw.length) {
            await this.setHosts(m, id, hostsByProgramme.get(show.programmeId) ?? []);
          }
        } else if (current.startsAt > now) {
          // Not started yet: follow the latest schedule, one-day change, owner and hosts.
          await m.update(ShowOccurrence, { id: current.id }, { ...snapshot, ...timing });
          await this.setHosts(m, current.id, hostsByProgramme.get(show.programmeId) ?? []);
        }
      }
    });
  }

  private async setHosts(m: EntityManager, occurrenceId: string, rjIds: string[]) {
    await m.delete(ShowOccurrenceHost, { occurrenceId });
    if (rjIds.length) {
      await m.insert(ShowOccurrenceHost, rjIds.map((rjId) => ({ occurrenceId, rjId })));
    }
  }

  /** Live now, starting in the next 24 hours, and ended in the last 24 hours. */
  async getNow(now = new Date()) {
    await this.refreshShows(now);

    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `
      SELECT
        o.id, o."startsAt", o."endsAt", o.status,
        p.name AS "programmeName", p.slug AS "programmeSlug", p."callInPhone",
        s.name AS "stationName", s.slug AS "stationSlug",
        i."stationName" AS "invitedStationName",
        COALESCE((
          SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'slug', r.slug, 'photoUrl', r."photoUrl") ORDER BY r.name)
          FROM show_occurrence_hosts h JOIN rjs r ON r.id = h."rjId"
          WHERE h."occurrenceId" = o.id
            AND r."isActive" = true
            AND r."verificationStatus" IN ('verified', 'legacy')
        ), '[]') AS hosts,
        (SELECT count(*)::int FROM reactions x WHERE x."showOccurrenceId" = o.id AND x.type = 'like') AS likes,
        (SELECT count(*)::int FROM reactions x WHERE x."showOccurrenceId" = o.id AND x.type = 'fire') AS fires
      FROM show_occurrences o
      JOIN programmes p ON p.id = o."programmeId" AND p."isActive" = true
      LEFT JOIN stations s ON s.id = o."stationId"
      LEFT JOIN station_invites i ON i.id = p."stationInviteId"
      WHERE o.status = 'scheduled'
        AND o."endsAt" >= $1
        AND o."startsAt" <= $2
      ORDER BY o."startsAt"
      `,
      [new Date(now.getTime() - 24 * HOUR), new Date(now.getTime() + 24 * HOUR)],
    );

    const shows = rows.map((row) => {
      const startsAt = new Date(row.startsAt as string);
      const endsAt = new Date(row.endsAt as string);
      return {
        id: row.id as string,
        startsAt,
        endsAt,
        programme: {
          name: row.programmeName as string,
          slug: row.programmeSlug as string,
          callInPhone: (row.callInPhone as string | null) ?? null,
        },
        station: row.stationName
          ? { name: row.stationName as string, slug: row.stationSlug as string }
          : null,
        invitedStationName: (row.invitedStationName as string | null) ?? null,
        hosts: row.hosts as { id: string; name: string; slug: string; photoUrl: string | null }[],
        likes: row.likes as number,
        fires: row.fires as number,
        canReact: canReact({ startsAt, endsAt, status: row.status as string }, now),
      };
    });

    return {
      now,
      live: shows.filter((s) => s.startsAt <= now && now < s.endsAt),
      upcoming: shows.filter((s) => s.startsAt > now),
      recent: shows.filter((s) => s.endsAt <= now).reverse(),
    };
  }

  // -------------------------------------------------------------- reactions

  async setReaction(listenerId: string, occurrenceId: string, type: ReactionType, active: boolean, now = new Date()) {
    const show = await this.dataSource.manager.findOneBy(ShowOccurrence, { id: occurrenceId });
    if (!show) {
      throw new NotFoundException('Show not found.');
    }
    const listener = await this.dataSource.manager.findOneBy(Listener, { id: listenerId, isActive: true });
    if (!listener) {
      throw new NotFoundException('Listener not found.');
    }

    if (active) {
      if (!canReact(show, now)) {
        throw new ForbiddenException('Reactions open when the show starts and close 24 hours after it ends.');
      }
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(Reaction)
        .values({ listenerId, showOccurrenceId: occurrenceId, rjId: null, programmeId: null, type })
        .orIgnore()
        .execute();
    } else {
      await this.dataSource.manager.delete(Reaction, { listenerId, showOccurrenceId: occurrenceId, type });
    }

    const counts = await this.counts(occurrenceId);
    return { active, ...counts };
  }

  private async counts(occurrenceId: string) {
    const [likes, fires] = await Promise.all([
      this.dataSource.manager.countBy(Reaction, { showOccurrenceId: occurrenceId, type: 'like' }),
      this.dataSource.manager.countBy(Reaction, { showOccurrenceId: occurrenceId, type: 'fire' }),
    ]);
    return { likes, fires };
  }

  /** Which of these shows the listener has liked or fired. */
  async reactionStatus(listenerId: string, idsParam: string | undefined) {
    const ids = [...new Set((idsParam ?? '').split(',').map((id) => id.trim()).filter(Boolean))];
    if (ids.length > 100 || ids.some((id) => !UUID.test(id))) {
      throw new BadRequestException('Give up to 100 show ids.');
    }
    const result: Record<string, { liked: boolean; fired: boolean }> = {};
    for (const id of ids) result[id] = { liked: false, fired: false };
    if (!ids.length) return result;

    const rows = await this.dataSource.manager.find(Reaction, {
      where: { listenerId, showOccurrenceId: In(ids) },
      select: { showOccurrenceId: true, type: true },
    });
    for (const row of rows) {
      const entry = result[row.showOccurrenceId!];
      if (row.type === 'like') entry.liked = true;
      if (row.type === 'fire') entry.fired = true;
    }
    return result;
  }
}
