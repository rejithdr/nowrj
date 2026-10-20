import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { RjDashboardService } from './rj-dashboard.service';
import type { SlotInput } from '../programmes/schedule-rules';
import type {
  InviteInput,
  ProgrammeInput,
  SetStationInput,
} from './rj-dashboard.service';

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) {
    throw new UnauthorizedException('Please sign in first.');
  }
  return (req.user as { id: string }).id;
}

/** The signed-in RJ's own dashboard: /rjs/me/... */
@Controller('rjs/me')
export class RjDashboardController {
  constructor(private readonly dashboard: RjDashboardService) {}

  @Get('stations')
  stationHistory(@Req() req: Request) {
    return this.dashboard.getStationHistory(listenerId(req));
  }

  @Post('station')
  setStation(@Req() req: Request, @Body() body: SetStationInput) {
    return this.dashboard.setStation(listenerId(req), body ?? {});
  }

  @Get('station-invites')
  listInvites(@Req() req: Request) {
    return this.dashboard.listInvites(listenerId(req));
  }

  @Post('station-invites')
  createInvite(@Req() req: Request, @Body() body: InviteInput) {
    return this.dashboard.createInvite(listenerId(req), body ?? {});
  }

  @Get('programmes')
  listProgrammes(@Req() req: Request) {
    return this.dashboard.listProgrammes(listenerId(req));
  }

  @Post('programmes')
  createProgramme(@Req() req: Request, @Body() body: ProgrammeInput) {
    return this.dashboard.createProgramme(listenerId(req), body ?? {});
  }

  @Post('programmes/:id/schedule')
  addSlot(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SlotInput,
  ) {
    return this.dashboard.addSlot(listenerId(req), id, body ?? {});
  }

  @Delete('programmes/:id/schedule/:slotId')
  endSlot(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
  ) {
    return this.dashboard.endSlot(listenerId(req), id, slotId);
  }

  @Post('programmes/:id/move-to-station')
  moveToStation(@Req() req: Request, @Param('id', ParseUUIDPipe) id: string) {
    return this.dashboard.moveToCurrentStation(listenerId(req), id);
  }

  @Patch('programmes/:id/call-in')
  updateCallIn(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { callInPhone?: string | null },
  ) {
    return this.dashboard.updateCallIn(listenerId(req), id, body?.callInPhone);
  }
}
