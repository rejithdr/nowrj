import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Repeated recordings: one recording (e.g. "Talk with Rafi" with a food
 * doctor) played in several show slots, on one or more stations. Each slot
 * is an airing. The first airing is the premiere; later ones are repeats,
 * where nobody is live, so listener requests are off.
 *
 * recording_shares: stations the owner offered the recording to. They add
 * it to their own shows.
 */
export class AddRecordings1795300000000 implements MigrationInterface {
  name = 'AddRecordings1795300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "recordings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ownerStationId" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
        "title" varchar(120) NOT NULL,
        "guestName" varchar(120),
        "description" varchar(500),
        "createdByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recordings" PRIMARY KEY ("id")
      )`);
    await q.query(`
      CREATE TABLE "recording_airings" (
        "recordingId" uuid NOT NULL REFERENCES "recordings"("id") ON DELETE CASCADE,
        "showOccurrenceId" uuid NOT NULL REFERENCES "show_occurrences"("id") ON DELETE CASCADE,
        "stationId" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
        "addedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recording_airings" PRIMARY KEY ("showOccurrenceId")
      )`);
    await q.query(`CREATE INDEX "IDX_recording_airings_recording" ON "recording_airings" ("recordingId")`);
    await q.query(`
      CREATE TABLE "recording_shares" (
        "recordingId" uuid NOT NULL REFERENCES "recordings"("id") ON DELETE CASCADE,
        "stationId" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
        "offeredByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recording_shares" PRIMARY KEY ("recordingId", "stationId")
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "recording_shares"`);
    await q.query(`DROP TABLE "recording_airings"`);
    await q.query(`DROP TABLE "recordings"`);
  }
}
