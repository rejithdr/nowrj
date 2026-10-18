
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from '../follow.entity';
import { ListenersModule } from '../listeners/listeners.module';
import { RjsModule } from '../rjs/rjs.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Follow]),
    ListenersModule,
    RjsModule,
  ],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
