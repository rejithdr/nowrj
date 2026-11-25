import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Signed-out listeners can Like or Fire a show from their phone. Their
 * reactions carry a random device id (cookie) instead of a listener id, and
 * move to the account when they sign in.
 */
export class DeviceReactions1795000000000 implements MigrationInterface {
  name = 'DeviceReactions1795000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE "reactions"
        ALTER COLUMN "listenerId" DROP NOT NULL,
        ADD COLUMN "deviceId" uuid,
        ADD CONSTRAINT "CHK_reactions_listener_or_device" CHECK (num_nonnulls("listenerId", "deviceId") = 1),
        ADD CONSTRAINT "CHK_reactions_device_shows_only" CHECK ("deviceId" IS NULL OR "showOccurrenceId" IS NOT NULL)
    `);
    await q.query(`
      CREATE UNIQUE INDEX "UQ_reactions_device_show_type" ON "reactions" ("deviceId", "showOccurrenceId", "type")
      WHERE "deviceId" IS NOT NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "reactions" WHERE "deviceId" IS NOT NULL`);
    await q.query(`DROP INDEX "UQ_reactions_device_show_type"`);
    await q.query(`
      ALTER TABLE "reactions"
        DROP CONSTRAINT "CHK_reactions_device_shows_only",
        DROP CONSTRAINT "CHK_reactions_listener_or_device",
        DROP COLUMN "deviceId",
        ALTER COLUMN "listenerId" SET NOT NULL
    `);
  }
}
