import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdultGuard } from './guards/adult.guard';
import { PassportModule } from '@nestjs/passport';
import { ListenersModule } from '../listeners/listeners.module';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { SessionSerializer } from './session.serializer';
import { AuthController } from './auth.controller';
import { AccountService } from './account.service';
import { SuperadminGuard } from './guards/superadmin.guard';

@Module({
  imports: [
    ListenersModule,
    PassportModule.register({ session: true }),
  ],
  controllers: [AuthController],
  exports: [AuthService, SuperadminGuard],
  providers: [
    AccountService,
    AuthService,
    GoogleStrategy,
    SessionSerializer,
    SuperadminGuard,
    { provide: APP_GUARD, useClass: AdultGuard },
  ],
})
export class AuthModule {}