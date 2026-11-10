import { EntityManager } from 'typeorm';

const HOUR = 3600 * 1000;
/** Questions for a guest open 24 hours before the recording... */
export const GUEST_OPENS_BEFORE_MS = 24 * HOUR;
/** ...and close 2 hours before it. */
export const GUEST_CLOSES_BEFORE_MS = 2 * HOUR;
export const MAX_GUEST_QUESTIONS = 3;

export function guestWindow(recordingAt: Date) {
  return {
    opensAt: new Date(recordingAt.getTime() - GUEST_OPENS_BEFORE_MS),
    closesAt: new Date(recordingAt.getTime() - GUEST_CLOSES_BEFORE_MS),
  };
}

/** True while listeners may send questions for this guest session. */
export function guestQuestionsOpen(session: { recordingAt: Date; status: string }, now: Date) {
  const { opensAt, closesAt } = guestWindow(session.recordingAt);
  return session.status === 'scheduled' && now >= opensAt && now < closesAt;
}

/**
 * Who may set up a guest session for a programme and handle its questions:
 * an RJ hosting the programme, or an approved representative of the station
 * it airs on or that owns it.
 */
export async function canManageProgramme(m: EntityManager, listenerId: string, programmeId: string): Promise<boolean> {
  const [row] = await m.query(
    `
    SELECT EXISTS (
             SELECT 1 FROM programme_rjs pr JOIN rjs r ON r.id = pr."rjId"
              WHERE pr."programmeId" = p.id AND r."ownerListenerId" = $1
           )
        OR EXISTS (
             SELECT 1 FROM user_roles ur
              WHERE ur."listenerId" = $1 AND ur.role = 'station_rep' AND ur.status = 'active'
                AND ur."stationId" IN (p."stationId", p."ownerStationId")
           ) AS allowed
      FROM programmes p
     WHERE p.id = $2
    `,
    [listenerId, programmeId],
  );
  return Boolean(row?.allowed);
}
