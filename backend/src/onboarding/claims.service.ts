import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, IsNull } from 'typeorm';
import { Programme } from '../programme.entity';
import { ProgrammeClaim } from '../programme-claim.entity';
import { ProgrammeSchedule } from '../programme-schedule.entity';
import { Rj } from '../rj.entity';
import { Station } from '../station.entity';
import { RjStationAffiliation } from '../rj-station-affiliation.entity';
import { describeDays, sortSlots } from '../programmes/schedule-rules';
import { assertStationRep, clean, PHONE, transferProgrammeToStation, writeAudit } from './helpers';

const OPEN = ['awaiting_rj', 'rejected_by_rj'] as const;

/** Stations claiming programmes, and RJs deciding on those claims. */
@Injectable()
export class ClaimsService {
  constructor(private readonly dataSource: DataSource) {}

  // ------------------------------------------------------------ station side

  async stationProgrammes(listenerId: string, stationId: string) {
    const m = this.dataSource.manager;
    await assertStationRep(m, listenerId, stationId);

    const programmes = await m.find(Programme, { where: { stationId }, order: { name: 'ASC' } });
    if (!programmes.length) return [];
    const ids = programmes.map((p) => p.id);

    const owners = await m.findBy(Rj, {
      id: In(programmes.map((p) => p.ownerRjId).filter((id): id is string => Boolean(id))),
    });
    const claims = await m.find(ProgrammeClaim, {
      where: { programmeId: In(ids) },
      order: { createdAt: 'DESC' },
    });
    const slots = await m.findBy(ProgrammeSchedule, { programmeId: In(ids), validTo: IsNull() });

    return programmes.map((p) => {
      const latest = claims.find((c) => c.programmeId === p.id) ?? null;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        isActive: p.isActive,
        callInPhone: p.callInPhone,
        ownedByStation: p.ownerStationId === stationId,
        ownerRjName: owners.find((rj) => rj.id === p.ownerRjId)?.name ?? null,
        schedule: sortSlots(slots.filter((s) => s.programmeId === p.id))
          .map((s) => `${describeDays(s.daysOfWeek)} ${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`)
          .join(' · '),
        latestClaim: latest
          ? { id: latest.id, status: latest.status, rjReason: latest.rjReason, adminReason: latest.adminReason }
          : null,
      };
    });
  }

  async createClaim(listenerId: string, stationId: string, programmeId: string) {
    return this.dataSource.transaction(async (m) => {
      await assertStationRep(m, listenerId, stationId);
      const programme = await m.findOneBy(Programme, { id: programmeId });
      if (!programme || programme.stationId !== stationId) {
        throw new NotFoundException('That programme is not on your station.');
      }
      if (!programme.ownerRjId) {
        throw new ConflictException('Your station already owns this programme.');
      }
      const open = await m.findOneBy(ProgrammeClaim, { programmeId, status: In([...OPEN]) });
      if (open) throw new ConflictException('A claim for this programme is already in progress.');

      const claim = await m.save(
        m.create(ProgrammeClaim, { programmeId, stationId, requestedByListenerId: listenerId, status: 'awaiting_rj' }),
      );
      await writeAudit(m, listenerId, 'claim.created', 'programme_claim', claim.id, { programmeId, stationId });
      return { id: claim.id, status: claim.status };
    });
  }

  /** The owning station may change its programmes' call-in numbers. */
  async stationUpdateCallIn(listenerId: string, stationId: string, programmeId: string, value: unknown) {
    const callInPhone = clean(value);
    if (callInPhone && !PHONE.test(callInPhone)) {
      throw new BadRequestException('Call-in number must be 6 to 19 digits, optionally starting with +.');
    }
    const m = this.dataSource.manager;
    await assertStationRep(m, listenerId, stationId);
    const programme = await m.findOneBy(Programme, { id: programmeId });
    if (!programme || programme.ownerStationId !== stationId) {
      throw new ForbiddenException('Only programmes your station owns can be changed here.');
    }
    await m.update(Programme, { id: programmeId }, { callInPhone });
    return { id: programmeId, callInPhone };
  }

  /** RJs who say they work or worked at this station, newest first. */
  async stationRjs(listenerId: string, stationId: string) {
    await assertStationRep(this.dataSource.manager, listenerId, stationId);
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT a.id, a."joinedOn"::text AS "joinedOn", a."leftOn"::text AS "leftOn", a."verificationStatus", a."stationNote",
              r.name, r.slug, r."verificationStatus" AS "rjStatus"
         FROM rj_station_affiliations a JOIN rjs r ON r.id = a."rjId"
        WHERE a."stationId" = $1
        ORDER BY (a."leftOn" IS NULL) DESC, a."joinedOn" DESC`,
      [stationId],
    );
    return rows;
  }

  /** The station confirms an RJ's time there, or disputes it with a reason. */
  async decideAffiliation(listenerId: string, stationId: string, affiliationId: string, confirm: boolean, noteInput: unknown) {
    const note = clean(noteInput);
    if (!confirm && !note) throw new BadRequestException('Say what is wrong, so the RJ can correct it.');
    if (note && note.length > 280) throw new BadRequestException('Note is too long (280 characters at most).');
    return this.dataSource.transaction(async (m) => {
      await assertStationRep(m, listenerId, stationId);
      const row = await m.findOneBy(RjStationAffiliation, { id: affiliationId, stationId });
      if (!row) throw new NotFoundException('That RJ is not listed at your station.');
      row.verificationStatus = confirm ? 'verified' : 'disputed';
      row.stationNote = note;
      row.verifiedByListenerId = listenerId;
      row.verifiedAt = new Date();
      await m.save(row);
      await writeAudit(m, listenerId, confirm ? 'affiliation.confirmed' : 'affiliation.disputed', 'rj_station_affiliation', row.id, {
        stationId,
        rjId: row.rjId,
        note,
      });
      return { id: row.id, verificationStatus: row.verificationStatus };
    });
  }

  // ----------------------------------------------------------------- RJ side

  private async ownRj(listenerId: string) {
    const rj = await this.dataSource.manager.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
    if (!rj) throw new NotFoundException('Register your RJ profile first.');
    return rj;
  }

  /** Claims made on programmes this RJ created or owns, newest first. */
  async rjClaims(listenerId: string) {
    const rj = await this.ownRj(listenerId);
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `
      SELECT c.id, c.status, c."rjReason", c."adminReason", c."createdAt",
             p.id AS "programmeId", p.name AS "programmeName", s.name AS "stationName",
             (p."ownerRjId" = $1) AS "youOwnIt"
      FROM programme_claims c
      JOIN programmes p ON p.id = c."programmeId"
      JOIN stations s ON s.id = c."stationId"
      WHERE p."ownerRjId" = $1 OR p."createdByRjId" = $1
      ORDER BY c."createdAt" DESC
      `,
      [rj.id],
    );
    return rows;
  }

  async rjDecide(listenerId: string, claimId: string, approve: boolean, reasonInput: unknown) {
    const reason = clean(reasonInput);
    if (!approve && !reason) {
      throw new BadRequestException('Say why you are rejecting the claim. The NowRJ team will review it.');
    }
    if (reason && reason.length > 500) throw new BadRequestException('Reason is too long.');

    return this.dataSource.transaction(async (m) => {
      const rj = await m.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
      if (!rj) throw new NotFoundException('Register your RJ profile first.');
      const claim = await m.findOne(ProgrammeClaim, { where: { id: claimId }, lock: { mode: 'pessimistic_write' } });
      if (!claim) throw new NotFoundException('Claim not found.');
      const programme = await m.findOneBy(Programme, { id: claim.programmeId });
      if (!programme || programme.ownerRjId !== rj.id) {
        throw new ForbiddenException('Only the RJ who owns the programme can decide on this claim.');
      }
      if (claim.status !== 'awaiting_rj') throw new ConflictException('This claim has already been decided.');

      claim.rjDecisionAt = new Date();
      claim.rjDecisionByListenerId = listenerId;
      claim.rjReason = reason;
      if (approve) {
        claim.status = 'approved_by_rj';
        await m.save(claim);
        await transferProgrammeToStation(m, programme.id, claim.stationId, {
          claimId: claim.id,
          changedByListenerId: listenerId,
          reason: 'station_claim',
        });
      } else {
        claim.status = 'rejected_by_rj';
        await m.save(claim);
      }
      await writeAudit(m, listenerId, approve ? 'claim.approved_by_rj' : 'claim.rejected_by_rj', 'programme_claim', claim.id, {
        programmeId: programme.id,
        stationId: claim.stationId,
        reason,
      });
      return { id: claim.id, status: claim.status };
    });
  }

  // -------------------------------------------------------------- admin side

  /** Claims the RJ rejected, waiting for a Super Admin decision. */
  async adminClaims() {
    const rows: Record<string, unknown>[] = await this.dataSource.query(`
      SELECT c.id, c.status, c."rjReason", c."createdAt", c."rjDecisionAt",
             p.name AS "programmeName", p.slug AS "programmeSlug",
             s.name AS "stationName", r.name AS "rjName"
      FROM programme_claims c
      JOIN programmes p ON p.id = c."programmeId"
      JOIN stations s ON s.id = c."stationId"
      LEFT JOIN rjs r ON r.id = p."ownerRjId"
      WHERE c.status = 'rejected_by_rj'
      ORDER BY c."rjDecisionAt"
    `);
    return rows;
  }

  async adminDecide(adminId: string, claimId: string, approve: boolean, reasonInput: unknown) {
    const reason = clean(reasonInput);
    if (reason && reason.length > 500) throw new BadRequestException('Reason is too long.');
    return this.dataSource.transaction(async (m) => {
      const claim = await m.findOne(ProgrammeClaim, { where: { id: claimId }, lock: { mode: 'pessimistic_write' } });
      if (!claim) throw new NotFoundException('Claim not found.');
      if (claim.status !== 'rejected_by_rj') throw new ConflictException('This claim is not waiting for a Super Admin.');
      const station = await m.findOneBy(Station, { id: claim.stationId });
      if (approve && (!station || !station.isActive)) {
        throw new ConflictException('The station is not active, so it cannot take the programme.');
      }

      claim.adminDecisionAt = new Date();
      claim.adminDecisionByListenerId = adminId;
      claim.adminReason = reason;
      claim.status = approve ? 'approved_by_admin' : 'rejected_by_admin';
      await m.save(claim);
      if (approve) {
        await transferProgrammeToStation(m, claim.programmeId, claim.stationId, {
          claimId: claim.id,
          changedByListenerId: adminId,
          reason: 'station_claim',
        });
      }
      await writeAudit(m, adminId, approve ? 'claim.approved_by_admin' : 'claim.rejected_by_admin', 'programme_claim', claim.id, {
        programmeId: claim.programmeId,
        stationId: claim.stationId,
        reason,
      });
      return { id: claim.id, status: claim.status };
    });
  }
}
