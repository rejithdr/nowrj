
import {
  Controller,
  Get,
  Param,
  Req,
  UnauthorizedException,
  Post,
  Body,
  Patch,
} from '@nestjs/common';
import type { Request } from 'express';
import { RjsService } from './rjs.service';
import { toPublicRj } from './public-rj';

@Controller('rjs')
export class RjsController {
  constructor(private readonly rjsService: RjsService) {}

  @Get()
  async findAll() {
    const rjs = await this.rjsService.findAll();
    return rjs.map(toPublicRj);
  }

  @Get('me')
  async findOwnProfile(@Req() req: Request) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const listener = req.user as { id: string };

    return this.rjsService.findOwnProfile(listener.id);
  }

    @Post('register')
  async registerOwnProfile(
    @Req() req: Request,
    @Body()
    body: {
      name: string;
      phone?: string | null;
      photoUrl?: string | null;
    },
  ) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const listener = req.user as { id: string };

    return this.rjsService.registerOwnProfile(listener.id, body);
  }

  @Patch('me')
  async updateOwnProfile(
    @Req() req: Request,
    @Body()
    body: {
      name?: string;
      phone?: string | null;
      photoUrl?: string | null;
    },
  ) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedException('Please sign in first.');
    }

    const listener = req.user as { id: string };

    return this.rjsService.updateOwnProfile(listener.id, body);
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const rj = await this.rjsService.findBySlug(slug);
    return rj ? toPublicRj(rj) : null;
  }
}