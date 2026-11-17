import { randomBytes } from 'node:crypto';
import * as c from './field-crypto';

// The key is read on first use, so setting it here is early enough.
process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');

describe('field encryption', () => {
  it('round-trips text and hides it', () => {
    const sealed = c.encryptText('9447012345')!;
    expect(sealed.startsWith('enc:v1:')).toBe(true);
    expect(sealed).not.toContain('9447012345');
    expect(c.decryptText(sealed)).toBe('9447012345');
    expect(c.encryptText(sealed)).toBe(sealed);
  });

  it('uses a fresh nonce each time', () => {
    expect(c.encryptText('same')).not.toBe(c.encryptText('same'));
  });

  it('leaves empty and old plain values alone', () => {
    expect(c.encryptText(null)).toBeNull();
    expect(c.encryptText('')).toBe('');
    expect(c.decryptText('9447012345')).toBe('9447012345');
  });

  it('round-trips files', () => {
    const pdf = Buffer.from('%PDF-1.4 signed consent');
    const sealed = c.encryptBytes(pdf)!;
    expect(sealed.includes(pdf)).toBe(false);
    expect(c.decryptBytes(sealed)!.equals(pdf)).toBe(true);
    expect(c.decryptBytes(pdf)!.equals(pdf)).toBe(true);
  });

  it('refuses tampered data', () => {
    const sealed = c.encryptText('29ABCDE1234F1Z5')!;
    const broken = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(() => c.decryptText(broken)).toThrow();
  });
});
