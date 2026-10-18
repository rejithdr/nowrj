import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReactionsService } from './reactions.service';
import type { ReactionType } from './reactions.service';

@Controller('reactions')
export class ReactionsController {
  constructor(
    private readonly reactionsService: ReactionsService,
  ) {}

    @Get('rj/:rjId/counts')
  getRjReactionCounts(
    @Param('rjId') rjId: string,
  ) {
    return this.reactionsService.getRjReactionCounts(rjId);
  }
  @Get('rj/:rjId/status')
  getRjReactionStatus(
    @Req() req: Request,
    @Param('rjId') rjId: string,
  ) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const listener = req.user as { id: string };

    return this.reactionsService.getRjReactionStatus(
      listener.id,
      rjId,
    );
  }

  @Post('rj/:rjId')
  setRjReaction(
    @Req() req: Request,
    @Param('rjId') rjId: string,
    @Query('type') type: string,
  ) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    if (type !== 'like' && type !== 'fire') {
      throw new BadRequestException(
        'Reaction type must be like or fire.',
      );
    }

    const listener = req.user as { id: string };

    return this.reactionsService.setRjReaction(
      listener.id,
      rjId,
      type,
      true,
    );
  }

  @Delete('rj/:rjId')
  removeRjReaction(
    @Req() req: Request,
    @Param('rjId') rjId: string,
    @Query('type') type: string,
  ) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    if (type !== 'like' && type !== 'fire') {
      throw new BadRequestException(
        'Reaction type must be like or fire.',
      );
    }

    const listener = req.user as { id: string };

    return this.reactionsService.setRjReaction(
      listener.id,
      rjId,
      type,
      false,
    );
  }
}