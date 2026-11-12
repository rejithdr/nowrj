import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Release 5a: ads go live.
 *
 * - organisations.stationType: commercial, non_commercial (community radio)
 *   or government (Akashvani). Government stations get ads only after an
 *   agreement with Prasar Bharati (stations.adsAgreementAt).
 * - stations.gstRegistered / gstin: used for bills in release 5b.
 * - ads: one ad = creative + where it shows. Sponsored: a programme over a
 *   date range. Shout-out: one show, put on air by the RJ or staff. Aired
 *   spot: one show, or a programme over a date range. Every ad is approved
 *   by someone other than the person who entered it (maker-checker).
 * - ad_responses: a listener pressing Call or Visit website. One per
 *   listener per ad per calendar month (India time), enforced by the key.
 */
export class AddAds1794500000000 implements MigrationInterface {
  name = 'AddAds1794500000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "organisations" ADD "stationType" varchar(20) NOT NULL DEFAULT 'commercial'
      CHECK ("stationType" IN ('commercial','non_commercial','government'))`);
    await q.query(`ALTER TABLE "stations" ADD "adsAgreementAt" timestamptz`);
    await q.query(`ALTER TABLE "stations" ADD "gstRegistered" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE "stations" ADD "gstin" varchar(15)`);

    await q.query(`
      CREATE TABLE "ads" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "stationId" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
        "advertiserId" uuid NOT NULL REFERENCES "advertisers"("id") ON DELETE CASCADE,
        "creativeId" uuid NOT NULL REFERENCES "ad_creatives"("id") ON DELETE RESTRICT,
        "kind" varchar(20) NOT NULL CHECK ("kind" IN ('sponsored','shoutout','aired')),
        "programmeId" uuid REFERENCES "programmes"("id") ON DELETE CASCADE,
        "showOccurrenceId" uuid REFERENCES "show_occurrences"("id") ON DELETE CASCADE,
        "startDate" date,
        "endDate" date,
        "status" varchar(20) NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','approved','rejected','withdrawn')),
        "makerListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "checkerListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "checkedAt" timestamptz,
        "rejectReason" varchar(300),
        "activatedAt" timestamptz,
        "activatedByListenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ads" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ads_target" CHECK (
          ("kind" = 'sponsored' AND "programmeId" IS NOT NULL AND "startDate" IS NOT NULL AND "endDate" IS NOT NULL AND "showOccurrenceId" IS NULL)
          OR ("kind" = 'shoutout' AND "showOccurrenceId" IS NOT NULL AND "programmeId" IS NULL)
          OR ("kind" = 'aired' AND (
                ("programmeId" IS NOT NULL AND "startDate" IS NOT NULL AND "endDate" IS NOT NULL AND "showOccurrenceId" IS NULL)
             OR ("showOccurrenceId" IS NOT NULL AND "programmeId" IS NULL)))
        ),
        CONSTRAINT "CHK_ads_dates" CHECK ("endDate" IS NULL OR "endDate" >= "startDate")
      )`);
    await q.query(`CREATE INDEX "IDX_ads_station" ON "ads" ("stationId", "status")`);
    await q.query(`CREATE INDEX "IDX_ads_programme" ON "ads" ("programmeId") WHERE "programmeId" IS NOT NULL`);
    await q.query(`CREATE INDEX "IDX_ads_show" ON "ads" ("showOccurrenceId") WHERE "showOccurrenceId" IS NOT NULL`);

    await q.query(`
      CREATE TABLE "ad_responses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "adId" uuid NOT NULL REFERENCES "ads"("id") ON DELETE CASCADE,
        "listenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "month" char(7) NOT NULL,
        "kind" varchar(20) NOT NULL CHECK ("kind" IN ('call','website')),
        "viaShoutout" boolean NOT NULL DEFAULT false,
        "stationId" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
        "advertiserId" uuid NOT NULL REFERENCES "advertisers"("id") ON DELETE CASCADE,
        "programmeId" uuid REFERENCES "programmes"("id") ON DELETE SET NULL,
        "showOccurrenceId" uuid REFERENCES "show_occurrences"("id") ON DELETE SET NULL,
        "flagged" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ad_responses" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE UNIQUE INDEX "UQ_ad_responses_once_a_month" ON "ad_responses" ("adId", "listenerId", "month")`);
    await q.query(`CREATE INDEX "IDX_ad_responses_station_month" ON "ad_responses" ("stationId", "month")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "ad_responses"`);
    await q.query(`DROP TABLE "ads"`);
    await q.query(`ALTER TABLE "stations" DROP COLUMN "gstin"`);
    await q.query(`ALTER TABLE "stations" DROP COLUMN "gstRegistered"`);
    await q.query(`ALTER TABLE "stations" DROP COLUMN "adsAgreementAt"`);
    await q.query(`ALTER TABLE "organisations" DROP COLUMN "stationType"`);
  }
}
