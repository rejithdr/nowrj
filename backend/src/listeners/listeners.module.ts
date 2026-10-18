import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listener } from '../listener.entity';
import { ListenersService } from './listeners.service';
import { ListenersController } from './listeners.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Listener])],
  controllers: [ListenersController],
  providers: [ListenersService],
  exports: [ListenersService],
})
export class ListenersModule {}