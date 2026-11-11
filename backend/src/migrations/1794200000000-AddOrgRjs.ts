import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Release 3a: RJs join a place in an organisation (head office, a region or
 * a station) by invite, and can be removed.
 *
 * - org_rjs: which RJ works where. unitId null = head office.
 * - rj_invites: an invite to one email address; the RJ accepts or declines.
 * - notices: simple dashboard messages, e.g. "You were removed from …".
 */
export class AddOrgRjs1794200000000 implements MigrationInterface {
  name = 'AddOrgRjs1794200000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "org_rjs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organisationId" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "rjId" uuid NOT NULL REFERENCES "rjs"("id") ON DELETE CASCADE,
        "unitId" uuid REFERENCES "org_units"("id") ON DELETE SET NULL,
        "status" varchar(20) NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','removed')),
        "joinedOn" date NOT NULL,
        "leftOn" date,
        "addedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "removedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_rjs" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX "UQ_org_rjs_active" ON "org_rjs" ("organisationId", "rjId") WHERE "status" = 'active'`);
    await q.query(`CREATE INDEX "IDX_org_rjs_rj" ON "org_rjs" ("rjId")`);

    await q.query(`
      CREATE TABLE "rj_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organisationId" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
        "unitId" uuid REFERENCES "org_units"("id") ON DELETE CASCADE,
        "email" varchar(255) NOT NULL,
        "token" varchar(64) NOT NULL UNIQUE,
        "status" varchar(20) NOT NULL DEFAULT 'sent' CHECK ("status" IN ('sent','accepted','declined','cancelled')),
        "invitedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "rjId" uuid REFERENCES "rjs"("id") ON DELETE SET NULL,
        "decidedAt" timestamptz,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rj_invites" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_rj_invites_email" ON "rj_invites" (lower("email"))`);

    await q.query(`
      CREATE TABLE "notices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listenerId" uuid NOT NULL REFERENCES "listeners"("id") ON DELETE CASCADE,
        "text" varchar(500) NOT NULL,
        "readAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notices" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_notices_listener" ON "notices" ("listenerId")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "notices"`);
    await q.query(`DROP TABLE "rj_invites"`);
    await q.query(`DROP TABLE "org_rjs"`);
  }
}
