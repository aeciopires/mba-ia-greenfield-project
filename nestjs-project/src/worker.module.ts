import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { ConfigType } from '@nestjs/config';
import { Video } from './videos/entities/video.entity';
import { Channel } from './channels/entities/channel.entity';
import { Category } from './categories/entities/category.entity';
import { User } from './users/entities/user.entity';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { VideoProcessingProcessor } from './videos/processors/video-processing.processor';
import databaseConfig from './config/database.config';
import storageConfig from './config/storage.config';
import queueConfig from './config/queue.config';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, storageConfig, queueConfig],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
        type: 'postgres' as const,
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.name,
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    TypeOrmModule.forFeature([Video, Channel, Category, User]),
    StorageModule,
    QueueModule,
  ],
  providers: [VideoProcessingProcessor],
})
export class WorkerModule {}
