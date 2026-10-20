
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Programme } from '../programme.entity';
import { ProgrammeRj } from '../programme-rj.entity';
import { ProgrammeOwnership } from '../programme-ownership.entity';
import { ProgrammeSchedule } from '../programme-schedule.entity';
import { ProgrammesController } from './programmes.controller';
import { ProgrammesService } from './programmes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Programme, ProgrammeRj, ProgrammeOwnership, ProgrammeSchedule])],
  controllers: [ProgrammesController],
  providers: [ProgrammesService],
})
export class ProgrammesModule {}
