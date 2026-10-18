import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReactions1792100000000
  implements MigrationInterface
{
  name = 'CreateReactions1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listenerId" uuid NOT NULL,
        "rjId" uuid NULL,
        "programmeId" uuid NULL,
        "type" varchar(10) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),

        CONSTRAINT "PK_reactions_id"
          PRIMARY KEY ("id"),


        CONSTRAINT "CHK_reactions_one_target"
          CHECK (
            ("rjId" IS NOT NULL AND "programmeId" IS NULL)
            OR
            ("rjId" IS NULL AND "programmeId" IS NOT NULL)
          ),

        CONSTRAINT "CHK_reactions_type"
          CHECK ("type" IN ('like', 'fire')),

        CONSTRAINT "FK_reactions_listener"
          FOREIGN KEY ("listenerId")
          REFERENCES "listeners"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_reactions_rj"
          FOREIGN KEY ("rjId")
          REFERENCES "rjs"("id")
          ON DELETE CASCADE,

        CONSTRAINT "FK_reactions_programme"
          FOREIGN KEY ("programmeId")
          REFERENCES "programmes"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_reactions_listenerId"
      ON "reactions" ("listenerId")
    `);
    await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_reactions_listener_rj_type"
  ON "reactions" ("listenerId", "rjId", "type")
  WHERE "rjId" IS NOT NULL
`);

await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_reactions_listener_programme_type"
  ON "reactions" ("listenerId", "programmeId", "type")
  WHERE "programmeId" IS NOT NULL
`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE "reactions"
    `);
  }
}