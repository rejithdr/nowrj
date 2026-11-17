import { MigrationInterface, QueryRunner } from 'typeorm';
import { decryptBytes, decryptText, encryptBytes, encryptText } from '../crypto/field-crypto';

/**
 * Encrypts advertiser phone numbers, signed consent scans and GSTINs already
 * in the database (see crypto/field-crypto.ts). Needs DATA_ENCRYPTION_KEY in
 * backend/.env; deploy/update.sh creates it before migrating.
 */
export class EncryptSensitiveFields1794700000000 implements MigrationInterface {
  name = 'EncryptSensitiveFields1794700000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "advertisers" ALTER COLUMN "contactPhone" TYPE text`);
    await q.query(`ALTER TABLE "stations" ALTER COLUMN "gstin" TYPE text`);
    for (const r of await q.query(`SELECT id, "contactPhone" AS v FROM advertisers WHERE "contactPhone" IS NOT NULL`)) {
      await q.query(`UPDATE advertisers SET "contactPhone" = $2 WHERE id = $1`, [r.id, encryptText(r.v)]);
    }
    for (const r of await q.query(`SELECT id, gstin AS v FROM stations WHERE gstin IS NOT NULL`)) {
      await q.query(`UPDATE stations SET gstin = $2 WHERE id = $1`, [r.id, encryptText(r.v)]);
    }
    for (const r of await q.query(`SELECT id FROM advertiser_consents WHERE scan IS NOT NULL`)) {
      const [{ scan }] = await q.query(`SELECT scan FROM advertiser_consents WHERE id = $1`, [r.id]);
      await q.query(`UPDATE advertiser_consents SET scan = $2 WHERE id = $1`, [r.id, encryptBytes(scan)]);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const r of await q.query(`SELECT id, "contactPhone" AS v FROM advertisers WHERE "contactPhone" IS NOT NULL`)) {
      await q.query(`UPDATE advertisers SET "contactPhone" = $2 WHERE id = $1`, [r.id, decryptText(r.v)]);
    }
    for (const r of await q.query(`SELECT id, gstin AS v FROM stations WHERE gstin IS NOT NULL`)) {
      await q.query(`UPDATE stations SET gstin = $2 WHERE id = $1`, [r.id, decryptText(r.v)]);
    }
    for (const r of await q.query(`SELECT id FROM advertiser_consents WHERE scan IS NOT NULL`)) {
      const [{ scan }] = await q.query(`SELECT scan FROM advertiser_consents WHERE id = $1`, [r.id]);
      await q.query(`UPDATE advertiser_consents SET scan = $2 WHERE id = $1`, [r.id, decryptBytes(scan)]);
    }
    await q.query(`ALTER TABLE "advertisers" ALTER COLUMN "contactPhone" TYPE varchar(20)`);
    await q.query(`ALTER TABLE "stations" ALTER COLUMN "gstin" TYPE varchar(15)`);
  }
}
