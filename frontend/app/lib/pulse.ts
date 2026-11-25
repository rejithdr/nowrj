import { API_URL } from "./config";

/**
 * Pilot analytics: tells NowRJ that this phone opened NowRJ, was asked to
 * sign in, or opened an ad. Counted once a day per phone, with no name.
 */
export function pulse(step: "open" | "signin_prompt" | "ad_open", extra: { showId?: string; adId?: string } = {}) {
  try {
    void fetch(`${API_URL}/pulse`, {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, ...extra }),
    }).catch(() => undefined);
  } catch {
    /* analytics only */
  }
}
