import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { ReferralsService } from './referrals.service';

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  /** Public: who a referral link belongs to. */
  @Get('code/:code')
  lookup(@Param('code') code: string) {
    return this.referrals.lookup(code);
  }

  /** A newly signed-up listener records the link they arrived through. */
  @Post('claim')
  claim(@Req() req: Request, @Body() body: { code?: string }) {
    return this.referrals.claim(listenerId(req), body?.code);
  }
}

/** The signed-in RJ's referrals and vouches, and vouching for others. */
@Controller('rjs')
export class RjReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me/referrals')
  mine(@Req() req: Request) {
    return this.referrals.mine(listenerId(req));
  }

  @Get('me/vouches')
  myVouches(@Req() req: Request) {
    return this.referrals.myVouches(listenerId(req));
  }

  @Get('vouch/:rjId')
  vouchTarget(@Req() req: Request, @Param('rjId', ParseUUIDPipe) rjId: string) {
    return this.referrals.vouchTarget(listenerId(req), rjId);
  }

  @Post('vouch/:rjId')
  vouch(@Req() req: Request, @Param('rjId', ParseUUIDPipe) rjId: string, @Body() body: { note?: string }) {
    return this.referrals.vouch(listenerId(req), rjId, body?.note);
  }
}

@Controller('admin/rjs-verification')
@UseGuards(SuperadminGuard)
export class AdminReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get()
  info() {
    return this.referrals.adminVerificationInfo();
  }
}
