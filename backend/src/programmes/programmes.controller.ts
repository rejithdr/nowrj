
import { Controller, Get, Param } from '@nestjs/common';
import { ProgrammesService } from './programmes.service';

@Controller('programmes')
export class ProgrammesController {
  constructor(
    private readonly programmesService: ProgrammesService,
  ) {}

  @Get()
  findAll() {
    return this.programmesService.findAll();
  }

  @Get('station/:stationId')
  findByStation(@Param('stationId') stationId: string) {
    return this.programmesService.findByStation(stationId);
  }
}
