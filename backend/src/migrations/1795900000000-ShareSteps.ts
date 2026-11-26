import { MigrationInterface, QueryRunner } from 'typeorm';

/** Pilot steps for sharing: someone shared a NowRJ link, or arrived from one. */
export class ShareSteps1795900000000 implements MigrationInterface {
  name = 'ShareSteps1795900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "pilot_steps" DROP CONSTRAINT "CHK_pilot_steps_step"`);
    await q.query(
      `ALTER TABLE "pilot_steps" ADD CONSTRAINT "CHK_pilot_steps_step"
         CHECK ("step" IN ('open', 'tap', 'signin_prompt', 'signin', 'message', 'ad_open', 'share', 'share_open'))`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM "pilot_steps" WHERE "step" IN ('share', 'share_open')`);
    await q.query(`ALTER TABLE "pilot_steps" DROP CONSTRAINT "CHK_pilot_steps_step"`);
    await q.query(
      `ALTER TABLE "pilot_steps" ADD CONSTRAINT "CHK_pilot_steps_step"
         CHECK ("step" IN ('open', 'tap', 'signin_prompt', 'signin', 'message', 'ad_open'))`,
    );
  }
}
