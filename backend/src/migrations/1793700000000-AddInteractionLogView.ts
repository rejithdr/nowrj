import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * interaction_log: one row per listener interaction (Like, Fire, call tap,
 * song request, question) with when it happened, the show, programme, show
 * date, hosting RJ(s), station, type and an anonymous listener key.
 * The key is the listener's random account id, or "device:<id>" for call taps
 * made while signed out; it never contains a name or email.
 *
 * Reactions made on RJ profiles before shows existed have no show, so their
 * show, programme and station columns are empty.
 */
export class AddInteractionLogView1793700000000 implements MigrationInterface {
  name = 'AddInteractionLogView1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE VIEW "interaction_log" AS
      WITH events AS (
        SELECT (r."createdAt" AT TIME ZONE current_setting('TimeZone')) AS "at",
               r.type::text AS "interactionType",
               r."showOccurrenceId" AS "showId",
               r."rjId" AS "legacyRjId",
               r."listenerId"::text AS "listenerKey"
          FROM reactions r
        UNION ALL
        SELECT e."createdAt", e.type::text, e."showOccurrenceId", NULL,
               COALESCE(e."listenerId"::text, 'device:' || e."deviceId")
          FROM engagement_events e
        UNION ALL
        SELECT s."createdAt",
               CASE WHEN s.kind = 'question' THEN 'question' ELSE 'song_request' END,
               s."showOccurrenceId", NULL, s."listenerId"::text
          FROM song_requests s
      )
      SELECT ev."at",
             ev."interactionType",
             ev."showId",
             o."airDate" AS "showDate",
             o."programmeId",
             p.name AS "programmeName",
             COALESCE(
               (SELECT array_agg(h."rjId" ORDER BY h."rjId") FROM show_occurrence_hosts h WHERE h."occurrenceId" = o.id),
               CASE WHEN ev."legacyRjId" IS NOT NULL THEN ARRAY[ev."legacyRjId"] END
             ) AS "rjIds",
             o."stationId",
             st.name AS "stationName",
             ev."listenerKey"
        FROM events ev
        LEFT JOIN show_occurrences o ON o.id = ev."showId"
        LEFT JOIN programmes p ON p.id = o."programmeId"
        LEFT JOIN stations st ON st.id = o."stationId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "interaction_log"`);
  }
}
