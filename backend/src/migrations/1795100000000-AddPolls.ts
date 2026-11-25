import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Polls on a show: the host RJ or the station asks a question with 2-5
 * options. Listeners vote once, signed in or from their phone (device id).
 */
export class AddPolls1795100000000 implements MigrationInterface {
  name = 'AddPolls1795100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "polls" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "showOccurrenceId" uuid NOT NULL REFERENCES "show_occurrences"("id") ON DELETE CASCADE,
        "question" varchar(120) NOT NULL,
        "createdByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAs" varchar(10) NOT NULL,
        "closedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_polls" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_polls_created_as" CHECK ("createdAs" IN ('rj', 'station'))
      )`);
    await q.query(`CREATE INDEX "IDX_polls_show" ON "polls" ("showOccurrenceId")`);
    // One open poll per show at a time.
    await q.query(`CREATE UNIQUE INDEX "UQ_polls_one_open" ON "polls" ("showOccurrenceId") WHERE "closedAt" IS NULL`);
    await q.query(`
      CREATE TABLE "poll_options" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL REFERENCES "polls"("id") ON DELETE CASCADE,
        "label" varchar(60) NOT NULL,
        "position" smallint NOT NULL,
        CONSTRAINT "PK_poll_options" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_poll_options_position" UNIQUE ("pollId", "position")
      )`);
    await q.query(`
      CREATE TABLE "poll_votes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pollId" uuid NOT NULL REFERENCES "polls"("id") ON DELETE CASCADE,
        "optionId" uuid NOT NULL REFERENCES "poll_options"("id") ON DELETE CASCADE,
        "listenerId" uuid REFERENCES "listeners"("id") ON DELETE CASCADE,
        "deviceId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_poll_votes" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_poll_votes_listener_or_device" CHECK (num_nonnulls("listenerId", "deviceId") = 1)
      )`);
    await q.query(`CREATE UNIQUE INDEX "UQ_poll_votes_listener" ON "poll_votes" ("pollId", "listenerId") WHERE "listenerId" IS NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX "UQ_poll_votes_device" ON "poll_votes" ("pollId", "deviceId") WHERE "deviceId" IS NOT NULL`);
    await q.query(`CREATE INDEX "IDX_poll_votes_option" ON "poll_votes" ("optionId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "poll_votes"`);
    await q.query(`DROP TABLE "poll_options"`);
    await q.query(`DROP TABLE "polls"`);
  }
}
