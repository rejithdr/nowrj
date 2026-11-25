import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Listener reports about a programme, RJ or ad (wrong, offensive, spam).
 * Anyone can report, signed in or from their phone; the Super Admin
 * dismisses a report or hides what was reported.
 */
export class AddReports1795400000000 implements MigrationInterface {
  name = 'AddReports1795400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "targetType" varchar(12) NOT NULL,
        "targetId" uuid NOT NULL,
        "showOccurrenceId" uuid REFERENCES "show_occurrences"("id") ON DELETE SET NULL,
        "reason" varchar(20) NOT NULL,
        "details" varchar(300),
        "reporter" uuid NOT NULL,
        "listenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "deviceId" uuid,
        "status" varchar(12) NOT NULL DEFAULT 'open',
        "handledByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "handledAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reports" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_reports_target" CHECK ("targetType" IN ('programme', 'rj', 'ad')),
        CONSTRAINT "CHK_reports_reason" CHECK ("reason" IN ('wrong_info', 'offensive', 'spam', 'unsafe', 'other')),
        CONSTRAINT "CHK_reports_status" CHECK ("status" IN ('open', 'dismissed', 'hidden'))
      )`);
    // One open report per person per thing.
    await q.query(`CREATE UNIQUE INDEX "UQ_reports_open_once" ON "reports" ("targetType", "targetId", "reporter") WHERE "status" = 'open'`);
    await q.query(`CREATE INDEX "IDX_reports_status" ON "reports" ("status", "createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "reports"`);
  }
}
