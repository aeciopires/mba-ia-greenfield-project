import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ConfigType } from '@nestjs/config';
import storageConfig from '../config/storage.config';
import { S3_CLIENT } from './storage.constants';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  // AWS Sig V4 binds the Host header into the signature. Using the internal
  // s3Client (minio:9000) for presigning produces URLs that browsers reject
  // with 403 when they hit localhost:9000. This client signs for the public
  // endpoint so the browser's Host header matches the signature.
  private readonly presignClient: S3Client;

  constructor(
    @Inject(S3_CLIENT) private readonly s3Client: S3Client,
    @Inject(storageConfig.KEY)
    private readonly config: ConfigType<typeof storageConfig>,
  ) {
    this.presignClient = new S3Client({
      endpoint: config.publicEndpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
  }

  async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(
        new HeadBucketCommand({ Bucket: this.config.bucket }),
      );
      this.logger.log(`Bucket "${this.config.bucket}" already exists`);
    } catch (err: unknown) {
      const name = (err as { name?: string }).name;
      if (name === 'NoSuchBucket' || name === 'NotFound') {
        await this.s3Client.send(
          new CreateBucketCommand({ Bucket: this.config.bucket }),
        );
        this.logger.log(`Bucket "${this.config.bucket}" created`);
      } else {
        throw err;
      }
    }
  }

  async generateUploadPresignedUrl(
    key: string,
    contentType: string,
    expiresIn?: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.presignClient, command, {
      expiresIn: expiresIn ?? this.config.presignedUrlExpiresIn,
    });
  }

  async generateDownloadPresignedUrl(
    key: string,
    expiresIn?: number,
    contentDisposition?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ...(contentDisposition
        ? { ResponseContentDisposition: contentDisposition }
        : {}),
    });
    return getSignedUrl(this.presignClient, command, {
      expiresIn: expiresIn ?? 3600,
    });
  }

  // For server-side consumers (e.g. the video-worker) that run inside the
  // Docker network: signs with s3Client (endpoint minio:9000) so the
  // resulting URL resolves correctly inside the container.
  async generateInternalDownloadPresignedUrl(
    key: string,
    expiresIn?: number,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresIn ?? 3600,
    });
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }
}
