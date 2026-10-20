
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
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

  async findAll() {
    const programmes = await this.programmeRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    return this.attachRjs(programmes);
  }

  async findByStation(stationId: string) {
    const programmes = await this.programmeRepository.find({
      where: { stationId, isActive: true },
      order: { name: 'ASC' },
    });

    return this.attachRjs(programmes);
  }

  private async attachRjs(programmes: Programme[]) {
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
        rjs: (rjsByProgramme.get(programme.id) ?? []).map(
          (assignment) => toPublicRj(assignment.rj),
        ),
        schedule,
        /** All current time slots, e.g. "Mon–Fri 07:00–10:00 · Sat 09:00–11:00". */
        scheduleText: schedule.map((slot) => slot.label).join(' · ') || null,
      };
    });
  }
}
