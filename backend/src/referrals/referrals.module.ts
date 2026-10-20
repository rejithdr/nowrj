import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Referral } from '../referral.entity';
import { RjVouch } from '../rj-vouch.entity';
import { ReferralsService } from './referrals.service';
import { AdminReferralsController, ReferralsController, RjReferralsController } from './referrals.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Referral, RjVouch]), AuthModule],
  controllers: [ReferralsController, RjReferralsController, AdminReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
