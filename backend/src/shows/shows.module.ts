import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowOccurrence } from '../show-occurrence.entity';
import { ShowOccurrenceHost } from '../show-occurrence-host.entity';
import { ShowsController } from './shows.controller';
import { ShowsService } from './shows.service';

@Module({
  imports: [TypeOrmModule.forFeature([ShowOccurrence, ShowOccurrenceHost])],
  controllers: [ShowsController],
  providers: [ShowsService],
  exports: [ShowsService],
})
export class ShowsModule {}
