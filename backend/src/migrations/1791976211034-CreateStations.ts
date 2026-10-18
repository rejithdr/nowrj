import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStations1791976211034 implements MigrationInterface {
    name = 'CreateStations1791976211034'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "stations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(150) NOT NULL,
                "slug" character varying(100) NOT NULL,
                "city" character varying(100),
                "state" character varying(100),
                "isActive" boolean NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_7e4c9ac5dc936822bfe28a96f45" UNIQUE ("slug"),
                CONSTRAINT "PK_f047974bd453c85b08bab349367" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "stations"
        `);
    }

}
