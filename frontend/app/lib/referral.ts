import { API_URL } from "./config";
/** Remembers which RJ's referral link brought this visitor, for 30 days. */
const KEY = "nowrjRef";
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;
const API = API_URL;

export function saveReferral(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Storage may be blocked; the referral is simply not recorded.
  }
}

export function readReferral(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    if (Date.now() - at > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearReferral() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * After sign-in: tell the backend which link brought this account in.
 * The backend only counts brand-new accounts, so this is safe to call any time.
 */
export async function claimReferralIfAny() {
  const code = readReferral();
  if (!code) return;
  try {
    await fetch(`${API}/referrals/claim`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  } catch {
    return;
  }
  clearReferral();
}
