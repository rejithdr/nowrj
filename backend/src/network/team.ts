import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { stationAccess } from '../orgs/access';
import { meets } from '../orgs/access-rules';
import { RJ_CAN_ACT } from '../rjs/rj-can-act';
import { NETWORK_OFFICE } from './office-sql';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a programme team member looks from: their RJ dashboard, a station, or a network office. */
export type TeamView = { as: 'rj' } | { as: 'station'; stationId: string } | { as: 'network'; organisationId: string };

export function readTeamView(query: { as?: string; stationId?: string; organisationId?: string }): TeamView {
  if (query.as === 'rj') return { as: 'rj' };
  if (query.as === 'station' && typeof query.stationId === 'string' && UUID.test(query.stationId)) return { as: 'station', stationId: query.stationId };
  if (query.as === 'network' && typeof query.organisationId === 'string' && UUID.test(query.organisationId)) {
    return { as: 'network', organisationId: query.organisationId };
  }
  throw new BadRequestException('Say whose inbox: as=rj, as=station&stationId=…, or as=network&organisationId=….');
}

/**
 * SQL (on programmes `p`, listener in $1, extra value in $2) for the
 * programmes this team member sees, and whether they may act (edit).
 * Throws when they have no access from that place.
 */
export async function teamScope(m: EntityManager, listenerId: string, view: TeamView): Promise<{ where: string; params: unknown[]; canEdit: boolean; label: string }> {
  if (view.as === 'rj') {
    const [rj] = await m.query(`SELECT r.name FROM rjs r WHERE r."ownerListenerId" = $1 AND ${RJ_CAN_ACT('r')}`, [listenerId]);
    if (!rj) throw new ForbiddenException('You need an active RJ profile.');
    return {
      where: `EXISTS (SELECT 1 FROM programme_rjs pr JOIN rjs r ON r.id = pr."rjId"
                       WHERE pr."programmeId" = p.id AND r."ownerListenerId" = $1 AND ${RJ_CAN_ACT('r')})`,
      params: [listenerId],
      canEdit: true,
      label: /^rj\b/i.test(rj.name) ? rj.name : `RJ ${rj.name}`,
    };
  }
  if (view.as === 'station') {
    const access = await stationAccess(m, listenerId, view.stationId);
    if (!access || !meets(access.levels.programmes, 'view')) throw new ForbiddenException('You do not have Programmes access at this station.');
    const [s] = await m.query(`SELECT name FROM stations WHERE id = $1`, [view.stationId]);
    return {
      where: `(p."stationId" = $2 OR p."ownerStationId" = $2) AND $1::uuid IS NOT NULL`,
      params: [listenerId, view.stationId],
      canEdit: meets(access.levels.programmes, 'edit'),
      label: s?.name ?? 'The station',
    };
  }
  const [office] = await m.query(
    `SELECT o.name, bool_or(d.programmes IN ('edit', 'authorise')) AS edit,
            CASE WHEN bool_or(om."unitId" IS NULL) THEN NULL ELSE min(u.name) END AS "unitName"
       FROM org_members om JOIN organisations o ON o.id = om."organisationId" AND o."isActive" AND o.kind = 'network'
       JOIN designations d ON d.id = om."designationId"
       LEFT JOIN org_units u ON u.id = om."unitId"
      WHERE om."listenerId" = $1 AND om."organisationId" = $2 AND om.status = 'active' AND d.programmes <> 'none'
      GROUP BY o.name`,
    [listenerId, view.organisationId],
  );
  if (!office) throw new ForbiddenException('You do not work at an office of this network.');
  return {
    where: `p."networkProgrammeId" IN (SELECT id FROM network_programmes WHERE "organisationId" = $2)
            AND ${NETWORK_OFFICE('p."networkProgrammeId"', 'view')}`,
    params: [listenerId, view.organisationId],
    canEdit: Boolean(office.edit),
    label: office.unitName ? `${office.name} · ${office.unitName} office` : `${office.name} head office`,
  };
}
