import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Listener messages to a show (song_requests):
 * - Two more kinds: 'dedication' (for someone, with a short message, an
 *   optional song) and 'message' (a note to the RJ).
 * - On-air consent chosen when sending: which name may be read out
 *   (nameOnAir) and whether it may be read on air at all (okOnAir; null for
 *   messages sent before this was asked).
 * - seenAt / seenBy: when the host RJ or the station first saw it.
 */
export class MessagesAndOnAirConsent1794900000000 implements MigrationInterface {
  name = 'MessagesAndOnAirConsent1794900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "song_requests"
        ADD COLUMN "dedicatedTo" varchar(60),
        ADD COLUMN "nameOnAir" varchar(10) NOT NULL DEFAULT 'display',
        ADD COLUMN "okOnAir" boolean,
        ADD COLUMN "seenAt" TIMESTAMP WITH TIME ZONE,
        ADD COLUMN "seenBy" varchar(10),
        DROP CONSTRAINT "CHK_song_requests_kind",
        ADD CONSTRAINT "CHK_song_requests_kind" CHECK (
          ("kind" = 'song' AND "songTitle" IS NOT NULL AND length(trim("songTitle")) > 0)
          OR ("kind" = 'question' AND "songTitle" IS NULL AND "message" IS NOT NULL AND length(trim("message")) > 0)
          OR ("kind" = 'dedication' AND "dedicatedTo" IS NOT NULL AND "message" IS NOT NULL AND length(trim("message")) > 0)
          OR ("kind" = 'message' AND "songTitle" IS NULL AND "message" IS NOT NULL AND length(trim("message")) > 0)
        ),
        ADD CONSTRAINT "CHK_song_requests_name_on_air" CHECK ("nameOnAir" IN ('display', 'first', 'none')),
        ADD CONSTRAINT "CHK_song_requests_seen_by" CHECK ("seenBy" IS NULL OR "seenBy" IN ('rj', 'station'))
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "song_requests" WHERE "kind" IN ('dedication', 'message')`);
    await q.query(`
      ALTER TABLE "song_requests"
        DROP CONSTRAINT "CHK_song_requests_seen_by",
        DROP CONSTRAINT "CHK_song_requests_name_on_air",
        DROP CONSTRAINT "CHK_song_requests_kind",
        ADD CONSTRAINT "CHK_song_requests_kind" CHECK (
          ("kind" = 'song' AND "songTitle" IS NOT NULL AND length(trim("songTitle")) > 0)
          OR ("kind" = 'question' AND "songTitle" IS NULL AND "message" IS NOT NULL AND length(trim("message")) > 0)
        ),
        DROP COLUMN "seenBy",
        DROP COLUMN "seenAt",
        DROP COLUMN "okOnAir",
        DROP COLUMN "nameOnAir",
        DROP COLUMN "dedicatedTo"
    `);
  }
}
