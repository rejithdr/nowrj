import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Reaction } from '../reaction.entity';
import { ListenersService } from '../listeners/listeners.service';
import { RjsService } from '../rjs/rjs.service';

export type ReactionType = 'like' | 'fire';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectRepository(Reaction)
    private readonly reactionsRepository: Repository<Reaction>,
    private readonly listenersService: ListenersService,
    private readonly rjsService: RjsService,
  ) {}

  async setRjReaction(
    listenerId: string,
    rjId: string,
    type: ReactionType,
    active: boolean,
  ) {
    const listener =
      await this.listenersService.findByIdForAuth(listenerId);

    if (!listener) {
      throw new NotFoundException('Listener not found.');
    }

    const rj = await this.rjsService.findById(rjId);

    if (!rj || !rj.isActive) {
      throw new NotFoundException('RJ not found.');
    }

    if (active) {
      const existing = await this.reactionsRepository.findOne({
        where: { listenerId, rjId, programmeId: IsNull(), type },
      });

      if (!existing) {
        await this.reactionsRepository.save({
          listenerId,
          rjId,
          programmeId: null,
          type,
        });
      }
    } else {
      await this.reactionsRepository.delete({
        listenerId,
        rjId,
        programmeId: IsNull(),
        type,
      });
    }

    return { active };
  }

  async getRjReactionStatus(listenerId: string, rjId: string) {
    const listener =
      await this.listenersService.findByIdForAuth(listenerId);

    if (!listener) {
      throw new NotFoundException('Listener not found.');
    }

    const rj = await this.rjsService.findById(rjId);

    if (!rj || !rj.isActive) {
      throw new NotFoundException('RJ not found.');
    }

    const reactions = await this.reactionsRepository.find({
      where: { listenerId, rjId, programmeId: IsNull() },
      select: { type: true },
    });

    return {
      liked: reactions.some((reaction) => reaction.type === 'like'),
      fired: reactions.some((reaction) => reaction.type === 'fire'),
    };
  }
  async getRjReactionCounts(rjId: string) {
    const rj = await this.rjsService.findById(rjId);

    if (!rj || !rj.isActive) {
      throw new NotFoundException('RJ not found.');
    }

    const [likes, fires] = await Promise.all([
      this.reactionsRepository.count({
        where: { rjId, programmeId: IsNull(), type: 'like' },
      }),
      this.reactionsRepository.count({
        where: { rjId, programmeId: IsNull(), type: 'fire' },
      }),
    ]);

    return { likes, fires };
  }

}