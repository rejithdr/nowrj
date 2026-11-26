
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health';
import { StationsModule } from './stations/stations.module';
import { ProgrammesModule } from './programmes/programmes.module';
import { RjsModule } from './rjs/rjs.module';
import { ListenersModule } from './listeners/listeners.module';
import { AuthModule } from './auth/auth.module';
import { FollowsModule } from './follows/follows.module';
import { ReactionsModule } from './reactions/reactions.module';
import { ShowsModule } from './shows/shows.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ReferralsModule } from './referrals/referrals.module';
import { PagesModule } from './pages/pages';
import { EnquiriesModule } from './enquiries/enquiries';
import { GuestsModule } from './guests/guests';
import { OrgsModule } from './orgs/orgs';
import { AdsModule } from './ads/advertisers';
import { DistrictsModule } from './districts/districts';
import { PollsModule } from './polls/polls';
import { PilotModule } from './pilot/pilot';
import { RecordingsModule } from './recordings/recordings';
import { ReportsModule } from './reports/reports';
import { NetworkProgrammesModule } from './network/network-programmes';
import { ParticipationModule } from './network/participation';
import { CommentsModule } from './network/comments';
import { AdLeadsModule } from './ads/leads';
import { MyMessagesModule } from './network/my-messages';
import { DataExportModule } from './auth/data-export';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.getOrThrow<string>('DB_HOST'),
        port: Number(configService.getOrThrow<string>('DB_PORT')),
        username: configService.getOrThrow<string>('DB_USERNAME'),
        password: configService.getOrThrow<string>('DB_PASSWORD'),
        database: configService.getOrThrow<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    StationsModule,
    ProgrammesModule,
    RjsModule,
    ListenersModule,
    AuthModule,
    FollowsModule,
    ReactionsModule,
    ShowsModule,
    OnboardingModule,
    ReferralsModule,
    PagesModule,
    EnquiriesModule,
    GuestsModule,
    OrgsModule,
    AdsModule,
    DistrictsModule,
    PollsModule,
    PilotModule,
    RecordingsModule,
    ReportsModule,
    NetworkProgrammesModule,
    ParticipationModule,
    CommentsModule,
    AdLeadsModule,
    MyMessagesModule,
    DataExportModule,
    HealthModule,
  ],
})
export class AppModule {}
