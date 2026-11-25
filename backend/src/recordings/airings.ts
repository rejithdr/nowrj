import type { EntityManager } from 'typeorm';

/** What a show card needs to know about the recording a show plays. */
export type AiringInfo = {
  recordingId: string;
  title: string;
  guestName: string | null;
  /** True for every airing after the first: nobody is live, so requests are off. */
  repeat: boolean;
  firstAiredAt: string;
  firstStationName: string;
  /** Other airings in the next 7 days, on any station. */
  otherAirings: { showId: string; startsAt: string; stationName: string }[];
};

/** Recording details for a set of shows (show id → info). */
export async function airingsForShows(m: EntityManager, showIds: string[], now = new Date()) {
  const result = new Map<string, AiringInfo>();
  if (!showIds.length) return result;
  const rows: {
    showId: string; recordingId: string; title: string; guestName: string | null;
    firstShowId: string; firstAiredAt: Date; firstStationName: string;
    others: { showId: string; startsAt: string; stationName: string }[] | null;
  }[] = await m.query(
    `
    SELECT ra."showOccurrenceId" AS "showId", r.id AS "recordingId", r.title, r."guestName",
           first.id AS "firstShowId", first."startsAt" AS "firstAiredAt", first."stationName" AS "firstStationName",
           (SELECT json_agg(json_build_object('showId', o2.id, 'startsAt', o2."startsAt", 'stationName', s2.name) ORDER BY o2."startsAt")
              FROM recording_airings ra2
              JOIN show_occurrences o2 ON o2.id = ra2."showOccurrenceId" AND o2.status = 'scheduled'
              JOIN stations s2 ON s2.id = ra2."stationId"
             WHERE ra2."recordingId" = r.id AND ra2."showOccurrenceId" <> ra."showOccurrenceId"
               AND NOT EXISTS (SELECT 1 FROM hidden_stations hs WHERE hs.id = ra2."stationId")
               AND o2."endsAt" >= $2 AND o2."startsAt" <= $2::timestamptz + interval '7 days') AS others
      FROM recording_airings ra
      JOIN recordings r ON r.id = ra."recordingId"
      -- The premiere is the owning station's first airing (stations it was
      -- offered to cannot take that from it); if the owner has none, the
      -- earliest airing anywhere. A hidden station is not named.
      CROSS JOIN LATERAL (
        SELECT o1.id, o1."startsAt",
               CASE WHEN EXISTS (SELECT 1 FROM hidden_stations hs WHERE hs.id = s1.id) THEN 'another station' ELSE s1.name END AS "stationName"
          FROM recording_airings ra1
          JOIN show_occurrences o1 ON o1.id = ra1."showOccurrenceId" AND o1.status = 'scheduled'
          JOIN stations s1 ON s1.id = ra1."stationId"
         WHERE ra1."recordingId" = r.id
         ORDER BY (ra1."stationId" = r."ownerStationId") DESC, o1."startsAt", o1.id LIMIT 1) first
     WHERE ra."showOccurrenceId" = ANY($1)
    `,
    [showIds, now],
  );
  for (const r of rows) {
    result.set(r.showId, {
      recordingId: r.recordingId,
      title: r.title,
      guestName: r.guestName,
      repeat: r.firstShowId !== r.showId,
      firstAiredAt: new Date(r.firstAiredAt).toISOString(),
      firstStationName: r.firstStationName,
      otherAirings: r.others ?? [],
    });
  }
  return result;
}

/** True when this show plays a recording that already aired (or airs) earlier. */
export async function isRepeatAiring(m: EntityManager, showId: string) {
  const info = (await airingsForShows(m, [showId])).get(showId);
  return Boolean(info?.repeat);
}
