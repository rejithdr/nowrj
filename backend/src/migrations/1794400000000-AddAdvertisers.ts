import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Release 4: advertisers and the ad library.
 *
 * - stations.adsEnabled: the per-station ads switch (Super Admin only, off).
 * - advertisers: a business. Created when a station first invites it.
 * - advertiser_members: the NowRJ accounts that belong to the business.
 * - advertiser_stations: which stations work with it (decision 9).
 * - advertiser_invites: one-time links, one per station and email.
 * - advertiser_consents: consent to show the business name, logo and links
 *   and to the 45-day free trial: digital (agreed on screen) or a scan the
 *   station uploads and Super Admin checks.
 * - ad_creatives (+ images): the library, per advertiser and station.
 * - ad_creative_suggestions: changes the advertiser asks for.
 */
export class AddAdvertisers1794400000000 implements MigrationInterface {
  name = 'AddAdvertisers1794400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "stations" ADD "adsEnabled" boolean NOT NULL DEFAULT false`);

    await q.query(`
      CREATE TABLE "advertisers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "businessName" varchar(150) NOT NULL,
        "contactName" varchar(100) NOT NULL,
        "contactPhone" varchar(20),
        "email" varchar(255) NOT NULL,
        "createdByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_advertisers" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX "UQ_advertisers_email" ON "advertisers" (lower("email"))`);

    await q.query(`
      CREATE TABLE "advertiser_members" (
        "advertiserId" uuid NOT NULL REFERENCES "advertisers"("id") ON DELETE CASCADE,
        "listenerId" uuid NOT NULL REFERENCES "listeners"("id") ON DELETE CASCADE,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_advertiser_members" PRIMARY KEY ("advertiserId", "listenerId")
      )`);

    await q.query(`
      CREATE TABLE "advertiser_stations" (
        "advertiserId" uuid NOT NULL REFERENCES "advertisers"("id") ON DELETE CASCADE,
        "stationId" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
        "status" varchar(20) NOT NULL DEFAULT 'invited' CHECK ("status" IN ('invited','active','ended')),
        "invitedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "joinedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_advertiser_stations" PRIMARY KEY ("advertiserId", "stationId")
      )`);

    await q.query(`
      CREATE TABLE "advertiser_invites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "advertiserId" uuid NOT NULL REFERENCES "advertisers"("id") ON DELETE CASCADE,
        "stationId" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
        "email" varchar(255) NOT NULL,
        "token" varchar(64) NOT NULL UNIQUE,
        "status" varchar(20) NOT NULL DEFAULT 'sent' CHECK ("status" IN ('sent','accepted','cancelled')),
        "invitedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "acceptedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "acceptedAt" timestamptz,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_advertiser_invites" PRIMARY KEY ("id")
      )`);

    await q.query(`
      CREATE TABLE "advertiser_consents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "advertiserId" uuid NOT NULL REFERENCES "advertisers"("id") ON DELETE CASCADE,
        "kind" varchar(20) NOT NULL CHECK ("kind" IN ('digital','scan')),
        "status" varchar(20) NOT NULL CHECK ("status" IN ('valid','pending_check','rejected','withdrawn')),
        "version" varchar(40) NOT NULL,
        "signedName" varchar(100),
        "acceptedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "uploadedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "stationId" uuid REFERENCES "stations"("id") ON DELETE SET NULL,
        "scan" bytea,
        "scanType" varchar(40),
        "checkedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "checkedAt" timestamptz,
        "note" varchar(300),
        "withdrawnAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_advertiser_consents" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_consent_scan" CHECK (("kind" = 'scan') = ("scan" IS NOT NULL))
      )`);
    await q.query(`CREATE INDEX "IDX_advertiser_consents_adv" ON "advertiser_consents" ("advertiserId")`);

    await q.query(`
      CREATE TABLE "ad_creatives" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "advertiserId" uuid NOT NULL REFERENCES "advertisers"("id") ON DELETE CASCADE,
        "stationId" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
        "title" varchar(100) NOT NULL,
        "offerText" varchar(300) NOT NULL,
        "address" varchar(300),
        "timings" varchar(150),
        "phone" varchar(20),
        "website" varchar(255),
        "hasImage" boolean NOT NULL DEFAULT false,
        "status" varchar(20) NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','archived')),
        "createdByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "updatedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ad_creatives" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_ad_creatives_adv_station" ON "ad_creatives" ("advertiserId", "stationId")`);
    await q.query(`
      CREATE TABLE "ad_creative_images" (
        "creativeId" uuid NOT NULL REFERENCES "ad_creatives"("id") ON DELETE CASCADE,
        "data" bytea NOT NULL,
        "contentType" varchar(40) NOT NULL,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ad_creative_images" PRIMARY KEY ("creativeId")
      )`);
    await q.query(`
      CREATE TABLE "ad_creative_suggestions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "creativeId" uuid NOT NULL REFERENCES "ad_creatives"("id") ON DELETE CASCADE,
        "listenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "text" varchar(500) NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'open' CHECK ("status" IN ('open','done')),
        "doneByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ad_creative_suggestions" PRIMARY KEY ("id")
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const t of ['ad_creative_suggestions', 'ad_creative_images', 'ad_creatives', 'advertiser_consents', 'advertiser_invites', 'advertiser_stations', 'advertiser_members', 'advertisers']) {
      await q.query(`DROP TABLE "${t}"`);
    }
    await q.query(`ALTER TABLE "stations" DROP COLUMN "adsEnabled"`);
  }
}
