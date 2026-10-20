import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Programme schedules (the schedule part of migration 4 in the plan).
 *
 * A programme has one or more time slots. Each slot airs on a set of
 * weekdays (1 = Monday ... 7 = Sunday) between startTime and endTime.
 * An endTime earlier than startTime means the slot runs past midnight.
 * validFrom / validTo keep past schedules, so earlier shows keep the
 * schedule they actually aired on. validTo is the last day it applied.
 *
 * Backfill: programmes that already have start and end times get one
 * every-day slot from their createdAt date.
 */
export class AddProgrammeSchedules1792700000000 implements MigrationInterface {
  name = 'AddProgrammeSchedules1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "programme_schedules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "programmeId" uuid NOT NULL,
        "daysOfWeek" smallint[] NOT NULL,
        "startTime" TIME NOT NULL,
        "endTime" TIME NOT NULL,
        "validFrom" date NOT NULL DEFAULT CURRENT_DATE,
        "validTo" date NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_programme_schedules_id" PRIMARY KEY ("id"),

        CONSTRAINT "CHK_programme_schedules_days"
          CHECK (
            cardinality("daysOfWeek") BETWEEN 1 AND 7
            AND "daysOfWeek" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]
          ),

        CONSTRAINT "CHK_programme_schedules_times"
          CHECK ("startTime" <> "endTime"),

        CONSTRAINT "CHK_programme_schedules_dates"
          CHECK ("validTo" IS NULL OR "validTo" >= "validFrom"),

        CONSTRAINT "FK_programme_schedules_programme"
          FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_programme_schedules_programmeId"
      ON "programme_schedules" ("programmeId")
    `);

    await queryRunner.query(`
      INSERT INTO "programme_schedules"
        ("programmeId", "daysOfWeek", "startTime", "endTime", "validFrom")
      SELECT
        "id",
        ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[],
        "startTime",
        "endTime",
        "createdAt"::date
      FROM "programmes"
      WHERE "startTime" IS NOT NULL
        AND "endTime" IS NOT NULL
        AND "startTime" <> "endTime"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "programme_schedules"`);
  }
}
