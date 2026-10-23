import { MigrationInterface, QueryRunner } from 'typeorm';

/** enquiries: messages from the "Advertise on Now On FM" contact form, read by the Super Admin. */
export class AddEnquiries1793500000000 implements MigrationInterface {
  name = 'AddEnquiries1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "enquiries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kind" varchar(20) NOT NULL DEFAULT 'advertise',
        "name" varchar(100) NOT NULL,
        "organisation" varchar(150),
        "phone" varchar(20),
        "email" varchar(255),
        "message" varchar(1000) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'new',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_enquiries" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_enquiries_status" CHECK ("status" IN ('new', 'done')),
        CONSTRAINT "CHK_enquiries_contact" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL)
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_enquiries_created" ON "enquiries" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "enquiries"`);
  }
}
