import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pilot analytics: one row per person per step per day, where a "person" is
 * the phone (device id cookie) or, without one, the signed-in account.
 * Steps: open, tap, signin_prompt, signin, message, ad_open. No names or
 * contact details are stored here.
 */
export class PilotSteps1795200000000 implements MigrationInterface {
  name = 'PilotSteps1795200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "pilot_steps" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "day" date NOT NULL,
        "step" varchar(20) NOT NULL,
        "person" uuid NOT NULL,
        "deviceId" uuid,
        "listenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "stationId" uuid REFERENCES "stations"("id") ON DELETE CASCADE,
        "adId" uuid REFERENCES "ads"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pilot_steps" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_pilot_steps_step" CHECK ("step" IN ('open', 'tap', 'signin_prompt', 'signin', 'message', 'ad_open'))
      )`);
    await q.query(`
      CREATE UNIQUE INDEX "UQ_pilot_steps_once_a_day" ON "pilot_steps"
        ("day", "step", "person", COALESCE("stationId", '00000000-0000-0000-0000-000000000000'), COALESCE("adId", '00000000-0000-0000-0000-000000000000'))`);
    await q.query(`CREATE INDEX "IDX_pilot_steps_day" ON "pilot_steps" ("day")`);
    await q.query(`CREATE INDEX "IDX_pilot_steps_person" ON "pilot_steps" ("person", "day")`);
    await q.query(`CREATE INDEX "IDX_pilot_steps_ad" ON "pilot_steps" ("adId") WHERE "adId" IS NOT NULL`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "pilot_steps"`);
  }
}
