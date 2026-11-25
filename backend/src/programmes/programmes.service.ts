
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { VISIBLE_PROGRAMME } from '../orgs/visibility';
import { Programme } from '../programme.entity';
import { ProgrammeRj } from '../programme-rj.entity';
import { toPublicRj } from '../rjs/public-rj';
import { ProgrammeSchedule } from '../programme-schedule.entity';
import { slotLabel, sortSlots } from './schedule-rules';

@Injectable()
export class ProgrammesService {
  constructor(
    @InjectRepository(Programme)
    private readonly programmeRepository: Repository<Programme>,
    @InjectRepository(ProgrammeRj)
    private readonly programmeRjRepository: Repository<ProgrammeRj>,
    @InjectRepository(ProgrammeSchedule)
    private readonly scheduleRepository: Repository<ProgrammeSchedule>,
  ) {}

  /** Public: active programmes listeners may see (not hidden by station, network or the NowRJ team). */
  async findAll() {
    return this.attachRjs(await this.visible('true', []));
  }

  async findByStation(stationId: string) {
    return this.attachRjs(await this.visible('p."stationId" = $1', [stationId]));
  }

  private async visible(where: string, params: unknown[]) {
    const rows: { id: string }[] = await this.programmeRepository.query(
      `SELECT p.id FROM programmes p WHERE p."isActive" = true AND ${VISIBLE_PROGRAMME('p')} AND ${where} ORDER BY p.name`,
      params,
    );
    if (!rows.length) return [];
    const byId = new Map(
      (await this.programmeRepository.find({ where: { id: In(rows.map((r) => r.id)) } })).map((p) => [p.id, p]),
    );
    return rows.map((r) => byId.get(r.id)!).filter(Boolean);
  }

  private async attachRjs(programmes: Programme[]) {
    if (!programmes.length) return [];
    const assignments = await this.programmeRjRepository.find({
      where: programmes.map((programme) => ({
        programmeId: programme.id,
      })),
      relations: { rj: true },
    });

    const rjsByProgramme = new Map<string, ProgrammeRj[]>();

    for (const assignment of assignments) {
      const existing = rjsByProgramme.get(assignment.programmeId) ?? [];
      existing.push(assignment);
      rjsByProgramme.set(assignment.programmeId, existing);
    }

    const slots = programmes.length
      ? await this.scheduleRepository.find({
          where: programmes.map((programme) => ({
            programmeId: programme.id,
            validTo: IsNull(),
          })),
        })
      : [];

    return programmes.map((programme) => {
      const schedule = sortSlots(
        slots.filter((slot) => slot.programmeId === programme.id),
      ).map((slot) => ({
        days: slot.daysOfWeek,
        startTime: slot.startTime.slice(0, 5),
        endTime: slot.endTime.slice(0, 5),
        label: slotLabel(slot),
      }));

      return {
        ...programme,
        // Only RJs listeners may see (active, verified, not suspended).
        rjs: (rjsByProgramme.get(programme.id) ?? [])
          .filter(({ rj }) => rj.isActive && (rj.verificationStatus === 'verified' || rj.verificationStatus === 'legacy') && !rj.suspendedAt)
          .map((assignment) => toPublicRj(assignment.rj)),
        schedule,
        /** All current time slots, e.g. "Mon–Fri 07:00–10:00 · Sat 09:00–11:00". */
        scheduleText: schedule.map((slot) => slot.label).join(' · ') || null,
      };
    });
  }
}
