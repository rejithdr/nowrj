import type { Level } from './entities';

/** The areas a designation gives a level for. Stats only has none or view. */
export const AREAS = ['programmes', 'rjs', 'adsSponsored', 'adsShoutout', 'adsAired', 'stats'] as const;
export type Area = (typeof AREAS)[number];
export const LEVELS: Level[] = ['none', 'view', 'edit', 'authorise'];

export const AREA_LABEL: Record<Area, string> = {
  programmes: 'Programmes',
  rjs: 'RJs',
  adsSponsored: 'Ads – Sponsored',
  adsShoutout: 'Ads – Shout-out',
  adsAired: 'Ads – Aired spots',
  stats: 'Stats',
};

const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2, authorise: 3 };

/** Levels are cumulative: Authorise includes Edit, Edit includes View. */
export function meets(have: Level | null | undefined, need: Level): boolean {
  return RANK[have ?? 'none'] >= RANK[need];
}

export function isLevel(value: unknown, area: Area): value is Level {
  if (area === 'stats') return value === 'none' || value === 'view';
  return typeof value === 'string' && (LEVELS as string[]).includes(value);
}

/**
 * SQL that is true when listener $1 has at least `need` on `area` at the
 * station in `stationExpr`. For use inside larger queries.
 */
export function accessSql(stationExpr: string, area: Area, need: Level, listenerParam = '$1') {
  const allowed = LEVELS.filter((l) => meets(l, need)).map((l) => `'${l}'`).join(',');
  return `EXISTS (SELECT 1 FROM station_access sa WHERE sa."listenerId" = ${listenerParam} AND sa."stationId" = ${stationExpr} AND sa."${area}" IN (${allowed}))`;
}

/**
 * Units form a tree. Returns true when making `parentId` the parent of
 * `unitId` would put a unit underneath itself.
 */
export function wouldCreateCycle(units: { id: string; parentId: string | null }[], unitId: string, parentId: string | null): boolean {
  const parentOf = new Map(units.map((u) => [u.id, u.parentId]));
  let cursor = parentId;
  for (let steps = 0; cursor && steps <= units.length; steps++) {
    if (cursor === unitId) return true;
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}

/** True when `unitId` is `scopeUnitId` or sits underneath it. No scope means the whole organisation. */
export function withinScope(units: { id: string; parentId: string | null }[], scopeUnitId: string | null, unitId: string | null): boolean {
  if (scopeUnitId === null) return true;
  if (unitId === null) return false;
  const parentOf = new Map(units.map((u) => [u.id, u.parentId]));
  let cursor: string | null = unitId;
  for (let steps = 0; cursor && steps <= units.length; steps++) {
    if (cursor === scopeUnitId) return true;
    cursor = parentOf.get(cursor) ?? null;
  }
  return false;
}
