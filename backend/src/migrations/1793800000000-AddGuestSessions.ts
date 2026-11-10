import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Ask the guest": a pre-recorded show with a guest. Listeners send questions
 * from 24 hours until 2 hours before the recording.
 *
 * - guest_sessions: one guest recording for a programme
 * - guest_session_photos: optional guest photo (kept in the database, like RJ photos)
 * - song_requests: a question now belongs either to a show or to a guest
 *   session (exactly one of the two)
 * - interaction_log: guest questions included, with programme, station and hosts
 */
export class AddGuestSessions1793800000000 implements MigrationInterface {
  name = 'AddGuestSessions1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "guest_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "programmeId" uuid NOT NULL,
        "guestName" varchar(100) NOT NULL,
        "guestLine" varchar(100),
        "photoUrl" varchar(255),
        "recordingAt" timestamptz NOT NULL,
        "airAt" timestamptz,
        "status" varchar(20) NOT NULL DEFAULT 'scheduled',
        "createdByListenerId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guest_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_guest_sessions_programme" FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_guest_sessions_creator" FOREIGN KEY ("createdByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_guest_sessions_status" CHECK ("status" IN ('scheduled', 'cancelled')),
        CONSTRAINT "CHK_guest_sessions_air_after_recording" CHECK ("airAt" IS NULL OR "airAt" >= "recordingAt")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_guest_sessions_recording" ON "guest_sessions" ("recordingAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_guest_sessions_programme" ON "guest_sessions" ("programmeId")`);
    await queryRunner.query(`
      CREATE TABLE "guest_session_photos" (
        "guestSessionId" uuid NOT NULL,
        "data" bytea NOT NULL,
        "contentType" varchar(30) NOT NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guest_session_photos" PRIMARY KEY ("guestSessionId"),
        CONSTRAINT "FK_guest_session_photos_session" FOREIGN KEY ("guestSessionId") REFERENCES "guest_sessions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "song_requests"
        ALTER COLUMN "showOccurrenceId" DROP NOT NULL,
        ADD COLUMN "guestSessionId" uuid NULL,
        ADD CONSTRAINT "FK_song_requests_guest_session" FOREIGN KEY ("guestSessionId") REFERENCES "guest_sessions"("id") ON DELETE CASCADE,
        ADD CONSTRAINT "CHK_song_requests_target" CHECK (
          ("showOccurrenceId" IS NOT NULL AND "guestSessionId" IS NULL)
          OR ("showOccurrenceId" IS NULL AND "guestSessionId" IS NOT NULL AND "kind" = 'question')
        )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_song_requests_guest" ON "song_requests" ("guestSessionId", "listenerId")`);

    await queryRunner.query(`DROP VIEW "interaction_log"`);
    await queryRunner.query(`
      CREATE VIEW "interaction_log" AS
      WITH events AS (
        SELECT (r."createdAt" AT TIME ZONE current_setting('TimeZone')) AS "at",
               r.type::text AS "interactionType",
               r."showOccurrenceId" AS "showId",
               NULL::uuid AS "guestSessionId",
               r."rjId" AS "legacyRjId",
               r."listenerId"::text AS "listenerKey"
          FROM reactions r
        UNION ALL
        SELECT e."createdAt", e.type::text, e."showOccurrenceId", NULL, NULL,
               COALESCE(e."listenerId"::text, 'device:' || e."deviceId")
          FROM engagement_events e
        UNION ALL
        SELECT s."createdAt",
               CASE WHEN s."guestSessionId" IS NOT NULL THEN 'guest_question'
                    WHEN s.kind = 'question' THEN 'question' ELSE 'song_request' END,
               s."showOccurrenceId", s."guestSessionId", NULL, s."listenerId"::text
          FROM song_requests s
      )
      SELECT ev."at",
             ev."interactionType",
             ev."showId",
             ev."guestSessionId",
             COALESCE(o."airDate", (gs."airAt" AT TIME ZONE 'Asia/Kolkata')::date) AS "showDate",
             COALESCE(o."programmeId", gs."programmeId") AS "programmeId",
             p.name AS "programmeName",
             COALESCE(
               (SELECT array_agg(h."rjId" ORDER BY h."rjId") FROM show_occurrence_hosts h WHERE h."occurrenceId" = o.id),
               (SELECT array_agg(pr."rjId" ORDER BY pr."rjId") FROM programme_rjs pr WHERE gs.id IS NOT NULL AND pr."programmeId" = gs."programmeId"),
               CASE WHEN ev."legacyRjId" IS NOT NULL THEN ARRAY[ev."legacyRjId"] END
             ) AS "rjIds",
             COALESCE(o."stationId", gp."stationId") AS "stationId",
             st.name AS "stationName",
             ev."listenerKey"
        FROM events ev
        LEFT JOIN show_occurrences o ON o.id = ev."showId"
        LEFT JOIN guest_sessions gs ON gs.id = ev."guestSessionId"
        LEFT JOIN programmes gp ON gp.id = gs."programmeId"
        LEFT JOIN programmes p ON p.id = COALESCE(o."programmeId", gs."programmeId")
        LEFT JOIN stations st ON st.id = COALESCE(o."stationId", gp."stationId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP VIEW "interaction_log"`);
    await queryRunner.query(`DELETE FROM "song_requests" WHERE "guestSessionId" IS NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "song_requests"
        DROP CONSTRAINT "CHK_song_requests_target",
        DROP CONSTRAINT "FK_song_requests_guest_session",
        DROP COLUMN "guestSessionId",
        ALTER COLUMN "showOccurrenceId" SET NOT NULL
    `);
    await queryRunner.query(`DROP TABLE "guest_session_photos"`);
    await queryRunner.query(`DROP TABLE "guest_sessions"`);
    // Recreate the previous view (from 1793700000000-AddInteractionLogView).
    await queryRunner.query(`
      CREATE VIEW "interaction_log" AS
      WITH events AS (
        SELECT (r."createdAt" AT TIME ZONE current_setting('TimeZone')) AS "at", r.type::text AS "interactionType",
               r."showOccurrenceId" AS "showId", r."rjId" AS "legacyRjId", r."listenerId"::text AS "listenerKey"
          FROM reactions r
        UNION ALL
        SELECT e."createdAt", e.type::text, e."showOccurrenceId", NULL, COALESCE(e."listenerId"::text, 'device:' || e."deviceId")
          FROM engagement_events e
        UNION ALL
        SELECT s."createdAt", CASE WHEN s.kind = 'question' THEN 'question' ELSE 'song_request' END,
               s."showOccurrenceId", NULL, s."listenerId"::text
          FROM song_requests s
      )
      SELECT ev."at", ev."interactionType", ev."showId", o."airDate" AS "showDate", o."programmeId",
             p.name AS "programmeName",
             COALESCE(
               (SELECT array_agg(h."rjId" ORDER BY h."rjId") FROM show_occurrence_hosts h WHERE h."occurrenceId" = o.id),
               CASE WHEN ev."legacyRjId" IS NOT NULL THEN ARRAY[ev."legacyRjId"] END
             ) AS "rjIds",
             o."stationId", st.name AS "stationName", ev."listenerKey"
        FROM events ev
        LEFT JOIN show_occurrences o ON o.id = ev."showId"
        LEFT JOIN programmes p ON p.id = o."programmeId"
        LEFT JOIN stations st ON st.id = o."stationId"
    `);
  }
}
