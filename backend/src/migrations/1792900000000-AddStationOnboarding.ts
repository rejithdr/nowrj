import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Station onboarding and programme claims (migrations 3 and 6 of the plan).
 *
 * - stations: verificationStatus (existing stations become 'legacy'),
 *   who created it, and a private contact phone and email.
 * - user_roles: who represents which station (and room for other roles).
 *   A station representative starts 'pending' until a Super Admin approves.
 * - programme_claims: a station asks to take over an RJ-owned programme.
 *   The RJ approves or rejects; a rejected claim goes to the Super Admin.
 * - programme_ownership_history.claimId links an ownership change to its claim.
 * - audit_log: a record of every approval, rejection and ownership change.
 */
export class AddStationOnboarding1792900000000 implements MigrationInterface {
  name = 'AddStationOnboarding1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stations"
      ADD COLUMN "verificationStatus" varchar(20) NOT NULL DEFAULT 'pending',
      ADD COLUMN "createdByListenerId" uuid NULL,
      ADD COLUMN "contactPhone" varchar(20) NULL,
      ADD COLUMN "contactEmail" varchar(255) NULL,
      ADD CONSTRAINT "CHK_stations_verification"
        CHECK ("verificationStatus" IN ('pending', 'verified', 'rejected', 'legacy')),
      ADD CONSTRAINT "FK_stations_created_by"
        FOREIGN KEY ("createdByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`UPDATE "stations" SET "verificationStatus" = 'legacy'`);

    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listenerId" uuid NOT NULL,
        "role" varchar(30) NOT NULL,
        "stationId" uuid NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "grantedByListenerId" uuid NULL,
        "grantedAt" TIMESTAMPTZ NULL,
        "note" varchar(500) NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_user_roles_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_user_roles_role" CHECK ("role" IN ('superadmin', 'station_rep')),
        CONSTRAINT "CHK_user_roles_status" CHECK ("status" IN ('pending', 'active', 'revoked')),
        CONSTRAINT "CHK_user_roles_station_rep_has_station"
          CHECK ("role" <> 'station_rep' OR "stationId" IS NOT NULL),
        CONSTRAINT "FK_user_roles_listener"
          FOREIGN KEY ("listenerId") REFERENCES "listeners"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_station"
          FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_roles_granted_by"
          FOREIGN KEY ("grantedByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_user_roles_open"
      ON "user_roles" ("listenerId", "role", COALESCE("stationId", '00000000-0000-0000-0000-000000000000'::uuid))
      WHERE "status" <> 'revoked'
    `);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_stationId" ON "user_roles" ("stationId")`);

    await queryRunner.query(`
      CREATE TABLE "programme_claims" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "programmeId" uuid NOT NULL,
        "stationId" uuid NOT NULL,
        "requestedByListenerId" uuid NULL,
        "status" varchar(30) NOT NULL DEFAULT 'awaiting_rj',
        "rjDecisionAt" TIMESTAMPTZ NULL,
        "rjDecisionByListenerId" uuid NULL,
        "rjReason" varchar(500) NULL,
        "adminDecisionAt" TIMESTAMPTZ NULL,
        "adminDecisionByListenerId" uuid NULL,
        "adminReason" varchar(500) NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_programme_claims_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_programme_claims_status" CHECK ("status" IN (
          'awaiting_rj', 'approved_by_rj', 'rejected_by_rj',
          'approved_by_admin', 'rejected_by_admin', 'cancelled'
        )),
        CONSTRAINT "FK_programme_claims_programme"
          FOREIGN KEY ("programmeId") REFERENCES "programmes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_programme_claims_station"
          FOREIGN KEY ("stationId") REFERENCES "stations"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_programme_claims_requested_by"
          FOREIGN KEY ("requestedByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_programme_claims_rj_decision_by"
          FOREIGN KEY ("rjDecisionByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_programme_claims_admin_decision_by"
          FOREIGN KEY ("adminDecisionByListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL
      )
    `);
    // Only one claim per programme can be in progress at a time.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_programme_claims_one_open"
      ON "programme_claims" ("programmeId")
      WHERE "status" IN ('awaiting_rj', 'rejected_by_rj')
    `);

    await queryRunner.query(`
      ALTER TABLE "programme_ownership_history"
      ADD COLUMN "claimId" uuid NULL,
      ADD CONSTRAINT "FK_programme_ownership_claim"
        FOREIGN KEY ("claimId") REFERENCES "programme_claims"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actorListenerId" uuid NULL,
        "action" varchar(60) NOT NULL,
        "entityType" varchar(40) NOT NULL,
        "entityId" uuid NULL,
        "details" jsonb NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_audit_log_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_log_actor"
          FOREIGN KEY ("actorListenerId") REFERENCES "listeners"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_entity" ON "audit_log" ("entityType", "entityId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_createdAt" ON "audit_log" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_log"`);
    await queryRunner.query(`
      ALTER TABLE "programme_ownership_history"
      DROP CONSTRAINT "FK_programme_ownership_claim",
      DROP COLUMN "claimId"
    `);
    await queryRunner.query(`DROP TABLE "programme_claims"`);
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`
      ALTER TABLE "stations"
      DROP CONSTRAINT "FK_stations_created_by",
      DROP CONSTRAINT "CHK_stations_verification",
      DROP COLUMN "contactEmail",
      DROP COLUMN "contactPhone",
      DROP COLUMN "createdByListenerId",
      DROP COLUMN "verificationStatus"
    `);
  }
}
