import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ShowOccurrence } from '../show-occurrence.entity';
import { EngagementEvent } from '../engagement-event.entity';
import { Rj } from '../rj.entity';
import { assertStationRep } from '../onboarding/helpers';

const DEVICE = /^[A-Za-z0-9-]{8,64}$/;
const DAY = 24 * 3600 * 1000;

type ShowRow = {
  id: string;
  airDate: string;
  startsAt: Date;
  endsAt: Date;
  programmeName: string;
  programmeSlug: string;
  hosts: string | null;
  likes: number;
  fires: number;
  callTaps: number;
  callers: number;
};

type Totals = { likes: number; fires: number; callTaps: number; callers: number; shows: number };

/**
 * Engagement numbers. "Callers" counts distinct people who tapped Call:
 * the signed-in listener when known, otherwise the anonymous device.
 */
@Injectable()
export class EngagementService {
  constructor(private readonly dataSource: DataSource) {}

  /** Records a tap on a show's Call button. Anyone may tap; no sign-in needed. */
  async recordCallTap(occurrenceId: string, listenerId: string | null, deviceIdInput: unknown) {
    const deviceId = typeof deviceIdInput === 'string' && DEVICE.test(deviceIdInput) ? deviceIdInput : null;
    if (!listenerId && !deviceId) {
      throw new BadRequestException('A device id is needed.');
    }
    const show = await this.dataSource.manager.findOneBy(ShowOccurrence, { id: occurrenceId });
    if (!show) throw new NotFoundException('Show not found.');

    await this.dataSource.manager.insert(EngagementEvent, {
      type: 'call_tap',
      programmeId: show.programmeId,
      showOccurrenceId: show.id,
      listenerId,
      deviceId,
    });
    return { recorded: true };
  }

  /** Per-show numbers for shows that started in the last `days` days, newest first. */
  private async shows(filterSql: string, param: string, now: Date, days: number): Promise<ShowRow[]> {
    const rows: ShowRow[] = await this.dataSource.query(
      `
      SELECT o.id, o."airDate"::text AS "airDate", o."startsAt", o."endsAt",
             p.name AS "programmeName", p.slug AS "programmeSlug",
             (SELECT string_agg(r.name, ', ' ORDER BY r.name)
                FROM show_occurrence_hosts h JOIN rjs r ON r.id = h."rjId"
               WHERE h."occurrenceId" = o.id) AS hosts,
             (SELECT count(*)::int FROM reactions x WHERE x."showOccurrenceId" = o.id AND x.type = 'like') AS likes,
             (SELECT count(*)::int FROM reactions x WHERE x."showOccurrenceId" = o.id AND x.type = 'fire') AS fires,
             (SELECT count(*)::int FROM engagement_events e WHERE e."showOccurrenceId" = o.id AND e.type = 'call_tap') AS "callTaps",
             (SELECT count(DISTINCT COALESCE(e."listenerId"::text, e."deviceId"))::int
                FROM engagement_events e WHERE e."showOccurrenceId" = o.id AND e.type = 'call_tap') AS callers
      FROM show_occurrences o
      JOIN programmes p ON p.id = o."programmeId"
      WHERE ${filterSql}
        AND o.status = 'scheduled'
        AND o."startsAt" <= $2
        AND o."startsAt" > $3
      ORDER BY o."startsAt" DESC
      `,
      [param, now, new Date(now.getTime() - days * DAY)],
    );
    return rows.map((r) => ({ ...r, startsAt: new Date(r.startsAt), endsAt: new Date(r.endsAt) }));
  }

  private totals(rows: ShowRow[], from: Date, to: Date): Totals {
    const inRange = rows.filter((r) => r.startsAt > from && r.startsAt <= to);
    return {
      shows: inRange.length,
      likes: inRange.reduce((n, r) => n + r.likes, 0),
      fires: inRange.reduce((n, r) => n + r.fires, 0),
      callTaps: inRange.reduce((n, r) => n + r.callTaps, 0),
      callers: inRange.reduce((n, r) => n + r.callers, 0),
    };
  }

  private summarise(rows: ShowRow[], now: Date) {
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const twoWeeksAgo = new Date(now.getTime() - 14 * DAY);
    return {
      last7Days: this.totals(rows, weekAgo, now),
      previous7Days: this.totals(rows, twoWeeksAgo, weekAgo),
      shows: rows.map((r) => ({ ...r, live: r.startsAt <= now && now < r.endsAt })),
    };
  }

  /** The signed-in RJ: followers plus every show they hosted in the last 14 days. */
  async forRj(listenerId: string, now = new Date()) {
    const rj = await this.dataSource.manager.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
    if (!rj) throw new NotFoundException('Register your RJ profile first.');

    const [followers] = await this.dataSource.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE "createdAt" > $2)::int AS "new7Days"
         FROM follows WHERE "rjId" = $1`,
      [rj.id, new Date(now.getTime() - 7 * DAY)],
    );
    const rows = await this.shows(
      `EXISTS (SELECT 1 FROM show_occurrence_hosts h WHERE h."occurrenceId" = o.id AND h."rjId" = $1)`,
      rj.id,
      now,
      14,
    );
    return { followers, ...this.summarise(rows, now) };
  }

  /** An approved station representative: every show aired on the station in the last 14 days. */
  async forStation(listenerId: string, stationId: string, now = new Date()) {
    await assertStationRep(this.dataSource.manager, listenerId, stationId);
    const rows = await this.shows(`o."stationId" = $1`, stationId, now, 14);
    return this.summarise(rows, now);
  }
}
