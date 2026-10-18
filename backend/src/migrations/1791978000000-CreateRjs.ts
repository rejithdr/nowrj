import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRjs1791978000000 implements MigrationInterface {
  name = 'CreateRjs1791978000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "rjs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "email" character varying(150),
        "phone" character varying(20),
        "photoUrl" character varying(255),
        "isActive" boolean NOT NULL DEFAULT true,
        "stationId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_rjs_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_rjs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rjs_station"
          FOREIGN KEY ("stationId")
          REFERENCES "stations"("id")
          ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "rjs"');
  }
}