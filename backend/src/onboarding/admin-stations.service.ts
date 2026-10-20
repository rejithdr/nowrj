import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { Programme } from '../programme.entity';
import { Station } from '../station.entity';
import { StationInvite } from '../station-invite.entity';
import { UserRole } from '../user-role.entity';
import { clean, writeAudit } from './helpers';

/** Super Admin review of stations and their representatives. */
@Injectable()
export class AdminStationsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Representatives waiting for approval, with what they applied for. */
  async pendingReps() {
    const rows: Record<string, unknown>[] = await this.dataSource.query(`
      SELECT ur.id AS "roleId", ur."createdAt",
             l."displayName" AS "applicantName", l.email AS "applicantEmail",
             s.id AS "stationId", s.name AS "stationName", s.city, s.state, s.reach,
             s."verificationStatus" AS "stationStatus", s."contactPhone", s."contactEmail",
             (SELECT json_agg(json_build_object('rjName', r.name, 'invitedName', i."stationName"))
                FROM station_invites i JOIN rjs r ON r.id = i."invitedByRjId"
               WHERE i."stationId" = s.id AND i.status = 'sent') AS invites,
             (SELECT count(*)::int FROM programmes p
                JOIN station_invites i ON i.id = p."stationInviteId"
               WHERE i."stationId" = s.id AND p."stationId" IS NULL) AS "waitingProgrammes"
      FROM user_roles ur
      JOIN listeners l ON l.id = ur."listenerId"
      JOIN stations s ON s.id = ur."stationId"
      WHERE ur.role = 'station_rep' AND ur.status = 'pending'
      ORDER BY ur."createdAt"
    `);
    return rows;
  }

  async approveRep(adminId: string, roleId: string, now = new Date()) {
    return this.dataSource.transaction(async (m) => {
      const role = await m.findOne(UserRole, { where: { id: roleId }, lock: { mode: 'pessimistic_write' } });
      if (!role || role.role !== 'station_rep') throw new NotFoundException('Application not found.');
      if (role.status !== 'pending') throw new ConflictException('This application has already been decided.');
      const station = await m.findOneByOrFail(Station, { id: role.stationId! });

      role.status = 'active';
      role.grantedByListenerId = adminId;
      role.grantedAt = now;
      await m.save(role);

      if (station.verificationStatus === 'pending' || station.verificationStatus === 'rejected') {
        station.verificationStatus = 'verified';
        station.isActive = true;
        await m.save(station);
      }

      // Invites used for this station are now accepted; their programmes join the station.
      const invites = await m.findBy(StationInvite, { stationId: station.id, status: 'sent' });
      if (invites.length) {
        await m.update(StationInvite, { id: In(invites.map((i) => i.id)) }, { status: 'accepted', respondedAt: now });
        await m.update(
          Programme,
          { stationInviteId: In(invites.map((i) => i.id)), stationId: IsNull() },
          { stationId: station.id },
        );
      }

      await writeAudit(m, adminId, 'station_rep.approved', 'user_role', role.id, {
        stationId: station.id,
        invitesAccepted: invites.length,
      });
      return { roleId: role.id, stationId: station.id, stationName: station.name };
    });
  }

  async rejectRep(adminId: string, roleId: string, reasonInput: unknown) {
    const reason = clean(reasonInput);
    return this.dataSource.transaction(async (m) => {
      const role = await m.findOne(UserRole, { where: { id: roleId }, lock: { mode: 'pessimistic_write' } });
      if (!role || role.role !== 'station_rep') throw new NotFoundException('Application not found.');
      if (role.status !== 'pending') throw new ConflictException('This application has already been decided.');

      role.status = 'revoked';
      role.note = reason;
      await m.save(role);

      const station = await m.findOneByOrFail(Station, { id: role.stationId! });
      const others = await m.countBy(UserRole, { stationId: station.id, status: Not('revoked') });
      if (station.verificationStatus === 'pending' && others === 0) {
        station.verificationStatus = 'rejected';
        await m.save(station);
      }
      // Free the invites so the right person at the station can still use them.
      await m.update(StationInvite, { stationId: station.id, status: 'sent' }, { stationId: null });

      await writeAudit(m, adminId, 'station_rep.rejected', 'user_role', role.id, { stationId: station.id, reason });
      return { roleId: role.id, status: role.status };
    });
  }

  /** The latest recorded actions, newest first. */
  async auditLog(limit = 50) {
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT a.id, a.action, a."entityType", a."entityId", a.details, a."createdAt", l."displayName" AS actor
         FROM audit_log a LEFT JOIN listeners l ON l.id = a."actorListenerId"
        ORDER BY a."createdAt" DESC LIMIT $1`,
      [Math.min(Math.max(limit, 1), 200)],
    );
    return rows;
  }
}
