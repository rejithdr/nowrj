import { EntityManager } from 'typeorm';

export type AdKind = 'sponsored' | 'shoutout' | 'aired';
export const MAX_SPONSORED_PER_SHOW = 2;

/**
 * SQL that is true when ad `a` may be shown to listeners: approved, its
 * station has ads switched on and is not hidden, and the advertiser's
 * consent is in place. (Release 5b adds the trial hold here.)
 */
export const RUNNABLE_AD = (a = 'a') => `
  ${a}.status = 'approved'
  AND EXISTS (SELECT 1 FROM stations st WHERE st.id = ${a}."stationId" AND st."adsEnabled")
  AND NOT EXISTS (SELECT 1 FROM hidden_stations hs WHERE hs.id = ${a}."stationId")
  AND EXISTS (SELECT 1 FROM advertiser_consents ac WHERE ac."advertiserId" = ${a}."advertiserId" AND ac.status = 'valid')
  AND EXISTS (SELECT 1 FROM ad_creatives cr WHERE cr.id = ${a}."creativeId" AND cr.status = 'active')`;

export type ShowAd = {
  id: string;
  creativeId: string;
  kind: AdKind;
  title: string;
  offerText: string;
  businessName: string;
  imageVersion: string | null;
};

/**
 * Which ads go on which show cards.
 * - Sponsored: from when the card appears until 24 hours after the show
 *   (catch-up); at most two per card, the earliest approved first.
 * - Aired spot: while the show is live and for 24 hours after.
 * - Shout-out: the latest one put on air during the show, from that
 *   moment, and for 24 hours after the show.
 */
export async function adsForShows(
  m: EntityManager,
  shows: { id: string; startsAt: Date; endsAt: Date }[],
  now = new Date(),
): Promise<Map<string, ShowAd[]>> {
  const out = new Map<string, ShowAd[]>();
  if (!shows.length) return out;
  const rows: (ShowAd & { showId: string; activatedAt: Date | null; hasImage: boolean; updatedAt: Date })[] = await m.query(
    `SELECT o.id AS "showId", a.id, a."creativeId", a.kind, a."activatedAt", c.title, c."offerText", c."hasImage", c."updatedAt", adv."businessName"
       FROM show_occurrences o
       JOIN ads a ON a."stationId" = o."stationId"
        AND ((a."programmeId" = o."programmeId" AND o."airDate" BETWEEN a."startDate" AND a."endDate") OR a."showOccurrenceId" = o.id)
       JOIN ad_creatives c ON c.id = a."creativeId"
       JOIN advertisers adv ON adv.id = a."advertiserId"
      WHERE o.id = ANY($1) AND ${RUNNABLE_AD('a')}
      ORDER BY a."checkedAt", a."createdAt"`,
    [shows.map((s) => s.id)],
  );
  for (const show of shows) {
    const started = show.startsAt <= now;
    const mine = rows.filter((r) => r.showId === show.id);
    const card = (r: (typeof rows)[number]): ShowAd => ({
      id: r.id,
      creativeId: r.creativeId,
      kind: r.kind,
      title: r.title,
      offerText: r.offerText,
      businessName: r.businessName,
      imageVersion: r.hasImage ? new Date(r.updatedAt).getTime().toString() : null,
    });
    const list: ShowAd[] = [];
    const shout = mine
      .filter((r) => r.kind === 'shoutout' && r.activatedAt && new Date(r.activatedAt) <= now)
      .sort((x, y) => new Date(y.activatedAt!).getTime() - new Date(x.activatedAt!).getTime())[0];
    if (shout) list.push(card(shout));
    list.push(...mine.filter((r) => r.kind === 'sponsored').slice(0, MAX_SPONSORED_PER_SHOW).map(card));
    if (started) list.push(...mine.filter((r) => r.kind === 'aired').map(card));
    if (list.length) out.set(show.id, list);
  }
  return out;
}

