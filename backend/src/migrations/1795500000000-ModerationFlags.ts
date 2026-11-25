import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moderation is kept apart from verification, so other changes (an RJ being
 * verified, a station claiming a programme) cannot undo a Super Admin hide.
 * - rjs.suspendedAt: hidden or deactivated by the NowRJ team. The RJ, their
 *   own programmes and their RJ tools are off.
 * - programmes.hiddenAt: hidden by the NowRJ team.
 * RJs already deactivated by the Super Admin while verified become suspended.
 */
export class ModerationFlags1795500000000 implements MigrationInterface {
  name = 'ModerationFlags1795500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "rjs" ADD "suspendedAt" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "programmes" ADD "hiddenAt" TIMESTAMP WITH TIME ZONE`);
    await q.query(`UPDATE rjs SET "suspendedAt" = now() WHERE "isActive" = false AND "verificationStatus" = 'verified'`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "programmes" DROP COLUMN "hiddenAt"`);
    await q.query(`ALTER TABLE "rjs" DROP COLUMN "suspendedAt"`);
  }
}
