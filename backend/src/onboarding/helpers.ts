import { ForbiddenException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { AuditLog } from '../audit-log.entity';
import { Programme } from '../programme.entity';
import { ProgrammeOwnership } from '../programme-ownership.entity';
import { UserRole } from '../user-role.entity';

export const PHONE = /^\+?[0-9][0-9 -]{5,18}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function slugify(value: string, fallback: string): string {
  return (
    value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || fallback
  );
}

export async function writeAudit(
  m: EntityManager,
  actorListenerId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: Record<string, unknown>,
) {
  await m.save(m.create(AuditLog, { actorListenerId, action, entityType, entityId, details: details ?? null }));
}

/** Throws unless the listener is an approved representative of the station. */
export async function assertStationRep(m: EntityManager, listenerId: string, stationId: string) {
  const role = await m.findOneBy(UserRole, {
    listenerId,
    role: 'station_rep',
    stationId,
    status: 'active',
  });
  if (!role) {
    throw new ForbiddenException('You are not an approved representative of this station.');
  }
  return role;
}

/**
 * Hands a programme to a station: closes the current ownership period,
 * opens the station's, and updates the programme's owner.
 */
export async function transferProgrammeToStation(
  m: EntityManager,
  programmeId: string,
  stationId: string,
  opts: { claimId: string | null; changedByListenerId: string | null; reason: 'station_claim' | 'admin_transfer' },
  now = new Date(),
) {
  await m.update(
    ProgrammeOwnership,
    { programmeId, validTo: IsNull() },
    { validTo: now },
  );
  await m.insert(ProgrammeOwnership, {
    programmeId,
    ownerRjId: null,
    ownerStationId: stationId,
    validFrom: now,
    reason: opts.reason,
    changedByListenerId: opts.changedByListenerId,
    claimId: opts.claimId,
  });
  await m.update(
    Programme,
    { id: programmeId },
    { ownerRjId: null, ownerStationId: stationId, stationId },
  );
}
