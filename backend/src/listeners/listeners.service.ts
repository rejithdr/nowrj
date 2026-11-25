import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listener } from '../listener.entity';

@Injectable()
export class ListenersService {
  constructor(
    @InjectRepository(Listener)
    private readonly listenerRepository: Repository<Listener>,
  ) {}

  findByGoogleId(googleId: string) {
    return this.listenerRepository.findOne({
      where: { googleId, isActive: true },
    });
  }

  findByFacebookId(facebookId: string) {
    return this.listenerRepository.findOne({
      where: { facebookId, isActive: true },
    });
  }

  findByEmail(email: string) {
    return this.listenerRepository.findOne({
      where: { email, isActive: true },
    });
  }

  /**
   * Google has just verified this person holds `email`. If an older account
   * still has that address (Google reassigned it), that account loses it.
   */
  async updateEmail(id: string, email: string | null) {
    await this.listenerRepository.manager.transaction(async (m) => {
      if (email) await m.query(`UPDATE listeners SET email = NULL WHERE lower(email) = lower($1) AND id <> $2`, [email, id]);
      await m.update(Listener, { id }, { email });
    });
    return this.listenerRepository.findOneOrFail({ where: { id } });
  }

  async create(data: Partial<Listener>) {
    if (data.email) await this.listenerRepository.query(`UPDATE listeners SET email = NULL WHERE lower(email) = lower($1)`, [data.email]);
    const listener = this.listenerRepository.create(data);
    return this.listenerRepository.save(listener);
  }
    findByIdForAuth(id: string) {
    return this.listenerRepository.findOne({
      where: { id, isActive: true },
    });
  }
    findPublicProfile(id: string) {
    return this.listenerRepository.findOne({
      where: { id, isActive: true },
      select: {
        id: true,
        displayName: true,
        photoUrl: true,
        createdAt: true,
      },
    });
  }
}
