import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserRole } from '../user-role.entity';
import { ProgrammeClaim } from '../programme-claim.entity';
import { AuditLog } from '../audit-log.entity';
import { StationOnboardingService } from './station-onboarding.service';
import { ClaimsService } from './claims.service';
import { AdminStationsService } from './admin-stations.service';
import { InsightsService } from './insights.service';
import {
  AdminStationsController,
  AdminInsightsController,
  StationApplicationsController,
  RjClaimsController,
  StationInvitesController,
  StationRepController,
} from './onboarding.controllers';

@Module({
  imports: [TypeOrmModule.forFeature([UserRole, ProgrammeClaim, AuditLog]), AuthModule],
  controllers: [AdminInsightsController, StationInvitesController, StationApplicationsController, StationRepController, RjClaimsController, AdminStationsController],
  providers: [StationOnboardingService, ClaimsService, AdminStationsService, InsightsService],
})
export class OnboardingModule {}
