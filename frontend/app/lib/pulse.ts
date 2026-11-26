import { API_URL } from "./config";

/**
 * Pilot analytics: tells NowRJ that this phone opened NowRJ, was asked to
 * sign in, opened an ad, shared a link, or arrived from a shared link. Counted once a day per phone, with no name.
 */
export function pulse(
  step: "open" | "signin_prompt" | "ad_open" | "share" | "share_open",
  extra: { showId?: string; adId?: string; programmeId?: string; path?: string } = {},
) {
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
