import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Super Admin can hide a whole network, a region or a single station from
 * listeners. Staff keep their access so they can keep working.
 *
 * hidden_stations lists every station listeners must not see: the station
 * is inactive, its organisation is hidden, or it or any region above it is
 * hidden. Public lists leave out programmes airing on or owned by these.
 */
export class HideFromListeners1794100000000 implements MigrationInterface {
  name = 'HideFromListeners1794100000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "organisations" ADD "hiddenAt" timestamptz`);
    await q.query(`ALTER TABLE "org_units" ADD "hiddenAt" timestamptz`);
    await q.query(`
      CREATE VIEW "hidden_stations" AS
      WITH RECURSIVE "above" AS (
        SELECT u."stationId", u."id" AS "unitId", u."parentId", u."hiddenAt", 0 AS "depth"
          FROM "org_units" u WHERE u."kind" = 'station'
        UNION ALL
        SELECT a."stationId", p."id", p."parentId", p."hiddenAt", a."depth" + 1
          FROM "above" a JOIN "org_units" p ON p."id" = a."parentId"
         WHERE a."depth" < 20
      )
      SELECT s."id"
        FROM "stations" s
        LEFT JOIN "organisations" o ON o."id" = s."organisationId"
       WHERE NOT s."isActive"
          OR o."hiddenAt" IS NOT NULL
          OR EXISTS (SELECT 1 FROM "above" a WHERE a."stationId" = s."id" AND a."hiddenAt" IS NOT NULL)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP VIEW "hidden_stations"`);
    await q.query(`ALTER TABLE "org_units" DROP COLUMN "hiddenAt"`);
    await q.query(`ALTER TABLE "organisations" DROP COLUMN "hiddenAt"`);
  }
}
