import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRjOwnershipAndVerification1792400000000
  implements MigrationInterface
{
  name = 'AddRjOwnershipAndVerification1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rjs"
      ADD COLUMN "ownerListenerId" uuid NULL,
      ADD COLUMN "verificationStatus" varchar(20) NOT NULL DEFAULT 'pending'
    `);

    await queryRunner.query(`
      UPDATE "rjs"
      SET "verificationStatus" = 'legacy'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_rjs_ownerListenerId"
      ON "rjs" ("ownerListenerId")
    `);

    await queryRunner.query(`
      ALTER TABLE "rjs"
      ADD CONSTRAINT "FK_rjs_ownerListener"
      FOREIGN KEY ("ownerListenerId")
      REFERENCES "listeners"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rjs"
      DROP CONSTRAINT "FK_rjs_ownerListener"
    `);

    await queryRunner.query(`
      DROP INDEX "UQ_rjs_ownerListenerId"
    `);

    await queryRunner.query(`
      ALTER TABLE "rjs"
      DROP COLUMN "ownerListenerId",
      DROP COLUMN "verificationStatus"
    `);
  }
}