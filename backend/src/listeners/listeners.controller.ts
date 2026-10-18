import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ListenersService } from './listeners.service';

@Controller('listeners')
export class ListenersController {
  constructor(private readonly listenersService: ListenersService) {}

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const listener = await this.listenersService.findPublicProfile(id);

    if (!listener) {
      throw new NotFoundException('Listener not found');
    }

    return listener;
  }
}
