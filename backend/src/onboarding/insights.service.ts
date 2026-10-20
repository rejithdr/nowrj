import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Times stored without a time zone (listeners, follows, reactions) are read
 * in the database's own zone, then shown in Indian time; times stored with a
 * zone are converted directly. Weeks start on Monday, India time.
 */
const IST_NAIVE = (col: string) => `((${col} AT TIME ZONE current_setting('TimeZone')) AT TIME ZONE 'Asia/Kolkata')`;
const IST_TZ = (col: string) => `(${col} AT TIME ZONE 'Asia/Kolkata')`;

type Week = {
  week: string;
  newListeners: number;
  referredListeners: number;
  activeListeners: number;
  returningListeners: number;
  likes: number;
  fires: number;
  callTaps: number;
  songRequests: number;
  follows: number;
};

/** Platform-wide numbers for the Super Admin. */
@Injectable()
export class InsightsService {
  constructor(private readonly dataSource: DataSource) {}

  async overview(weeks = 8) {
    const q = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      this.dataSource.query(sql, params) as Promise<T[]>;

    const [totals] = await q(`
      SELECT
        (SELECT count(*)::int FROM listeners) AS listeners,
        (SELECT count(*)::int FROM referrals) AS "referredListeners",
        (SELECT count(*)::int FROM rjs) AS rjs,
        (SELECT count(*)::int FROM rjs WHERE "verificationStatus" = 'pending') AS "rjsPending",
        (SELECT count(*)::int FROM rjs WHERE "verificationStatus" IN ('verified','legacy') AND "isActive") AS "rjsLive",
        (SELECT count(*)::int FROM stations WHERE "verificationStatus" IN ('verified','legacy') AND "isActive") AS "stationsLive",
        (SELECT count(*)::int FROM stations WHERE "verificationStatus" = 'pending') AS "stationsPending",
        (SELECT count(*)::int FROM programmes WHERE "isActive") AS "programmesLive",
        (SELECT count(*)::int FROM programmes WHERE "isActive" AND "ownerStationId" IS NOT NULL) AS "programmesStationOwned",
        (SELECT count(*)::int FROM referrals WHERE kind = 'rj') AS "rjReferrals",
        (SELECT count(*)::int FROM referrals WHERE kind = 'rj' AND "activatedAt" IS NOT NULL) AS "rjReferralsVerified"
    `);

    // One row per week, oldest first, for the last `weeks` weeks including this one.
    const series = await q<Week>(
      `
      WITH bounds AS (
        SELECT date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata') - (($1::int - 1) * interval '1 week') AS start
      ),
      wk AS (
        SELECT generate_series((SELECT start FROM bounds), date_trunc('week', now() AT TIME ZONE 'Asia/Kolkata'), interval '1 week') AS week
      ),
      acts AS (
        SELECT "listenerId" AS lid, ${IST_NAIVE('"createdAt"')} AS t FROM reactions
        UNION ALL SELECT "listenerId", ${IST_NAIVE('"createdAt"')} FROM follows
        UNION ALL SELECT "listenerId", ${IST_TZ('"createdAt"')} FROM song_requests
        UNION ALL SELECT "listenerId", ${IST_TZ('"createdAt"')} FROM engagement_events WHERE "listenerId" IS NOT NULL
      ),
      weekly AS (SELECT DISTINCT lid, date_trunc('week', t) AS week FROM acts),
      firsts AS (SELECT lid, min(week) AS first_week FROM weekly GROUP BY lid)
      SELECT
        to_char(wk.week, 'YYYY-MM-DD') AS week,
        (SELECT count(*)::int FROM listeners l WHERE date_trunc('week', ${IST_NAIVE('l."createdAt"')}) = wk.week) AS "newListeners",
        (SELECT count(*)::int FROM referrals f WHERE date_trunc('week', ${IST_TZ('f."createdAt"')}) = wk.week) AS "referredListeners",
        (SELECT count(*)::int FROM weekly w WHERE w.week = wk.week) AS "activeListeners",
        (SELECT count(*)::int FROM weekly w JOIN firsts f ON f.lid = w.lid WHERE w.week = wk.week AND f.first_week < wk.week) AS "returningListeners",
        (SELECT count(*)::int FROM reactions r WHERE r.type = 'like' AND date_trunc('week', ${IST_NAIVE('r."createdAt"')}) = wk.week) AS likes,
        (SELECT count(*)::int FROM reactions r WHERE r.type = 'fire' AND date_trunc('week', ${IST_NAIVE('r."createdAt"')}) = wk.week) AS fires,
        (SELECT count(*)::int FROM engagement_events e WHERE e.type = 'call_tap' AND date_trunc('week', ${IST_TZ('e."createdAt"')}) = wk.week) AS "callTaps",
        (SELECT count(*)::int FROM song_requests s WHERE date_trunc('week', ${IST_TZ('s."createdAt"')}) = wk.week) AS "songRequests",
        (SELECT count(*)::int FROM follows f WHERE date_trunc('week', ${IST_NAIVE('f."createdAt"')}) = wk.week) AS follows
      FROM wk
      ORDER BY wk.week
      `,
      [weeks],
    );

    // RJ funnel: how far self-registered and listed RJs have got.
    const [funnel] = await q(`
      SELECT
        count(*)::int AS registered,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM rj_station_affiliations a WHERE a."rjId" = r.id))::int AS "withStation",
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM programme_rjs pr WHERE pr."rjId" = r.id))::int AS "withProgramme",
        count(*) FILTER (WHERE r."verificationStatus" IN ('verified','legacy'))::int AS verified,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM show_occurrence_hosts h
          JOIN show_occurrences o ON o.id = h."occurrenceId"
          WHERE h."rjId" = r.id AND o."startsAt" > now() - interval '7 days' AND o."startsAt" <= now()
            AND (EXISTS (SELECT 1 FROM reactions x WHERE x."showOccurrenceId" = o.id)
              OR EXISTS (SELECT 1 FROM song_requests s WHERE s."showOccurrenceId" = o.id)
              OR EXISTS (SELECT 1 FROM engagement_events e WHERE e."showOccurrenceId" = o.id))
        ))::int AS "activeLast7Days"
      FROM rjs r
    `);

    const interactionsPerShow = `
      (SELECT count(*) FROM reactions x WHERE x."showOccurrenceId" = o.id)
      + (SELECT count(*) FROM song_requests s WHERE s."showOccurrenceId" = o.id)
      + (SELECT count(*) FROM engagement_events e WHERE e."showOccurrenceId" = o.id)`;

    const topRjs = await q(`
      SELECT r.name, r.slug,
             (SELECT count(*)::int FROM follows f WHERE f."rjId" = r.id) AS followers,
             coalesce(sum(${interactionsPerShow}), 0)::int AS interactions
        FROM rjs r
        JOIN show_occurrence_hosts h ON h."rjId" = r.id
        JOIN show_occurrences o ON o.id = h."occurrenceId"
       WHERE o."startsAt" > now() - interval '7 days' AND o."startsAt" <= now()
       GROUP BY r.id
       ORDER BY interactions DESC, followers DESC
       LIMIT 5
    `);

    const topProgrammes = await q(`
      SELECT p.name, p.slug, s.name AS station,
             count(o.id)::int AS shows,
             coalesce(sum(${interactionsPerShow}), 0)::int AS interactions
        FROM programmes p
        JOIN show_occurrences o ON o."programmeId" = p.id
        LEFT JOIN stations s ON s.id = p."stationId"
       WHERE o."startsAt" > now() - interval '7 days' AND o."startsAt" <= now()
       GROUP BY p.id, s.name
       ORDER BY interactions DESC
       LIMIT 5
    `);

    return { totals, series, funnel, topRjs, topProgrammes };
  }
}
