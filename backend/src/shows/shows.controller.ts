import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ShowsService } from './shows.service';
import type { ReactionType } from './shows.service';

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) {
    throw new UnauthorizedException('Please sign in first.');
  }
  return (req.user as { id: string }).id;
}

function reactionType(type: string | undefined): ReactionType {
  if (type !== 'like' && type !== 'fire') {
    throw new BadRequestException('Reaction type must be like or fire.');
  }
  return type;
}

@Controller('shows')
export class ShowsController {
  constructor(private readonly shows: ShowsService) {}

  /** Live now, next 24 hours, and last 24 hours. Public. */
  @Get('now')
  now() {
    return this.shows.getNow();
  }

  /** ?ids=a,b,c → which of those shows the signed-in listener reacted to. */
  @Get('reactions/status')
  status(@Req() req: Request, @Query('ids') ids?: string) {
    return this.shows.reactionStatus(listenerId(req), ids);
  }

  @Post(':id/reactions')
  react(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Query('type') type?: string) {
    return this.shows.setReaction(listenerId(req), id, reactionType(type), true);
  }

  @Delete(':id/reactions')
  unreact(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Query('type') type?: string) {
    return this.shows.setReaction(listenerId(req), id, reactionType(type), false);
  }
}
