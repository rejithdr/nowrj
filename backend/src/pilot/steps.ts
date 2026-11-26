import type { Request, Response } from 'express';
import type { EntityManager } from 'typeorm';
import { ensureDeviceId, readDeviceId, signedInId } from '../device';

export type PilotStep = 'open' | 'tap' | 'signin_prompt' | 'signin' | 'message' | 'ad_open' | 'share' | 'share_open';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Counts one pilot step for this person today (India time). The person is
 * the phone's device id when there is one, else the signed-in account.
 * Never throws: analytics must not break what the listener is doing.
 */
export async function recordStep(
  m: EntityManager,
  req: Request,
  step: PilotStep,
  where: { showId?: unknown; adId?: unknown; programmeId?: unknown; path?: unknown; listenerId?: string | null; res?: Response } = {},
) {
  try {
    const listenerId = where.listenerId ?? signedInId(req);
    const deviceId = where.res ? ensureDeviceId(req, where.res) : readDeviceId(req);
    const person = deviceId ?? listenerId;
    if (!person) return;
    let stationId: string | null = null;
    let adId: string | null = null;
    if (typeof where.adId === 'string' && UUID.test(where.adId)) {
      const [ad] = await m.query(`SELECT id, "stationId" FROM ads WHERE id = $1`, [where.adId]);
      if (ad) {
        adId = ad.id;
        stationId = ad.stationId;
      }
    } else if (typeof where.showId === 'string' && UUID.test(where.showId)) {
      const [show] = await m.query(`SELECT "stationId" FROM show_occurrences WHERE id = $1`, [where.showId]);
      stationId = show?.stationId ?? null;
    } else if (typeof where.programmeId === 'string' && UUID.test(where.programmeId)) {
      const [p] = await m.query(`SELECT "stationId" FROM programmes WHERE id = $1`, [where.programmeId]);
      stationId = p?.stationId ?? null;
    } else if (typeof where.path === 'string') {
      // A shared page: /programme/<slug> or /station/<slug> tells us the station.
      const hit = /^\/(programme|station)\/([a-z0-9-]{1,200})$/.exec(where.path);
      if (hit) {
        const [row] =
          hit[1] === 'programme'
            ? await m.query(`SELECT "stationId" FROM programmes WHERE slug = $1`, [hit[2]])
            : await m.query(`SELECT id AS "stationId" FROM stations WHERE slug = $1`, [hit[2]]);
        stationId = row?.stationId ?? null;
      }
    }
    await m.query(
      `INSERT INTO pilot_steps ("day", step, person, "deviceId", "listenerId", "stationId", "adId")
       VALUES ((now() AT TIME ZONE 'Asia/Kolkata')::date, $1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [step, person, deviceId, listenerId, stationId, adId],
    );
  } catch {
    /* analytics only */
  }
}
