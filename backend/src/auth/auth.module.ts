import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ListenersModule } from '../listeners/listeners.module';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { SessionSerializer } from './session.serializer';
import { AuthController } from './auth.controller';
import { SuperadminGuard } from './guards/superadmin.guard';

@Module({
  imports: [
    ListenersModule,
    PassportModule.register({ session: true }),
  ],
  controllers: [AuthController],
  exports: [AuthService, SuperadminGuard],
  providers: [AuthService, GoogleStrategy, SessionSerializer, SuperadminGuard],
})
export class AuthModule {}