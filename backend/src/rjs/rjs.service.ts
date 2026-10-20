
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Rj } from '../rj.entity';
import { In, Repository } from 'typeorm';
import { Listener } from '../listener.entity';
import { Programme } from '../programme.entity';

@Injectable()
export class RjsService {
  constructor(
    @InjectRepository(Rj)
    private readonly rjRepository: Repository<Rj>,
  ) {}
  async findOwnProfile(listenerId: string) {
    return this.rjRepository.findOne({
      where: {
        ownerListener: { id: listenerId },
      },
    });
  }
    async registerOwnProfile(
    listenerId: string,
    data: {
      name: string;
      phone?: string | null;
      photoUrl?: string | null;
    },
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException('RJ name is required.');
    }

    const existing = await this.findOwnProfile(listenerId);

    if (existing) {
      throw new ConflictException(
        'This account already has an RJ profile.',
      );
    }

    const baseSlug = data.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'rj';

    let slug = baseSlug;
    let suffix = 2;

    while (await this.rjRepository.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const rj = this.rjRepository.create({
      name: data.name.trim(),
      slug,
      phone: data.phone?.trim() || null,
      photoUrl: data.photoUrl?.trim() || null,
    ownerListener: { id: listenerId } as Listener,
      stationId: null,
      isActive: false,
      verificationStatus: 'pending',
    });

    return this.rjRepository.save(rj);
  }

  async updateOwnProfile(
    listenerId: string,
    data: {
      name?: string;
      phone?: string | null;
      photoUrl?: string | null;
    },
  ) {
    const rj = await this.findOwnProfile(listenerId);

    if (!rj) {
      throw new NotFoundException('RJ profile not found.');
    }

    if (data.name !== undefined) {
      if (!data.name.trim()) {
        throw new BadRequestException('RJ name cannot be empty.');
      }

      rj.name = data.name.trim();
    }

    if (data.phone !== undefined) {
      rj.phone = data.phone?.trim() || null;
    }

    if (data.photoUrl !== undefined) {
      rj.photoUrl = data.photoUrl?.trim() || null;
    }

    return this.rjRepository.save(rj);
  }
  
  // Public: list active RJs
    // Public: list active, verified or legacy RJs
  findAll() {
    return this.rjRepository.find({
      where: {
        isActive: true,
        verificationStatus: In(['verified', 'legacy']),
      },
      order: { name: 'ASC' },
    });
  }

  // Public: retrieve an active RJ by slug
    // Public: retrieve an active, verified or legacy RJ by slug
  findBySlug(slug: string) {
    return this.rjRepository.findOne({
      where: {
        slug,
        isActive: true,
        verificationStatus: In(['verified', 'legacy']),
      },
    });
  }

    findById(id: string) {
    return this.rjRepository.findOne({
      where: {
        id,
        isActive: true,
        verificationStatus: In(['verified', 'legacy']),
      },
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
      verificationStatus: 'legacy',
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
    async setVerificationForAdmin(
    id: string,
    verificationStatus: 'verified' | 'rejected',
  ) {
    const rj = await this.rjRepository.findOne({ where: { id } });

    if (!rj) {
      throw new NotFoundException('RJ not found.');
    }

    rj.verificationStatus = verificationStatus;
    rj.isActive = verificationStatus === 'verified';

    const saved = await this.rjRepository.save(rj);

    // Programmes the RJ still owns are public only while the RJ is verified.
    await this.rjRepository.manager.update(
      Programme,
      { ownerRjId: rj.id },
      { isActive: rj.isActive },
    );

    return saved;
  }
}
