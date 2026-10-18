
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from '../follow.entity';
import { ListenersService } from '../listeners/listeners.service';
import { RjsService } from '../rjs/rjs.service';

@Injectable()
export class FollowsService {
  constructor(
    @InjectRepository(Follow)
    private readonly followsRepository: Repository<Follow>,
    private readonly listenersService: ListenersService,
    private readonly rjsService: RjsService,
  ) {}

  async follow(listenerId: string, rjId: string) {
    const listener =
      await this.listenersService.findByIdForAuth(listenerId);

    if (!listener) {
      throw new NotFoundException('Listener not found.');
    }

    const rj = await this.rjsService.findById(rjId);

    if (!rj || !rj.isActive) {
      throw new NotFoundException('RJ not found.');
    }

    const existing = await this.followsRepository.findOne({
      where: { listenerId, rjId },
    });

    if (existing) {
      return { following: true };
    }

    await this.followsRepository.save({ listenerId, rjId });

    return { following: true };
  }

  async unfollow(listenerId: string, rjId: string) {
    await this.followsRepository.delete({ listenerId, rjId });

    return { following: false };
  }

  async getFollowStatus(listenerId: string, rjId: string) {
    const follow = await this.followsRepository.findOne({
      where: { listenerId, rjId },
    });

    return { following: Boolean(follow) };
  }
}
