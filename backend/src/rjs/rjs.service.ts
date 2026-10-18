
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rj } from '../rj.entity';

@Injectable()
export class RjsService {
  constructor(
    @InjectRepository(Rj)
    private readonly rjRepository: Repository<Rj>,
  ) {}

  // Public: list active RJs
  findAll() {
    return this.rjRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  // Public: retrieve an active RJ by slug
  findBySlug(slug: string) {
    return this.rjRepository.findOne({
      where: { slug, isActive: true },
    });
  }

  findById(id: string) {
    return this.rjRepository.findOne({
      where: { id, isActive: true },
    });
  }

  // Admin: list all RJs, including inactive ones
  findAllForAdmin() {
    return this.rjRepository.find({
      order: { name: 'ASC' },
    });
  }

  // Admin: create an RJ
  async createForAdmin(data: {
    name: string;
    slug: string;
    email?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
    stationId?: string | null;
  }) {
    const existing = await this.rjRepository.findOne({
      where: { slug: data.slug },
    });

    if (existing) {
      throw new ConflictException('An RJ with this slug already exists.');
    }

    const rj = this.rjRepository.create({
      ...data,
      isActive: true,
    });

    return this.rjRepository.save(rj);
  }

  // Admin: update an RJ
  async updateForAdmin(
    id: string,
    data: {
      name?: string;
      slug?: string;
      email?: string | null;
      phone?: string | null;
      photoUrl?: string | null;
      stationId?: string | null;
    },
  ) {
    const rj = await this.rjRepository.findOne({ where: { id } });

    if (!rj) {
      throw new NotFoundException('RJ not found.');
    }

    if (data.slug && data.slug !== rj.slug) {
      const existing = await this.rjRepository.findOne({
        where: { slug: data.slug },
      });

      if (existing) {
        throw new ConflictException('An RJ with this slug already exists.');
      }
    }

    Object.assign(rj, data);
    return this.rjRepository.save(rj);
  }

  // Admin: activate or deactivate an RJ
  async setActiveForAdmin(id: string, isActive: boolean) {
    const rj = await this.rjRepository.findOne({ where: { id } });

    if (!rj) {
      throw new NotFoundException('RJ not found.');
    }

    rj.isActive = isActive;
    return this.rjRepository.save(rj);
  }
}
