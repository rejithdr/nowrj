import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Referrals and RJ vouching.
 *
 * - rjs.referralCode: every RJ's personal link code (/r/<code>), generated
 *   by the database for new and existing RJs.
 * - referrals: who joined NowRJ through which RJ's link. A listener referral
 *   becomes an RJ referral if that person creates an RJ profile; its
 *   12-month reward window starts when the new RJ is verified.
 *   One referral per person: the first RJ link they used counts.
 * - rj_vouches: verified RJs confirming they know a pending RJ.
 */
export class AddReferralsAndVouches1793200000000 implements MigrationInterface {
  name = 'AddReferralsAndVouches1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rjs"
      ADD COLUMN "referralCode" varchar(16) NOT NULL
        DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
      ADD CONSTRAINT "UQ_rjs_referralCode" UNIQUE ("referralCode")
    `);

    await queryRunner.query(`
      CREATE TABLE "referrals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "referrerRjId" uuid NOT NULL,
        "referredListenerId" uuid NOT NULL,
        "kind" varchar(20) NOT NULL DEFAULT 'listener',
        "referredRjId" uuid NULL,
        "activatedAt" TIMESTAMPTZ NULL,
        "rewardEndsAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_referrals_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_referrals_referred_listener" UNIQUE ("referredListenerId"),
        CONSTRAINT "CHK_referrals_kind" CHECK ("kind" IN ('listener', 'rj')),
        CONSTRAINT "CHK_referrals_rj_has_rj" CHECK ("kind" <> 'rj' OR "referredRjId" IS NOT NULL),
        CONSTRAINT "CHK_referrals_not_self" CHECK ("referredRjId" IS NULL OR "referredRjId" <> "referrerRjId"),
        CONSTRAINT "FK_referrals_referrer"
          FOREIGN KEY ("referrerRjId") REFERENCES "rjs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_referrals_listener"
          FOREIGN KEY ("referredListenerId") REFERENCES "listeners"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_referrals_referred_rj"
          FOREIGN KEY ("referredRjId") REFERENCES "rjs"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_referrals_referrer" ON "referrals" ("referrerRjId", "createdAt")`);

    await queryRunner.query(`
      CREATE TABLE "rj_vouches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rjId" uuid NOT NULL,
        "voucherRjId" uuid NOT NULL,
        "note" varchar(280) NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

        CONSTRAINT "PK_rj_vouches_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rj_vouches_pair" UNIQUE ("rjId", "voucherRjId"),
        CONSTRAINT "CHK_rj_vouches_not_self" CHECK ("rjId" <> "voucherRjId"),
        CONSTRAINT "FK_rj_vouches_rj" FOREIGN KEY ("rjId") REFERENCES "rjs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rj_vouches_voucher" FOREIGN KEY ("voucherRjId") REFERENCES "rjs"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "rj_vouches"`);
    await queryRunner.query(`DROP TABLE "referrals"`);
    await queryRunner.query(`
      ALTER TABLE "rjs"
      DROP CONSTRAINT "UQ_rjs_referralCode",
      DROP COLUMN "referralCode"
    `);
  }
}
