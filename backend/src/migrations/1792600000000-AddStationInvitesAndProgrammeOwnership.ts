import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 2 of the NowRJ migration plan.
 *
 * - station_invites: an RJ invites a station that is not on NowRJ yet.
 * - programmes: stationId becomes optional (a programme can wait on an
 *   invite instead), and gains createdByRjId, stationInviteId and an
 *   owner that is exactly one of ownerRjId or ownerStationId.
 * - Deleting a station no longer silently deletes its programmes.
 * - programme_ownership_history: who owned each programme, and when.
 *   Revenue splits for a past date are read from this table.
 * - Backfill: existing programmes are owned by their station from
 *   their createdAt.
 */
export class AddStationInvitesAndProgrammeOwnership1792600000000
  implements MigrationInterface
{
  name = 'AddStationInvitesAndProgrammeOwnership1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- station invites -------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "station_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invitedByRjId" uuid NOT NULL,
        "stationName" varchar(150) NOT NULL,
        "city" varchar(100) NULL,
        "contactName" varchar(150) NULL,
        "contactPhone" varchar(20) NULL,
        "contactEmail" varchar(255) NULL,
        "token" varchar(64) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'sent',
        "stationId" uuid NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '12 months'),
        "respondedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_station_invites_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_station_invites_token" UNIQUE ("token"),

        CONSTRAINT "CHK_station_invites_status"
          CHECK ("status" IN ('sent', 'accepted', 'declined', 'expired', 'cancelled')),

        CONSTRAINT "CHK_station_invites_contact"
          CHECK ("contactPhone" IS NOT NULL OR "contactEmail" IS NOT NULL),

        CONSTRAINT "CHK_station_invites_accepted_has_station"
          CHECK ("status" <> 'accepted' OR "stationId" IS NOT NULL),

        CONSTRAINT "FK_station_invites_rj"
          FOREIGN KEY ("invitedByRjId") REFERENCES "rjs"("id") ON DELETE CASCADE,

        CONSTRAINT "FK_station_invites_station"
          FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_station_invites_invitedByRjId"
      ON "station_invites" ("invitedByRjId")
    `);

    // --- programmes: optional station, creator, invite, owner -------------
    await queryRunner.query(`
      ALTER TABLE "programmes"
      DROP CONSTRAINT "FK_programmes_station"
    `);

    await queryRunner.query(`
      ALTER TABLE "programmes"
      ALTER COLUMN "stationId" DROP NOT NULL,
      ADD COLUMN "createdByRjId" uuid NULL,
      ADD COLUMN "stationInviteId" uuid NULL,
      ADD COLUMN "ownerRjId" uuid NULL,
      ADD COLUMN "ownerStationId" uuid NULL
    `);

    // Backfill before the owner rule is switched on.
    await queryRunner.query(`
      UPDATE "programmes" SET "ownerStationId" = "stationId"
    `);

    await queryRunner.query(`
      ALTER TABLE "programmes"
      ADD CONSTRAINT "FK_programmes_station"
        FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE RESTRICT,
      ADD CONSTRAINT "FK_programmes_created_by_rj"
        FOREIGN KEY ("createdByRjId") REFERENCES "rjs"("id") ON DELETE SET NULL,
      ADD CONSTRAINT "FK_programmes_station_invite"
        FOREIGN KEY ("stationInviteId") REFERENCES "station_invites"("id") ON DELETE SET NULL,
      ADD CONSTRAINT "FK_programmes_owner_rj"
        FOREIGN KEY ("ownerRjId") REFERENCES "rjs"("id") ON DELETE RESTRICT,
      ADD CONSTRAINT "FK_programmes_owner_station"
        FOREIGN KEY ("ownerStationId") REFERENCES "stations"("id") ON DELETE RESTRICT,
      ADD CONSTRAINT "CHK_programmes_one_owner"
        CHECK (("ownerRjId" IS NULL) <> ("ownerStationId" IS NULL)),
      ADD CONSTRAINT "CHK_programmes_station_or_invite"
        CHECK ("stationId" IS NOT NULL OR "stationInviteId" IS NOT NULL)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_programmes_ownerRjId" ON "programmes" ("ownerRjId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_programmes_ownerStationId" ON "programmes" ("ownerStationId")
    `);

    // --- ownership history -----------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "programme_ownership_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "programmeId" uuid NOT NULL,
        "ownerRjId" uuid NULL,
        "ownerStationId" uuid NULL,
        "validFrom" TIMESTAMPTZ NOT NULL,
        "validTo" TIMESTAMPTZ NULL,
        "reason" varchar(30) NOT NULL,
        "changedByListenerId" uuid NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_programme_ownership_history_id" PRIMARY KEY ("id"),

        CONSTRAINT "CHK_programme_ownership_one_owner"
          CHECK (("ownerRjId" IS NULL) <> ("ownerStationId" IS NULL)),

        CONSTRAINT "CHK_programme_ownership_dates"
          CHECK ("validTo" IS NULL OR "validTo" >= "validFrom"),

        CONSTRAINT "CHK_programme_ownership_reason"
          CHECK ("reason" IN ('created', 'station_claim', 'admin_transfer', 'backfill')),

        CONSTRAINT "FK_programme_ownership_programme"
          FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE,

        CONSTRAINT "FK_programme_ownership_rj"
          FOREIGN KEY ("ownerRjId") REFERENCES "rjs"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_programme_ownership_station"
          FOREIGN KEY ("ownerStationId") REFERENCES "stations"("id") ON DELETE RESTRICT,

        CONSTRAINT "FK_programme_ownership_changed_by"
          FOREIGN KEY ("changedByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_programme_ownership_programmeId"
      ON "programme_ownership_history" ("programmeId")
    `);

    // A programme has exactly one current owner row.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_programme_ownership_one_current"
      ON "programme_ownership_history" ("programmeId")
      WHERE "validTo" IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO "programme_ownership_history"
        ("programmeId", "ownerStationId", "validFrom", "reason")
      SELECT "id", "ownerStationId", "createdAt", 'backfill'
      FROM "programmes"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Going back requires every programme to have a station again.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM "programmes" WHERE "stationId" IS NULL) THEN
          RAISE EXCEPTION 'Cannot revert: some programmes have no station yet. Assign or delete them first.';
        END IF;
      END $$;
    `);

    await queryRunner.query(`DROP TABLE "programme_ownership_history"`);

    await queryRunner.query(`
      ALTER TABLE "programmes"
      DROP CONSTRAINT "CHK_programmes_station_or_invite",
      DROP CONSTRAINT "CHK_programmes_one_owner",
      DROP CONSTRAINT "FK_programmes_owner_station",
      DROP CONSTRAINT "FK_programmes_owner_rj",
      DROP CONSTRAINT "FK_programmes_station_invite",
      DROP CONSTRAINT "FK_programmes_created_by_rj",
      DROP CONSTRAINT "FK_programmes_station"
    `);

    await queryRunner.query(`DROP INDEX "IDX_programmes_ownerStationId"`);
    await queryRunner.query(`DROP INDEX "IDX_programmes_ownerRjId"`);

    await queryRunner.query(`
      ALTER TABLE "programmes"
      DROP COLUMN "ownerStationId",
      DROP COLUMN "ownerRjId",
      DROP COLUMN "stationInviteId",
      DROP COLUMN "createdByRjId",
      ALTER COLUMN "stationId" SET NOT NULL,
      ADD CONSTRAINT "FK_programmes_station"
        FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`DROP TABLE "station_invites"`);
  }
}
