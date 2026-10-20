import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Programme } from '../programme.entity';
import { ProgrammeRj } from '../programme-rj.entity';
import { ProgrammeSchedule } from '../programme-schedule.entity';
import { ScheduleException } from '../schedule-exception.entity';
import { Rj } from '../rj.entity';
import { UserRole } from '../user-role.entity';
import { addDays, indiaDate, planShows } from './occurrence-rules';
import { ShowsService } from './shows.service';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const CHANGE_DAYS_AHEAD = 7;

/** Cancelling or moving one day's show, by the hosting RJs or the owning station. */
@Injectable()
export class ShowChangesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly shows: ShowsService,
  ) {}

  /** Throws unless the listener hosts the programme or represents the station that owns it. */
  private async assertCanChange(listenerId: string, programmeId: string) {
    const programme = await this.dataSource.manager.findOneBy(Programme, { id: programmeId });
    if (!programme) throw new NotFoundException('Programme not found.');
    const rj = await this.dataSource.manager.findOne(Rj, { where: { ownerListener: { id: listenerId } } });
    const hosts = rj
      ? await this.dataSource.manager.existsBy(ProgrammeRj, { programmeId, rjId: rj.id })
      : false;
    const stationRep = programme.ownerStationId
      ? await this.dataSource.manager.existsBy(UserRole, {
          listenerId,
          role: 'station_rep',
          stationId: programme.ownerStationId,
          status: 'active',
        })
      : false;
    if (!hosts && !stationRep) {
      throw new ForbiddenException("Only the programme's hosts or the station that owns it can change its shows.");
    }
    return programme;
  }

  /** The programme's shows for the next 7 days, with any one-day change applied. */
  async upcoming(listenerId: string, programmeId: string, now = new Date()) {
    await this.assertCanChange(listenerId, programmeId);
    const today = indiaDate(now);
    const slots = await this.dataSource.manager.findBy(ProgrammeSchedule, { programmeId });
    const planned = planShows(slots, today, addDays(today, CHANGE_DAYS_AHEAD - 1)).filter(
      (s) => s.endsAt > now,
    );
    const changes = await this.dataSource.manager.findBy(ScheduleException, { programmeId });
    return planned
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((s) => {
        const change = changes.find((c) => c.originalStartsAt.getTime() === s.startsAt.getTime());
        return {
          originalStartsAt: s.startsAt,
          originalEndsAt: s.endsAt,
          airDate: s.airDate,
          status: change?.action === 'cancel' ? 'cancelled' : change?.action === 'move' ? 'moved' : 'scheduled',
          startsAt: change?.action === 'move' ? change.newStartsAt : s.startsAt,
          endsAt: change?.action === 'move' ? change.newEndsAt : s.endsAt,
          reason: change?.reason ?? null,
          started: s.startsAt <= now || Boolean(change?.newStartsAt && change.newStartsAt <= now),
        };
      });
  }

  /** Finds the scheduled show this change is for, and refuses shows that have started. */
  private async plannedShow(programmeId: string, originalStartsAtInput: unknown, now: Date) {
    const original = typeof originalStartsAtInput === 'string' ? new Date(originalStartsAtInput) : null;
    if (!original || Number.isNaN(original.getTime())) throw new BadRequestException('Which show? The start time is missing.');
    const date = indiaDate(original);
    const slots = await this.dataSource.manager.findBy(ProgrammeSchedule, { programmeId });
    const show = planShows(slots, date, date).find((s) => s.startsAt.getTime() === original.getTime());
    if (!show) throw new NotFoundException('That show is not on the schedule.');
    if (show.startsAt <= now) throw new ConflictException('This show has already started, so it can no longer be changed.');
    if (date > addDays(indiaDate(now), CHANGE_DAYS_AHEAD - 1)) {
      throw new BadRequestException(`Shows can be changed up to ${CHANGE_DAYS_AHEAD} days ahead.`);
    }
    return show;
  }

  private cleanReason(value: unknown) {
    const reason = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') || null : null;
    if (reason && reason.length > 280) throw new BadRequestException('Reason is too long (280 characters at most).');
    return reason;
  }

  private async save(programmeId: string, values: Partial<ScheduleException>, listenerId: string, now: Date) {
    const earlier = await this.dataSource.manager.findOneBy(ScheduleException, {
      programmeId,
      originalStartsAt: values.originalStartsAt,
    });
    if (earlier?.newStartsAt && earlier.newStartsAt <= now) {
      throw new ConflictException('The moved show has already started, so it can no longer be changed.');
    }
    await this.dataSource.manager.delete(ScheduleException, { programmeId, originalStartsAt: values.originalStartsAt });
    await this.dataSource.manager.save(
      this.dataSource.manager.create(ScheduleException, { ...values, programmeId, createdByListenerId: listenerId }),
    );
    await this.shows.refreshShows(now, true);
  }

  async cancel(listenerId: string, programmeId: string, body: { originalStartsAt?: string; reason?: string }, now = new Date()) {
    await this.assertCanChange(listenerId, programmeId);
    const show = await this.plannedShow(programmeId, body.originalStartsAt, now);
    await this.save(programmeId, { originalStartsAt: show.startsAt, action: 'cancel', reason: this.cleanReason(body.reason) }, listenerId, now);
    return { status: 'cancelled', originalStartsAt: show.startsAt };
  }

  /** Moves one day's show to new times on the same day (an end before the start runs past midnight). */
  async move(
    listenerId: string,
    programmeId: string,
    body: { originalStartsAt?: string; startTime?: string; endTime?: string; reason?: string },
    now = new Date(),
  ) {
    await this.assertCanChange(listenerId, programmeId);
    const show = await this.plannedShow(programmeId, body.originalStartsAt, now);
    if (!body.startTime || !body.endTime || !TIME.test(body.startTime) || !TIME.test(body.endTime)) {
      throw new BadRequestException('New start and end times must be HH:MM.');
    }
    if (body.startTime === body.endTime) throw new BadRequestException('Start and end time cannot be the same.');
    const startsAt = new Date(`${show.airDate}T${body.startTime}:00+05:30`);
    const endDate = body.endTime <= body.startTime ? addDays(show.airDate, 1) : show.airDate;
    const endsAt = new Date(`${endDate}T${body.endTime}:00+05:30`);
    if (startsAt <= now) throw new BadRequestException('The new start time has already passed.');
    await this.save(
      programmeId,
      { originalStartsAt: show.startsAt, action: 'move', newStartsAt: startsAt, newEndsAt: endsAt, reason: this.cleanReason(body.reason) },
      listenerId,
      now,
    );
    return { status: 'moved', startsAt, endsAt };
  }

  /** Puts a cancelled or moved show back to its scheduled time. */
  async restore(listenerId: string, programmeId: string, body: { originalStartsAt?: string }, now = new Date()) {
    await this.assertCanChange(listenerId, programmeId);
    const show = await this.plannedShow(programmeId, body.originalStartsAt, now);
    const change = await this.dataSource.manager.findOneBy(ScheduleException, { programmeId, originalStartsAt: show.startsAt });
    if (!change) throw new NotFoundException('That show has not been changed.');
    if (change.newStartsAt && change.newStartsAt <= now) {
      throw new ConflictException('The moved show has already started, so it can no longer be changed.');
    }
    await this.dataSource.manager.delete(ScheduleException, { id: change.id });
    await this.shows.refreshShows(now, true);
    return { status: 'scheduled', originalStartsAt: show.startsAt };
  }
}
