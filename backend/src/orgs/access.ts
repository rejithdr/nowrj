import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { Level } from './entities';
import { AREAS, AREA_LABEL, meets } from './access-rules';
import type { Area } from './access-rules';

export * from './access-rules';

export type StationAccess = {
  stationId: string;
  organisationId: string;
  memberId: string;
  unitId: string | null;
  designationId: string;
  designationName: string;
  manageStaff: boolean;
  levels: Record<Area, Level>;
};

type AccessRow = Record<Area, Level> & {
  stationId: string;
  organisationId: string;
  memberId: string;
  unitId: string | null;
  designationId: string;
  designationName: string;
  manageStaff: boolean;
};

function toAccess(row: AccessRow): StationAccess {
  return {
    stationId: row.stationId,
    organisationId: row.organisationId,
    memberId: row.memberId,
    unitId: row.unitId,
    designationId: row.designationId,
    designationName: row.designationName,
    manageStaff: row.manageStaff,
    levels: Object.fromEntries(AREAS.map((a) => [a, row[a]])) as Record<Area, Level>,
  };
}

/** What this person may do at this station, or null when they have no access. */
export async function stationAccess(m: EntityManager, listenerId: string, stationId: string): Promise<StationAccess | null> {
  const [row] = (await m.query(`SELECT * FROM station_access WHERE "listenerId" = $1 AND "stationId" = $2 LIMIT 1`, [
    listenerId,
    stationId,
  ])) as AccessRow[];
  return row ? toAccess(row) : null;
}

/** Every station this person has access to, with their levels there. */
export async function allStationAccess(m: EntityManager, listenerId: string): Promise<StationAccess[]> {
  const rows = (await m.query(`SELECT * FROM station_access WHERE "listenerId" = $1`, [listenerId])) as AccessRow[];
  return rows.map(toAccess);
}

/**
 * The single check behind every station action. Throws unless the person's
 * designation gives at least `need` on `area` at this station.
 */
export async function assertStationAccess(
  m: EntityManager,
  listenerId: string,
  stationId: string,
  area: Area,
  need: Level,
): Promise<StationAccess> {
  const access = await stationAccess(m, listenerId, stationId);
  if (!access) throw new ForbiddenException('You are not staff at this station.');
  if (!meets(access.levels[area], need)) {
    throw new ForbiddenException(`Your designation (${access.designationName}) does not allow this. It needs ${need} on ${AREA_LABEL[area]}.`);
  }
  return access;
}

/** True when the person has at least `need` on `area` at this station. */
export async function hasStationAccess(m: EntityManager, listenerId: string, stationId: string | null, area: Area, need: Level) {
  if (!stationId) return false;
  const access = await stationAccess(m, listenerId, stationId);
  return Boolean(access && meets(access.levels[area], need));
}

