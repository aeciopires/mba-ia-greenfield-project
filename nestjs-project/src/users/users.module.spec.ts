import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
import { createTestDataSource } from '../test/create-test-data-source';
import { Channel } from '../channels/entities/channel.entity';
import { Video } from '../videos/entities/video.entity';
import { Category } from '../categories/entities/category.entity';
import queueConfig from '../config/queue.config';
import storageConfig from '../config/storage.config';
import { User } from './entities/user.entity';
import { UsersModule } from './users.module';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';

const ALL_ENTITIES = [
  User,
  Channel,
  RefreshToken,
  VerificationToken,
  Video,
  Category,
];

describe('UsersModule', () => {
  it('should compile successfully', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [queueConfig, storageConfig],
        }),
        TypeOrmModule.forRoot(createTestDataSource(ALL_ENTITIES).options),
        UsersModule,
      ],
    })
      .overrideProvider(getQueueToken(VIDEO_PROCESSING_QUEUE))
      .useValue({ add: jest.fn(), close: jest.fn() })
      .compile();

    expect(module).toBeDefined();
    await module.close();
  }, 30000);
});
