import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowOccurrence } from '../show-occurrence.entity';
import { ShowOccurrenceHost } from '../show-occurrence-host.entity';
import { ShowsController } from './shows.controller';
import { ShowsService } from './shows.service';
import { EngagementService } from './engagement.service';
import { SongRequestsService } from './song-requests.service';
import { ShowChangesService } from './show-changes.service';
import { ScheduleException } from '../schedule-exception.entity';
import { SongRequest } from '../song-request.entity';
import { EngagementEvent } from '../engagement-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShowOccurrence, ShowOccurrenceHost, EngagementEvent, SongRequest, ScheduleException])],
  controllers: [ShowsController],
  providers: [ShowsService, EngagementService, SongRequestsService, ShowChangesService],
  exports: [ShowsService],
})
export class ShowsModule {}
