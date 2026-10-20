import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Show occurrences (migration 4 in the plan, after schedules).
 *
 * - show_occurrences: one row per programme per airing, generated from
 *   programme_schedules. It snapshots the station and owner, so a show
 *   keeps the owner it aired under even if the programme changes hands.
 * - show_occurrence_hosts: the RJs hosting that particular show.
 * - reactions can now target a show occurrence. Every reaction still has
 *   exactly one target: an RJ, a programme, or a show.
 */
export class AddShowOccurrences1792800000000 implements MigrationInterface {
  name = 'AddShowOccurrences1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "show_occurrences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "programmeId" uuid NOT NULL,
        "scheduleId" uuid NULL,
        "airDate" date NOT NULL,
        "startsAt" TIMESTAMPTZ NOT NULL,
        "endsAt" TIMESTAMPTZ NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'scheduled',
        "stationId" uuid NULL,
        "ownerRjId" uuid NULL,
        "ownerStationId" uuid NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_show_occurrences_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_show_occurrences_programme_start" UNIQUE ("programmeId", "startsAt"),

        CONSTRAINT "CHK_show_occurrences_times" CHECK ("endsAt" > "startsAt"),
        CONSTRAINT "CHK_show_occurrences_status" CHECK ("status" IN ('scheduled', 'cancelled')),
        CONSTRAINT "CHK_show_occurrences_one_owner"
          CHECK (("ownerRjId" IS NULL) <> ("ownerStationId" IS NULL)),

        CONSTRAINT "FK_show_occurrences_programme"
          FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_show_occurrences_schedule"
          FOREIGN KEY ("scheduleId") REFERENCES "programme_schedules"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_show_occurrences_station"
          FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_show_occurrences_owner_rj"
          FOREIGN KEY ("ownerRjId") REFERENCES "rjs"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_show_occurrences_owner_station"
          FOREIGN KEY ("ownerStationId") REFERENCES "stations"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_show_occurrences_startsAt" ON "show_occurrences" ("startsAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_show_occurrences_endsAt" ON "show_occurrences" ("endsAt")
    `);

    await queryRunner.query(`
      CREATE TABLE "show_occurrence_hosts" (
        "occurrenceId" uuid NOT NULL,
        "rjId" uuid NOT NULL,

        CONSTRAINT "PK_show_occurrence_hosts" PRIMARY KEY ("occurrenceId", "rjId"),
        CONSTRAINT "FK_show_occurrence_hosts_occurrence"
          FOREIGN KEY ("occurrenceId") REFERENCES "show_occurrences"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_show_occurrence_hosts_rj"
          FOREIGN KEY ("rjId") REFERENCES "rjs"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_show_occurrence_hosts_rjId" ON "show_occurrence_hosts" ("rjId")
    `);

    // Reactions on a specific show.
    await queryRunner.query(`
      ALTER TABLE "reactions"
      ADD COLUMN "showOccurrenceId" uuid NULL,
      ADD CONSTRAINT "FK_reactions_show_occurrence"
        FOREIGN KEY ("showOccurrenceId") REFERENCES "show_occurrences"("id") ON DELETE CASCADE,
      DROP CONSTRAINT "CHK_reactions_one_target",
      ADD CONSTRAINT "CHK_reactions_one_target"
        CHECK (num_nonnulls("rjId", "programmeId", "showOccurrenceId") = 1)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_reactions_listener_show_type"
      ON "reactions" ("listenerId", "showOccurrenceId", "type")
      WHERE "showOccurrenceId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_reactions_listener_show_type"`);
    await queryRunner.query(`DELETE FROM "reactions" WHERE "showOccurrenceId" IS NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "reactions"
      DROP CONSTRAINT "CHK_reactions_one_target",
      DROP CONSTRAINT "FK_reactions_show_occurrence",
      DROP COLUMN "showOccurrenceId",
      ADD CONSTRAINT "CHK_reactions_one_target"
        CHECK (
          ("rjId" IS NOT NULL AND "programmeId" IS NULL)
          OR ("rjId" IS NULL AND "programmeId" IS NOT NULL)
        )
    `);
    await queryRunner.query(`DROP TABLE "show_occurrence_hosts"`);
    await queryRunner.query(`DROP TABLE "show_occurrences"`);
  }
}
