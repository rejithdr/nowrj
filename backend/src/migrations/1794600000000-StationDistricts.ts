import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The districts each station reaches. Listeners choose their district and
 * see only stations that reach it. Null means the station has not chosen
 * yet, and it keeps showing everywhere.
 */
export class StationDistricts1794600000000 implements MigrationInterface {
  name = 'StationDistricts1794600000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "stations" ADD "districts" text[]`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "stations" DROP COLUMN "districts"`);
  }
}
