import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Posts are ranked inside each organisation (1 = highest). Staff can change
 * or remove only people in a lower post, and an invite to a post above the
 * inviter's own waits for Super Admin ("awaiting_approval").
 *
 * Existing designations are ranked by name: head office first, then
 * regional, then station admin, then everything else alphabetically.
 * Head office can reorder them afterwards.
 */
export class DesignationRanks1794000000000 implements MigrationInterface {
  name = 'DesignationRanks1794000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "designations" ADD "rank" integer NOT NULL DEFAULT 1000`);
    await q.query(`
      UPDATE "designations" d SET "rank" = r.n
        FROM (
          SELECT id, row_number() OVER (
                   PARTITION BY "organisationId"
                   ORDER BY CASE
                              WHEN lower(name) LIKE '%head%' OR lower(name) LIKE '%hq%' OR lower(name) LIKE '%headquarter%' THEN 1
                              WHEN lower(name) LIKE '%region%' THEN 2
                              WHEN lower(name) LIKE '%station admin%' THEN 3
                              WHEN "manageStaff" THEN 4
                              ELSE 5
                            END,
                            lower(name)
                 ) AS n
            FROM "designations"
        ) r
       WHERE r.id = d.id`);

    await q.query(`
      DO $$
      DECLARE c text;
      BEGIN
        FOR c IN SELECT conname FROM pg_constraint
                  WHERE conrelid = 'org_invites'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%'
        LOOP
          EXECUTE format('ALTER TABLE org_invites DROP CONSTRAINT %I', c);
        END LOOP;
      END $$`);
    await q.query(`
      ALTER TABLE "org_invites" ADD CONSTRAINT "CHK_org_invites_status"
        CHECK ("status" IN ('awaiting_approval','sent','accepted','cancelled'))`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE "org_invites" SET "status" = 'cancelled' WHERE "status" = 'awaiting_approval'`);
    await q.query(`ALTER TABLE "org_invites" DROP CONSTRAINT "CHK_org_invites_status"`);
    await q.query(`ALTER TABLE "org_invites" ADD CONSTRAINT "CHK_org_invites_status" CHECK ("status" IN ('sent','accepted','cancelled'))`);
    await q.query(`ALTER TABLE "designations" DROP COLUMN "rank"`);
  }
}
