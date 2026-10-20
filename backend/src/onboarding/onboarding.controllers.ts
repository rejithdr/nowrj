import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { StationOnboardingService } from './station-onboarding.service';
import type { JoinInput } from './station-onboarding.service';
import { ClaimsService } from './claims.service';
import { AdminStationsService } from './admin-stations.service';

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

/** The invite link a station receives from an RJ. */
@Controller('station-invites')
export class StationInvitesController {
  constructor(private readonly onboarding: StationOnboardingService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.onboarding.getInvite(token);
  }

  @Post(':token/join')
  join(@Req() req: Request, @Param('token') token: string, @Body() body: JoinInput) {
    return this.onboarding.join(listenerId(req), token, body ?? {});
  }
}

/** A station representative's own pages: /station-reps/me/... */
@Controller('station-reps/me')
export class StationRepController {
  constructor(
    private readonly onboarding: StationOnboardingService,
    private readonly claims: ClaimsService,
  ) {}

  @Get('stations')
  stations(@Req() req: Request) {
    return this.onboarding.myStations(listenerId(req));
  }

  @Get('stations/:stationId/programmes')
  programmes(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.claims.stationProgrammes(listenerId(req), stationId);
  }

  @Post('stations/:stationId/programmes/:programmeId/claim')
  claim(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('programmeId', ParseUUIDPipe) programmeId: string,
  ) {
    return this.claims.createClaim(listenerId(req), stationId, programmeId);
  }

  @Patch('stations/:stationId/programmes/:programmeId/call-in')
  callIn(
    @Req() req: Request,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Param('programmeId', ParseUUIDPipe) programmeId: string,
    @Body() body: { callInPhone?: string | null },
  ) {
    return this.claims.stationUpdateCallIn(listenerId(req), stationId, programmeId, body?.callInPhone);
  }
}

/** Claims on the signed-in RJ's programmes: /rjs/me/claims */
@Controller('rjs/me/claims')
export class RjClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.claims.rjClaims(listenerId(req));
  }

  @Post(':id/approve')
  approve(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.claims.rjDecide(listenerId(req), id, true, null);
  }

  @Post(':id/reject')
  reject(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.claims.rjDecide(listenerId(req), id, false, body?.reason);
  }
}

/** Super Admin: station applications, disputed claims and the audit log. */
@Controller('admin')
@UseGuards(SuperadminGuard)
export class AdminStationsController {
  constructor(
    private readonly stations: AdminStationsService,
    private readonly claims: ClaimsService,
  ) {}

  @Get('station-reps/pending')
  pending() {
    return this.stations.pendingReps();
  }

  @Post('station-reps/:roleId/approve')
  approve(@Req() req: Request, @Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.stations.approveRep(listenerId(req), roleId);
  }

  @Post('station-reps/:roleId/reject')
  reject(@Req() req: Request, @Param('roleId', ParseUUIDPipe) roleId: string, @Body() body: { reason?: string }) {
    return this.stations.rejectRep(listenerId(req), roleId, body?.reason);
  }

  @Get('claims')
  disputedClaims() {
    return this.claims.adminClaims();
  }

  @Post('claims/:id/approve')
  approveClaim(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.claims.adminDecide(listenerId(req), id, true, body?.reason);
  }

  @Post('claims/:id/reject')
  rejectClaim(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string, @Body() body: { reason?: string }) {
    return this.claims.adminDecide(listenerId(req), id, false, body?.reason);
  }

  @Get('audit-log')
  audit() {
    return this.stations.auditLog();
  }
}
