import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Organisation access (release 2a).
 *
 * - organisations: a radio network (head office, regions, stations) or a
 *   single standalone station
 * - org_units: regions and stations inside an organisation. A unit with no
 *   parent sits directly under the head office. Staff placed at the head
 *   office have no unit.
 * - designations: names an organisation gives its staff, each with a level
 *   for every area. Levels are cumulative: authorise > edit > view > none.
 * - org_members: who works where, with which designation
 * - org_invites: a link for one email address to join as staff
 * - stations.organisationId: the organisation a station belongs to
 *
 * Every existing station becomes a standalone organisation. Its approved
 * representatives become head-office members (in a standalone organisation
 * that is the station itself) with the "Station admin" designation
 * (Authorise on every area, Stats view, can manage staff), so nothing they
 * can do today changes. user_roles stays: it still holds applications.
 */
export class AddOrganisations1793900000000 implements MigrationInterface {
  name = 'AddOrganisations1793900000000';

  public async up(q: QueryRunner): Promise<void> {
    const level = (col: string) =>
      `"${col}" varchar(10) NOT NULL DEFAULT 'none' CHECK ("${col}" IN ('none','view','edit','authorise'))`;

    await q.query(`
      CREATE TABLE "organisations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(150) NOT NULL,
        "kind" varchar(20) NOT NULL CHECK ("kind" IN ('network','standalone')),
        "designationChangesNeedApproval" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organisations" PRIMARY KEY ("id")
      )`);

    await q.query(`
      CREATE TABLE "org_units" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organisationId" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "parentId" uuid REFERENCES "org_units"("id") ON DELETE RESTRICT,
        "kind" varchar(20) NOT NULL CHECK ("kind" IN ('region','station')),
        "name" varchar(150) NOT NULL,
        "stationId" uuid UNIQUE REFERENCES "stations"("id") ON DELETE CASCADE,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_units" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_org_units_station" CHECK (("kind" = 'station') = ("stationId" IS NOT NULL))
      )`);
    await q.query(`CREATE INDEX "IDX_org_units_org" ON "org_units" ("organisationId")`);
    await q.query(`CREATE INDEX "IDX_org_units_parent" ON "org_units" ("parentId")`);

    await q.query(`
      CREATE TABLE "designations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organisationId" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "name" varchar(80) NOT NULL,
        ${level('programmes')},
        ${level('rjs')},
        ${level('adsSponsored')},
        ${level('adsShoutout')},
        ${level('adsAired')},
        "stats" varchar(10) NOT NULL DEFAULT 'none' CHECK ("stats" IN ('none','view')),
        "manageStaff" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_designations" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX "UQ_designations_name" ON "designations" ("organisationId", lower("name"))`);

    await q.query(`
      CREATE TABLE "org_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organisationId" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "listenerId" uuid NOT NULL REFERENCES "listeners"("id") ON DELETE CASCADE,
        "unitId" uuid REFERENCES "org_units"("id") ON DELETE RESTRICT,
        "designationId" uuid NOT NULL REFERENCES "designations"("id") ON DELETE RESTRICT,
        "status" varchar(20) NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','removed')),
        "addedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "removedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_members" PRIMARY KEY ("id")
      )`);
    await q.query(
      `CREATE UNIQUE INDEX "UQ_org_members_active" ON "org_members" ("organisationId", "listenerId") WHERE "status" = 'active'`,
    );
    await q.query(`CREATE INDEX "IDX_org_members_listener" ON "org_members" ("listenerId")`);

    await q.query(`
      CREATE TABLE "org_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organisationId" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "unitId" uuid REFERENCES "org_units"("id") ON DELETE CASCADE,
        "designationId" uuid NOT NULL REFERENCES "designations"("id") ON DELETE CASCADE,
        "email" varchar(255) NOT NULL,
        "token" varchar(64) NOT NULL UNIQUE,
        "status" varchar(20) NOT NULL DEFAULT 'sent' CHECK ("status" IN ('sent','accepted','cancelled')),
        "invitedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "acceptedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "acceptedAt" timestamptz,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_invites" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_org_invites_org" ON "org_invites" ("organisationId")`);

    await q.query(`ALTER TABLE "stations" ADD "organisationId" uuid REFERENCES "organisations"("id") ON DELETE SET NULL`);

    // The one place access is worked out: for each person and station, the
    // designation that applies. A member covers a station when they sit at the
    // head office (no unit), at the station itself, or at a region above it.
    await q.query(`
      CREATE VIEW "station_access" AS
      WITH RECURSIVE "above" AS (
        SELECT u."stationId", u."id" AS "unitId", u."parentId", 0 AS "depth"
          FROM "org_units" u WHERE u."kind" = 'station'
        UNION ALL
        SELECT a."stationId", p."id", p."parentId", a."depth" + 1
          FROM "above" a JOIN "org_units" p ON p."id" = a."parentId"
         WHERE a."depth" < 20
      )
      SELECT m."listenerId", s."id" AS "stationId", m."organisationId", m."id" AS "memberId", m."unitId",
             d."id" AS "designationId", d."name" AS "designationName",
             d."programmes", d."rjs", d."adsSponsored", d."adsShoutout", d."adsAired", d."stats", d."manageStaff"
        FROM "stations" s
        JOIN "organisations" o ON o."id" = s."organisationId" AND o."isActive"
        JOIN "org_members" m ON m."organisationId" = o."id" AND m."status" = 'active'
        JOIN "designations" d ON d."id" = m."designationId"
       WHERE m."unitId" IS NULL
          OR m."unitId" IN (SELECT a."unitId" FROM "above" a WHERE a."stationId" = s."id")`);

    // Every station becomes a standalone organisation with one station unit
    // and a "Station admin" designation.
    await q.query(`ALTER TABLE "organisations" ADD "seedStationId" uuid`);
    await q.query(`
      INSERT INTO "organisations" ("name", "kind", "isActive", "createdAt", "seedStationId")
      SELECT s."name", 'standalone', true, s."createdAt", s."id" FROM "stations" s`);
    await q.query(`UPDATE "stations" s SET "organisationId" = o."id" FROM "organisations" o WHERE o."seedStationId" = s."id"`);
    await q.query(`
      INSERT INTO "org_units" ("organisationId", "kind", "name", "stationId")
      SELECT o."id", 'station', s."name", s."id" FROM "organisations" o JOIN "stations" s ON s."id" = o."seedStationId"`);
    await q.query(`
      INSERT INTO "designations" ("organisationId", "name", "programmes", "rjs", "adsSponsored", "adsShoutout", "adsAired", "stats", "manageStaff")
      SELECT o."id", 'Station admin', 'authorise', 'authorise', 'authorise', 'authorise', 'authorise', 'view', true
        FROM "organisations" o`);
    await q.query(`
      INSERT INTO "org_members" ("organisationId", "listenerId", "unitId", "designationId", "status", "addedByListenerId", "createdAt")
      SELECT o."id", ur."listenerId", NULL, d."id", 'active', ur."grantedByListenerId", COALESCE(ur."grantedAt", ur."createdAt")
        FROM "user_roles" ur
        JOIN "organisations" o ON o."seedStationId" = ur."stationId"
        JOIN "designations" d ON d."organisationId" = o."id"
       WHERE ur."role" = 'station_rep' AND ur."status" = 'active'
       ON CONFLICT DO NOTHING`);
    await q.query(`ALTER TABLE "organisations" DROP COLUMN "seedStationId"`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP VIEW "station_access"`);
    await q.query(`ALTER TABLE "stations" DROP COLUMN "organisationId"`);
    await q.query(`DROP TABLE "org_invites"`);
    await q.query(`DROP TABLE "org_members"`);
    await q.query(`DROP TABLE "designations"`);
    await q.query(`DROP TABLE "org_units"`);
    await q.query(`DROP TABLE "organisations"`);
  }
}
