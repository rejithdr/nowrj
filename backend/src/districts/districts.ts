import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { assertStationAccess } from '../orgs/access';
import { writeAudit } from '../onboarding/helpers';
import { DISTRICTS, isDistrict } from './district-list';

function listenerId(req: Request): string {
  if (!req.isAuthenticated()) throw new UnauthorizedException('Please sign in first.');
  return (req.user as { id: string }).id;
}

@Injectable()
export class DistrictsService {
  constructor(readonly dataSource: DataSource) {}

  async get(stationId: string) {
    const [row] = await this.dataSource.query(`SELECT name, districts FROM stations WHERE id = $1`, [stationId]);
    if (!row) throw new NotFoundException('Station not found.');
    return { stationId, name: row.name as string, districts: (row.districts as string[] | null) ?? [] };
  }

  async set(actor: string, stationId: string, body: unknown) {
    const list = (body as { districts?: unknown })?.districts;
    if (!Array.isArray(list) || !list.every(isDistrict)) throw new BadRequestException('Choose districts from the list.');
    if (!list.length) throw new BadRequestException('Choose at least one district.');
    const districts = DISTRICTS.map((d) => d.id).filter((id) => list.includes(id));
    await this.get(stationId);
    await this.dataSource.transaction(async (m) => {
      await m.query(`UPDATE stations SET districts = $2 WHERE id = $1`, [stationId, districts]);
      await writeAudit(m, actor, 'station.districts', 'station', stationId, { districts });
    });
    return this.get(stationId);
  }
}

/** The district list, and the districts a station reaches. */
@Controller('districts')
export class DistrictsController {
  constructor(private readonly districts: DistrictsService) {}

  @Get()
  list() {
    return DISTRICTS;
  }

  @Get('stations/:stationId')
  async get(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string) {
    await assertStationAccess(this.dataSource(), listenerId(req), stationId, 'programmes', 'view');
    return this.districts.get(stationId);
  }

  @Put('stations/:stationId')
  async set(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Body() body: unknown) {
    const actor = listenerId(req);
    await assertStationAccess(this.dataSource(), actor, stationId, 'programmes', 'edit');
    return this.districts.set(actor, stationId, body);
  }

  private dataSource() {
    return this.districts.dataSource.manager;
  }
}

/** Super Admin sets districts for any station. */
@Controller('admin/districts')
@UseGuards(SuperadminGuard)
export class AdminDistrictsController {
  constructor(private readonly districts: DistrictsService) {}

  @Get('stations/:stationId')
  get(@Param('stationId', ParseUUIDPipe) stationId: string) {
    return this.districts.get(stationId);
  }

  @Put('stations/:stationId')
  set(@Req() req: Request, @Param('stationId', ParseUUIDPipe) stationId: string, @Body() body: unknown) {
    return this.districts.set(listenerId(req), stationId, body);
  }
}

@Module({ controllers: [DistrictsController, AdminDistrictsController], providers: [DistrictsService] })
export class DistrictsModule {}
