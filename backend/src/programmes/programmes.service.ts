
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Programme } from '../programme.entity';
import { ProgrammeRj } from '../programme-rj.entity';

@Injectable()
export class ProgrammesService {
  constructor(
    @InjectRepository(Programme)
    private readonly programmeRepository: Repository<Programme>,
    @InjectRepository(ProgrammeRj)
    private readonly programmeRjRepository: Repository<ProgrammeRj>,
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

    return programmes.map((programme) => ({
      ...programme,
      rjs: (rjsByProgramme.get(programme.id) ?? []).map(
        (assignment) => assignment.rj,
      ),
    }));
  }
}
