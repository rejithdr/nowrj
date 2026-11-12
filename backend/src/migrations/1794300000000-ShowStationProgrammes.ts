import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A programme an RJ created before being verified starts hidden. If a
 * station then took it over, verifying the RJ no longer switched it on
 * (verification only touches programmes the RJ still owns). Station-owned
 * programmes do not depend on an RJ's verification, so show them.
 */
export class ShowStationProgrammes1794300000000 implements MigrationInterface {
  name = 'ShowStationProgrammes1794300000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE programmes SET "isActive" = true WHERE "ownerStationId" IS NOT NULL AND "isActive" = false`);
  }

  public async down(): Promise<void> {
    // Nothing to undo: which programmes were hidden before is not recorded.
  }
}
