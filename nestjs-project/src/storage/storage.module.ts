import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import type { ConfigType } from '@nestjs/config';
import storageConfig from '../config/storage.config';
import { StorageService } from './storage.service';
import { S3_CLIENT } from './storage.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: S3_CLIENT,
      inject: [storageConfig.KEY],
      useFactory: (config: ConfigType<typeof storageConfig>): S3Client =>
        new S3Client({
          endpoint: `http://${config.endpoint}:${config.port}`,
          region: 'us-east-1',
          credentials: {
            accessKeyId: config.accessKey,
            secretAccessKey: config.secretKey,
          },
          forcePathStyle: true,
        }),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
