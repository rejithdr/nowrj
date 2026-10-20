
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SuperadminGuard } from '../auth/guards/superadmin.guard';
import { RjsService } from './rjs.service';

@Controller('admin/rjs')
@UseGuards(SuperadminGuard)
export class RjsAdminController {
  constructor(private readonly rjsService: RjsService) {}

  @Get()
  findAll() {
    return this.rjsService.findAllForAdmin();
  }

  @Post()
  create(
    @Body()
    data: {
      name: string;
      slug: string;
      email?: string | null;
      phone?: string | null;
      photoUrl?: string | null;
      stationId?: string | null;
    },
  ) {
    return this.rjsService.createForAdmin(data);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: {
      name?: string;
      slug?: string;
      email?: string | null;
      phone?: string | null;
      photoUrl?: string | null;
      stationId?: string | null;
    },
  ) {
    return this.rjsService.updateForAdmin(id, data);
  }

  @Patch(':id/active')
  setActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { isActive: boolean },
  ) {
    return this.rjsService.setActiveForAdmin(id, data.isActive);
  }
    @Patch(':id/verification')
  setVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { verificationStatus: 'verified' | 'rejected' },
  ) {
    return this.rjsService.setVerificationForAdmin(
      id,
      data.verificationStatus,
    );
  }
}
