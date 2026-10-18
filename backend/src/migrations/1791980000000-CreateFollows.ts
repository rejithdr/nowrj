
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFollows1791980000000
  implements MigrationInterface
{
  name = 'CreateFollows1791980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listenerId" uuid NOT NULL,
        "rjId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_follows_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_follows_listener_rj"
          UNIQUE ("listenerId", "rjId"),
        CONSTRAINT "FK_follows_listener"
          FOREIGN KEY ("listenerId")
          REFERENCES "listeners"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_follows_rj"
          FOREIGN KEY ("rjId")
          REFERENCES "rjs"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_follows_listenerId"
      ON "follows" ("listenerId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_follows_rjId"
      ON "follows" ("rjId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "follows"
    `);
  }
}
