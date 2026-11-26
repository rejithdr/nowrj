import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "I'm interested" on an ad. A signed-in listener either shares their phone
 * number with the business (after ticking consent) or sends a text message
 * and talks to the business inside NowRJ without sharing a number.
 * One lead per listener per ad. "priceInr" is the per-lead rate at the time
 * (a placeholder until billing is settled). Phone numbers are encrypted and
 * cleared after 90 days, or straight away when the listener withdraws.
 */
export class AdLeads1795800000000 implements MigrationInterface {
  name = 'AdLeads1795800000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE "ad_leads" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "adId" uuid NOT NULL REFERENCES "ads"("id") ON DELETE CASCADE,
        "advertiserId" uuid NOT NULL REFERENCES "advertisers"("id") ON DELETE CASCADE,
        "stationId" uuid NOT NULL REFERENCES "stations"("id") ON DELETE CASCADE,
        "programmeId" uuid REFERENCES "programmes"("id") ON DELETE SET NULL,
        "showOccurrenceId" uuid REFERENCES "show_occurrences"("id") ON DELETE SET NULL,
        "listenerId" uuid NOT NULL REFERENCES "listeners"("id") ON DELETE CASCADE,
        "kind" varchar(10) NOT NULL,
        "name" varchar(100) NOT NULL,
        "phone" varchar(200),
        "message" varchar(300),
        "consentText" varchar(300),
        "status" varchar(10) NOT NULL DEFAULT 'new',
        "priceInr" numeric(8, 2) NOT NULL,
        "withdrawnAt" TIMESTAMP WITH TIME ZONE,
        "phoneClearedAt" TIMESTAMP WITH TIME ZONE,
        "handledAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ad_leads" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ad_leads_listener" UNIQUE ("adId", "listenerId"),
        CONSTRAINT "CHK_ad_leads_kind" CHECK ("kind" IN ('phone', 'message')),
        CONSTRAINT "CHK_ad_leads_status" CHECK ("status" IN ('new', 'contacted', 'closed')),
        CONSTRAINT "CHK_ad_leads_message" CHECK ("kind" <> 'message' OR "message" IS NOT NULL)
      )`);
    await q.query(`CREATE INDEX "IDX_ad_leads_advertiser" ON "ad_leads" ("advertiserId", "createdAt")`);
    await q.query(`CREATE INDEX "IDX_ad_leads_listener" ON "ad_leads" ("listenerId")`);
    await q.query(`
      CREATE TABLE "ad_lead_replies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "leadId" uuid NOT NULL REFERENCES "ad_leads"("id") ON DELETE CASCADE,
        "fromBusiness" boolean NOT NULL,
        "listenerId" uuid REFERENCES "listeners"("id") ON DELETE SET NULL,
        "body" varchar(500) NOT NULL,
        "readAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ad_lead_replies" PRIMARY KEY ("id")
      )`);
    await q.query(`CREATE INDEX "IDX_ad_lead_replies_lead" ON "ad_lead_replies" ("leadId", "createdAt")`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE "ad_lead_replies"`);
    await q.query(`DROP TABLE "ad_leads"`);
  }
}
