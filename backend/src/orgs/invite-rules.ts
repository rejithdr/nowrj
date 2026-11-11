import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';

export const INVITE_DAYS = 14;

/** Hides most of an email address: rejith@gmail.com → re****@gmail.com */
export function emailHint(email: string) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(name.length - 2, 2))}@${domain}`;
}

/** Decision 5: in a network, RJs join a station only through its invite. */
export async function assertNotNetworkStation(m: EntityManager, stationId: string) {
  const [row] = await m.query(
    `SELECT o.name FROM stations s JOIN organisations o ON o.id = s."organisationId" WHERE s.id = $1 AND o.kind = 'network'`,
    [stationId],
  );
  if (row) throw new ForbiddenException(`This station is part of ${row.name}. Ask its staff to invite you.`);
}
