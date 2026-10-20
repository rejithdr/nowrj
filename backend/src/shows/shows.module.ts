import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowOccurrence } from '../show-occurrence.entity';
import { ShowOccurrenceHost } from '../show-occurrence-host.entity';
import { ShowsController } from './shows.controller';
import { ShowsService } from './shows.service';
import { EngagementService } from './engagement.service';
import { EngagementEvent } from '../engagement-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShowOccurrence, ShowOccurrenceHost, EngagementEvent])],
  controllers: [ShowsController],
  providers: [ShowsService, EngagementService],
  exports: [ShowsService],
})
export class ShowsModule {}
