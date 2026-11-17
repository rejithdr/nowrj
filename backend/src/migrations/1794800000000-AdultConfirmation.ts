import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Accounts are for people 18 and over. Each person confirms it once after
 * signing in; this records when. Null: not confirmed yet, and the account
 * can only read until it is.
 */
export class AdultConfirmation1794800000000 implements MigrationInterface {
  name = 'AdultConfirmation1794800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "listeners" ADD "adultConfirmedAt" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "listeners" DROP COLUMN "adultConfirmedAt"`);
  }
}
