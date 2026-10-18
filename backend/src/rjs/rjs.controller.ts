import { Controller, Get, Param } from '@nestjs/common';
import { RjsService } from './rjs.service';

@Controller('rjs')
export class RjsController {
  constructor(private readonly rjsService: RjsService) {}

  @Get()
  findAll() {
    return this.rjsService.findAll();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.rjsService.findBySlug(slug);
  }
}