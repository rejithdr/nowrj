import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rj } from '../rj.entity';
import { RjStationAffiliation } from '../rj-station-affiliation.entity';
import { StationInvite } from '../station-invite.entity';
import { RjsController } from './rjs.controller';
import { RjsService } from './rjs.service';
import { RjsAdminController } from './rjs-admin.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
 imports: [TypeOrmModule.forFeature([Rj, RjStationAffiliation, StationInvite]), AuthModule],
  controllers: [RjsController, RjsAdminController],
  providers: [RjsService],
  exports: [RjsService],
})
export class RjsModule {}