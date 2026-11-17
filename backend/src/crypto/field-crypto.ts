import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encrypts the most sensitive fields before they reach the database
 * (advertiser phone numbers, signed consent scans, GSTINs), so a copy of the
 * database or a backup on its own does not reveal them.
 *
 * AES-256-GCM with the key in DATA_ENCRYPTION_KEY (32 random bytes, base64),
 * which lives only in backend/.env on the server. Keep a copy of it somewhere
 * safe off the server: without it these fields cannot be read, even from a
 * backup.
 *
 * Text is stored as "enc:v1:<base64>", files as the bytes "NRJE1" + data.
 * Values without the marker (written before encryption was turned on) are
 * returned as they are.
 */
const TEXT_PREFIX = 'enc:v1:';
const BYTES_MAGIC = Buffer.from('NRJE1');
const IV = 12;
const TAG = 16;

let cached: Buffer | null = null;

function key(): Buffer {
  if (cached) return cached;
  const raw = process.env.DATA_ENCRYPTION_KEY;
  const k = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (k.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY is missing or not 32 bytes of base64. Run deploy/ensure-data-key.sh on the server.');
  }
  cached = k;
  return k;
}

/** Fails at startup rather than on the first save. */
export function assertDataKey() {
  key();
}

function seal(plain: Buffer): Buffer {
  const iv = randomBytes(IV);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function open(sealed: Buffer): Buffer {
  const iv = sealed.subarray(0, IV);
  const tag = sealed.subarray(IV, IV + TAG);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(sealed.subarray(IV + TAG)), decipher.final()]);
}

export const isEncryptedText = (value: unknown) => typeof value === 'string' && value.startsWith(TEXT_PREFIX);
export const isEncryptedBytes = (value: unknown) =>
  Buffer.isBuffer(value) && value.subarray(0, BYTES_MAGIC.length).equals(BYTES_MAGIC);

export function encryptText(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null;
  if (isEncryptedText(value)) return value;
  return TEXT_PREFIX + seal(Buffer.from(value, 'utf8')).toString('base64');
}

export function decryptText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncryptedText(value)) return value;
  return open(Buffer.from(value.slice(TEXT_PREFIX.length), 'base64')).toString('utf8');
}

export function encryptBytes(value: Buffer | null): Buffer | null {
  if (!value) return value;
  if (isEncryptedBytes(value)) return value;
  return Buffer.concat([BYTES_MAGIC, seal(value)]);
}

export function decryptBytes(value: Buffer | null): Buffer | null {
  if (!value) return value;
  if (!isEncryptedBytes(value)) return value;
  return open(value.subarray(BYTES_MAGIC.length));
}
