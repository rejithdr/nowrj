
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { FollowsService } from './follows.service';

@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':rjId')
  follow(@Req() req: Request, @Param('rjId') rjId: string) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const listener = req.user as { id: string };

    return this.followsService.follow(listener.id, rjId);
  }

  @Delete(':rjId')
  unfollow(@Req() req: Request, @Param('rjId') rjId: string) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const listener = req.user as { id: string };

    return this.followsService.unfollow(listener.id, rjId);
  }

  @Get(':rjId/status')
  getFollowStatus(
    @Req() req: Request,
    @Param('rjId') rjId: string,
  ) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const listener = req.user as { id: string };

    return this.followsService.getFollowStatus(listener.id, rjId);
  }
}
