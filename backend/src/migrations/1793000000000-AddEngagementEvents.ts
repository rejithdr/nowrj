import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * engagement_events: listener actions that are not reactions, starting with
 * taps on a show's Call button. A tap records intent only; it does not mean
 * the call connected. Visitors need not be signed in, so a tap carries the
 * listener when known and otherwise an anonymous device id.
 */
export class AddEngagementEvents1793000000000 implements MigrationInterface {
  name = 'AddEngagementEvents1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "engagement_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" varchar(30) NOT NULL,
        "programmeId" uuid NOT NULL,
        "showOccurrenceId" uuid NULL,
        "listenerId" uuid NULL,
        "deviceId" varchar(64) NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_engagement_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_engagement_events_type" CHECK ("type" IN ('call_tap')),
        CONSTRAINT "CHK_engagement_events_who" CHECK ("listenerId" IS NOT NULL OR "deviceId" IS NOT NULL),
        CONSTRAINT "FK_engagement_events_programme"
          FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_engagement_events_show"
          FOREIGN KEY ("showOccurrenceId") REFERENCES "show_occurrences"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_engagement_events_listener"
          FOREIGN KEY ("listenerId") REFERENCES "listeners"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_engagement_events_show" ON "engagement_events" ("showOccurrenceId")`);
    await queryRunner.query(`CREATE INDEX "IDX_engagement_events_programme_time" ON "engagement_events" ("programmeId", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "engagement_events"`);
  }
}
