import { EntityManager, IsNull } from 'typeorm';
import { Referral } from '../referral.entity';
import { Rj } from '../rj.entity';

export const REWARD_MONTHS = 12;
/** A listener referral can only be claimed by an account this new. */
export const NEW_ACCOUNT_WINDOW_MS = 30 * 60 * 1000;

export function normaliseCode(code: unknown): string | null {
  if (typeof code !== 'string') return null;
  const trimmed = code.trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(trimmed) ? trimmed : null;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/**
 * Called when a listener creates their RJ profile. If they already joined
 * through an RJ's link, that referral becomes an RJ referral; otherwise the
 * code they arrived with (if any) is recorded now. The first referrer wins.
 */
export async function recordRjReferral(
  m: EntityManager,
  listenerId: string,
  newRjId: string,
  codeInput: unknown,
) {
  const existing = await m.findOneBy(Referral, { referredListenerId: listenerId });
  if (existing) {
    if (existing.referrerRjId === newRjId) return null;
    existing.kind = 'rj';
    existing.referredRjId = newRjId;
    return m.save(existing);
  }
  const code = normaliseCode(codeInput);
  if (!code) return null;
  const referrer = await m.findOneBy(Rj, { referralCode: code });
  if (!referrer || referrer.id === newRjId) return null;
  return m.save(
    m.create(Referral, {
      referrerRjId: referrer.id,
      referredListenerId: listenerId,
      kind: 'rj',
      referredRjId: newRjId,
    }),
  );
}

/**
 * Called when a Super Admin verifies an RJ: records when the referred RJ was
 * verified. The 12-month reward window does NOT start here; it starts when
 * monetisation launches on Now On FM (decision of 20 Oct 2026), so
 * rewardEndsAt stays empty until then.
 */
export async function activateRjReferral(m: EntityManager, rjId: string, now = new Date()) {
  const referral = await m.findOneBy(Referral, { referredRjId: rjId, kind: 'rj', activatedAt: IsNull() });
  if (!referral) return null;
  referral.activatedAt = now;
  return m.save(referral);
}
