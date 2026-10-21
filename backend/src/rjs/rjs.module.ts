import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rj } from '../rj.entity';
import { RjStationAffiliation } from '../rj-station-affiliation.entity';
import { StationInvite } from '../station-invite.entity';
import { ProgrammeSchedule } from '../programme-schedule.entity';
import { RjsController } from './rjs.controller';
import { RjsService } from './rjs.service';
import { RjsAdminController } from './rjs-admin.controller';
import { RjDashboardController } from './rj-dashboard.controller';
import { RjDashboardService } from './rj-dashboard.service';
import { AuthModule } from '../auth/auth.module';
import { RjOwnPhotoController, RjPhotoController, RjPhotosService } from './rj-photos';

@Module({
 imports: [TypeOrmModule.forFeature([Rj, RjStationAffiliation, StationInvite, ProgrammeSchedule]), AuthModule],
  controllers: [RjOwnPhotoController, RjDashboardController, RjPhotoController, RjsController, RjsAdminController],
  providers: [RjsService, RjDashboardService, RjPhotosService],
  exports: [RjsService],
})
export class RjsModule {}