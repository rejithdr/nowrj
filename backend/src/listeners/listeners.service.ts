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

  create(data: Partial<Listener>) {
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
