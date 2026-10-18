
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProgrammes1791977000000
  implements MigrationInterface
{
  name = 'CreateProgrammes1791977000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "programmes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(150) NOT NULL,
        "slug" character varying(150) NOT NULL,
        "rjName" character varying(150),
        "startTime" TIME,
        "endTime" TIME,
        "isActive" boolean NOT NULL DEFAULT true,
        "stationId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_programmes_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_programmes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_programmes_station"
          FOREIGN KEY ("stationId")
          REFERENCES "stations"("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "programmes"');
  }
}
