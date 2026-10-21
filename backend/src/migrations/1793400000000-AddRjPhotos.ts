import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * rj_photos: profile photos uploaded by RJs, stored in the database so they
 * are included in the nightly backup. One small square image per RJ.
 */
export class AddRjPhotos1793400000000 implements MigrationInterface {
  name = 'AddRjPhotos1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rj_photos" (
        "rjId" uuid NOT NULL,
        "data" bytea NOT NULL,
        "contentType" varchar(30) NOT NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rj_photos" PRIMARY KEY ("rjId"),
        CONSTRAINT "FK_rj_photos_rj" FOREIGN KEY ("rjId") REFERENCES "rjs"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rj_photos"`);
  }
}
