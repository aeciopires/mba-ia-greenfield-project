import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Channel } from './entities/channel.entity';
import { ChannelsService } from './channels.service';
import { ChannelsController } from './channels.controller';
import { VideosModule } from '../videos/videos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Channel]),
    forwardRef(() => VideosModule),
  ],
  providers: [ChannelsService],
  controllers: [ChannelsController],
  exports: [TypeOrmModule, ChannelsService],
})
export class ChannelsModule {}
