
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProgrammeRjs1792300000000
  implements MigrationInterface
{
  name = 'CreateProgrammeRjs1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "programme_rjs" (
        "programmeId" uuid NOT NULL,
        "rjId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_programme_rjs"
          PRIMARY KEY ("programmeId", "rjId"),

        CONSTRAINT "FK_programme_rjs_programme"
          FOREIGN KEY ("programmeId")
          REFERENCES "programmes"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_programme_rjs_rj"
          FOREIGN KEY ("rjId")
          REFERENCES "rjs"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_programme_rjs_rjId"
      ON "programme_rjs" ("rjId")
    `);

    await queryRunner.query(`
      INSERT INTO "programme_rjs" ("programmeId", "rjId")
      SELECT p."id", r."id"
      FROM "programmes" p
      INNER JOIN "rjs" r
        ON lower(trim(r."name")) = lower(trim(p."rjName"))
      WHERE p."rjName" IS NOT NULL
      ON CONFLICT ("programmeId", "rjId") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "programme_rjs"');
  }
}
