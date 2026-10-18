import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateListeners1791979000000 implements MigrationInterface {
  name = 'CreateListeners1791979000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "listeners" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "displayName" character varying(150),
        "email" character varying(255),
        "googleId" character varying(30),
        "facebookId" character varying(30),
        "photoUrl" character varying(500),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_listeners_email" UNIQUE ("email"),
        CONSTRAINT "UQ_listeners_googleId" UNIQUE ("googleId"),
        CONSTRAINT "UQ_listeners_facebookId" UNIQUE ("facebookId"),
        CONSTRAINT "PK_listeners_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "listeners"`);
  }
}