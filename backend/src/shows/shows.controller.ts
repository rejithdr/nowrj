import {
  BadRequestException,
  Body,
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
import { EngagementService } from './engagement.service';
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
  constructor(
    private readonly shows: ShowsService,
    private readonly engagement: EngagementService,
  ) {}

  /** A tap on the show's Call button. Works signed out (device id) or signed in. */
  @Post(':id/call-tap')
  callTap(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { deviceId?: string },
  ) {
    const signedIn = req.isAuthenticated() ? (req.user as { id: string }).id : null;
    return this.engagement.recordCallTap(id, signedIn, body?.deviceId);
  }

  @Get('engagement/rj')
  rjEngagement(@Req() req: Request) {
    return this.engagement.forRj(listenerId(req));
  }

  @Get('engagement/station/:stationId')
  stationEngagement(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.engagement.forStation(listenerId(req), stationId);
  }

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
