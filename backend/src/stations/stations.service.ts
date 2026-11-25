import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Station } from '../station.entity';

@Injectable()
export class StationsService {
  constructor(
    @InjectRepository(Station)
    private readonly stationRepository: Repository<Station>,
  ) {}

  /** Public list: verified (or legacy) stations not hidden from listeners, without private contact details. */
  async findAll() {
    const hidden: { id: string }[] = await this.stationRepository.query(`SELECT id FROM hidden_stations`);
    return this.stationRepository.find({
      where: { verificationStatus: In(['verified', 'legacy']), ...(hidden.length ? { id: Not(In(hidden.map((h) => h.id))) } : {}) },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        state: true,
        isActive: true,
        reach: true,
        cityType: true,
      },
      order: { name: 'ASC' },
    });
  }
}
