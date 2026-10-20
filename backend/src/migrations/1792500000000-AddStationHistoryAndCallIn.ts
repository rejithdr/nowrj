import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 1 of the NowRJ migration plan.
 *
 * - rj_station_affiliations: an RJ's station history, like a CV
 *   (joinedOn / leftOn). One current station per RJ for the MVP.
 * - Backfills each RJ's current rjs.stationId as an affiliation that
 *   starts on the RJ's createdAt date. rjs.stationId is kept for now.
 * - programmes.callInPhone: the live-show call-in number per programme.
 * - stations.reach and stations.cityType: inputs for the ad rate card.
 */
export class AddStationHistoryAndCallIn1792500000000
  implements MigrationInterface
{
  name = 'AddStationHistoryAndCallIn1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rj_station_affiliations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rjId" uuid NOT NULL,
        "stationId" uuid NOT NULL,
        "joinedOn" date NOT NULL,
        "leftOn" date NULL,
        "verificationStatus" varchar(20) NOT NULL DEFAULT 'pending',
        "verifiedByListenerId" uuid NULL,
        "verifiedAt" TIMESTAMP NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_rj_station_affiliations_id" PRIMARY KEY ("id"),

        CONSTRAINT "CHK_rj_station_affiliations_dates"
          CHECK ("leftOn" IS NULL OR "leftOn" >= "joinedOn"),

        CONSTRAINT "CHK_rj_station_affiliations_status"
          CHECK ("verificationStatus" IN ('pending', 'verified', 'rejected', 'disputed')),

        CONSTRAINT "FK_rj_station_affiliations_rj"
          FOREIGN KEY ("rjId") REFERENCES "rjs"("id") ON DELETE CASCADE,

        CONSTRAINT "FK_rj_station_affiliations_station"
          FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_rj_station_affiliations_verifier"
          FOREIGN KEY ("verifiedByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_rj_station_affiliations_rjId"
      ON "rj_station_affiliations" ("rjId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_rj_station_affiliations_stationId"
      ON "rj_station_affiliations" ("stationId")
    `);

    // MVP rule: an RJ has at most one current station.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_rj_station_affiliations_one_current"
      ON "rj_station_affiliations" ("rjId")
      WHERE "leftOn" IS NULL
    `);

    // Backfill: every RJ's current station becomes an open affiliation.
    await queryRunner.query(`
      INSERT INTO "rj_station_affiliations"
        ("rjId", "stationId", "joinedOn", "verificationStatus")
      SELECT
        "id",
        "stationId",
        "createdAt"::date,
        CASE
          WHEN "verificationStatus" IN ('verified', 'legacy') THEN 'verified'
          ELSE 'pending'
        END
      FROM "rjs"
      WHERE "stationId" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "programmes"
      ADD COLUMN "callInPhone" varchar(20) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stations"
      ADD COLUMN "reach" varchar(20) NULL,
      ADD COLUMN "cityType" varchar(30) NULL,
      ADD CONSTRAINT "CHK_stations_reach"
        CHECK ("reach" IS NULL OR "reach" IN ('national', 'local'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stations"
      DROP CONSTRAINT "CHK_stations_reach",
      DROP COLUMN "cityType",
      DROP COLUMN "reach"
    `);

    await queryRunner.query(`
      ALTER TABLE "programmes"
      DROP COLUMN "callInPhone"
    `);

    await queryRunner.query(`DROP TABLE "rj_station_affiliations"`);
  }
}
