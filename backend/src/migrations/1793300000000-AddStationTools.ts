import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Station tools.
 *
 * - rj_station_affiliations.stationNote: why a station disputed an RJ's
 *   time there (or a note when confirming).
 * - programme_schedule_exceptions: one day's show cancelled or moved,
 *   without changing the weekly schedule.
 * - show_occurrences.originalStartsAt: when the show was scheduled to start,
 *   so a moved show is still recognised as the same show. Uniqueness moves
 *   from startsAt to originalStartsAt.
 */
export class AddStationTools1793300000000 implements MigrationInterface {
  name = 'AddStationTools1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rj_station_affiliations" ADD COLUMN "stationNote" varchar(280) NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "programme_schedule_exceptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "programmeId" uuid NOT NULL,
        "originalStartsAt" TIMESTAMPTZ NOT NULL,
        "action" varchar(10) NOT NULL,
        "newStartsAt" TIMESTAMPTZ NULL,
        "newEndsAt" TIMESTAMPTZ NULL,
        "reason" varchar(280) NULL,
        "createdByListenerId" uuid NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_programme_schedule_exceptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_programme_schedule_exceptions_show" UNIQUE ("programmeId", "originalStartsAt"),
        CONSTRAINT "CHK_programme_schedule_exceptions_action" CHECK ("action" IN ('cancel', 'move')),
        CONSTRAINT "CHK_programme_schedule_exceptions_move"
          CHECK ("action" <> 'move' OR ("newStartsAt" IS NOT NULL AND "newEndsAt" > "newStartsAt")),
        CONSTRAINT "FK_programme_schedule_exceptions_programme"
          FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_programme_schedule_exceptions_by"
          FOREIGN KEY ("createdByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`ALTER TABLE "show_occurrences" ADD COLUMN "originalStartsAt" TIMESTAMPTZ NULL`);
    await queryRunner.query(`UPDATE "show_occurrences" SET "originalStartsAt" = "startsAt"`);
    await queryRunner.query(`
      ALTER TABLE "show_occurrences"
      ALTER COLUMN "originalStartsAt" SET NOT NULL,
      DROP CONSTRAINT "UQ_show_occurrences_programme_start",
      ADD CONSTRAINT "UQ_show_occurrences_programme_original_start" UNIQUE ("programmeId", "originalStartsAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Moved shows go back to their original time so the old rule holds.
    await queryRunner.query(`
      UPDATE "show_occurrences"
      SET "endsAt" = "endsAt" + ("originalStartsAt" - "startsAt"), "startsAt" = "originalStartsAt"
      WHERE "startsAt" <> "originalStartsAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "show_occurrences"
      DROP CONSTRAINT "UQ_show_occurrences_programme_original_start",
      ADD CONSTRAINT "UQ_show_occurrences_programme_start" UNIQUE ("programmeId", "startsAt"),
      DROP COLUMN "originalStartsAt"
    `);
    await queryRunner.query(`DROP TABLE "programme_schedule_exceptions"`);
    await queryRunner.query(`ALTER TABLE "rj_station_affiliations" DROP COLUMN "stationNote"`);
  }
}
