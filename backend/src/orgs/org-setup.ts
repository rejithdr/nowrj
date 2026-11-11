import { EntityManager } from 'typeorm';
import { Station } from '../station.entity';
import { Designation, Organisation, OrgMember, OrgUnit } from './entities';

export const STATION_ADMIN = 'Station admin';
export const HEAD_OFFICE_ADMIN = 'Head office admin';

/** Full levels on every area, and staff management. */
export const FULL_LEVELS = {
  programmes: 'authorise',
  rjs: 'authorise',
  adsSponsored: 'authorise',
  adsShoutout: 'authorise',
  adsAired: 'authorise',
  stats: 'view',
  manageStaff: true,
  rank: 1,
} as const;

/**
 * The organisation a station belongs to. A station without one (for example
 * a new station whose application was just approved) becomes a standalone
 * organisation with a station unit and a "Station admin" designation.
 */
export async function ensureStationOrganisation(m: EntityManager, station: Station, actorListenerId: string | null) {
  if (station.organisationId) {
    const existing = await m.findOneBy(Organisation, { id: station.organisationId });
    if (existing) return existing;
  }
  const org = await m.save(
    m.create(Organisation, { name: station.name, kind: 'standalone', createdByListenerId: actorListenerId }),
  );
  await m.save(m.create(OrgUnit, { organisationId: org.id, kind: 'station', name: station.name, stationId: station.id, parentId: null }));
  await m.save(m.create(Designation, { organisationId: org.id, name: STATION_ADMIN, ...FULL_LEVELS }));
  await m.update(Station, { id: station.id }, { organisationId: org.id });
  station.organisationId = org.id;
  return org;
}

/**
 * Makes an approved station representative a "Station admin" at the
 * station. Someone already on the organisation's staff keeps what they have.
 */
export async function addStationAdmin(m: EntityManager, station: Station, listenerId: string, actorListenerId: string | null) {
  const org = await ensureStationOrganisation(m, station, actorListenerId);
  const existing = await m.findOneBy(OrgMember, { organisationId: org.id, listenerId, status: 'active' });
  if (existing) return existing;
  // In a standalone organisation the head office is the station itself.
  const unit = org.kind === 'standalone' ? null : await m.findOneByOrFail(OrgUnit, { stationId: station.id });
  let designation = await m
    .createQueryBuilder(Designation, 'd')
    .where('d."organisationId" = :org AND lower(d.name) = lower(:name)', { org: org.id, name: STATION_ADMIN })
    .getOne();
  if (!designation) {
    designation = await m.save(m.create(Designation, { organisationId: org.id, name: STATION_ADMIN, ...FULL_LEVELS }));
  }
  return m.save(
    m.create(OrgMember, {
      organisationId: org.id,
      listenerId,
      unitId: unit?.id ?? null,
      designationId: designation.id,
      status: 'active',
      addedByListenerId: actorListenerId,
    }),
  );
}
