import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Station } from '../station.entity';

@Injectable()
export class StationsService {
  constructor(
    @InjectRepository(Station)
    private readonly stationRepository: Repository<Station>,
  ) {}

  /** Public list: verified (or legacy) stations, without private contact details. */
  findAll() {
    return this.stationRepository.find({
      where: { verificationStatus: In(['verified', 'legacy']) },
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
