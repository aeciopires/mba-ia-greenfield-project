# Phase 03 — Library References

New libraries introduced in Phase 03, confirmed via context7 documentation lookup before implementation.

## Production Dependencies

| Library | Pinned Version | Purpose | Notes |
|---------|---------------|---------|-------|
| `@aws-sdk/client-s3` | `^3.x` | MinIO S3-compatible client — `S3Client`, `PutObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand`, `HeadBucketCommand`, `CreateBucketCommand` | Use `forcePathStyle: true` for MinIO path-style URLs |
| `@aws-sdk/s3-request-presigner` | `^3.x` | Presigned URL generation — `getSignedUrl()` wrapping S3 commands | Imported from `@aws-sdk/s3-request-presigner` |
| `@nestjs/bullmq` | `^11.x` | NestJS BullMQ integration — `BullModule`, `@Processor`, `@Process`, `InjectQueue` decorators | Requires BullMQ v5+ and ioredis v5+ |
| `bullmq` | `^5.x` | Redis-based job queue — `Queue`, `Job`, `Worker` | Used internally by `@nestjs/bullmq` |
| `ioredis` | `^5.x` | Redis client — used as BullMQ connection | Pass as `connection: { host, port }` to `BullModule.forRootAsync` |
| `nanoid` | `^3.3.x` | URL-safe unique ID generation — 21-char alphanumeric slugs | **Pin to v3.x** — v4+ is ESM-only and incompatible with CommonJS NestJS |
| `fluent-ffmpeg` | `^2.x` | FFmpeg Node.js wrapper — thumbnail extraction via `ffmpeg().screenshots()` or `.output()` | Used only in `video-processing.processor.ts` (worker) |
| `@ffprobe-installer/ffprobe` | `^1.4.x` | Prebuilt ffprobe binary — used for metadata extraction via `ffprobe()` | Set path: `ffmpeg.setFfprobePath(ffprobeInstaller.path)` |

## Development Dependencies

| Library | Pinned Version | Purpose |
|---------|---------------|---------|
| `@types/fluent-ffmpeg` | `^2.x` | TypeScript type definitions for fluent-ffmpeg |

## Version Resolution Notes

- **nanoid@3.3.x**: The latest v3.x CJS-compatible release. Import as `import { nanoid } from 'nanoid'`. Do NOT upgrade to v4+ without ESM migration.
- **@aws-sdk/client-s3 + @aws-sdk/s3-request-presigner**: Both packages must be on matching v3.x minor versions. Install together: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.
- **@nestjs/bullmq**: Version 11.x is compatible with NestJS 11. Check `@nestjs/bullmq` peer dependencies to confirm matching `bullmq` version.
- **fluent-ffmpeg**: The `ffmpeg` system binary must be available in the container (added via `apt-get install -y ffmpeg` in `Dockerfile.dev` per TD-07). `@ffprobe-installer/ffprobe` ships the ffprobe binary — no system install needed for ffprobe.

## MinIO S3 Client Configuration

```typescript
// Key config for MinIO compatibility
new S3Client({
  endpoint: `http://${cfg.endpoint}:${cfg.port}`,
  region: 'us-east-1',               // required by SDK even for MinIO
  credentials: {
    accessKeyId: cfg.accessKey,
    secretAccessKey: cfg.secretKey,
  },
  forcePathStyle: true,               // REQUIRED for MinIO (path-style URLs)
})
```

## BullMQ Configuration

```typescript
// BullModule.forRootAsync — connection to Redis
{
  connection: {
    host: cfg.redisHost,   // 'redis' in compose (service name, not localhost)
    port: cfg.redisPort,   // 6379
  }
}
```

## nanoid Usage (v3.x CJS)

```typescript
import { nanoid } from 'nanoid';
const slug = nanoid();        // 21 chars, URL-safe
const slug14 = nanoid(14);   // custom length
```
