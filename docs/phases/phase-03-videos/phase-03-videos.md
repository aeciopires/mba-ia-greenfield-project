---
kind: phase
name: phase-03-videos
sources_mtime:
  docs/project-plan.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-06-29T00:00:00-03:00"
  docs/phases/phase-03-videos/context.md: "2026-06-29T00:00:00-03:00"
  docs/phases/phase-02-auth/phase-02-auth.md: "2026-06-29T00:00:00-03:00"
---

# Phase 03 — Upload e Processamento de Vídeos

## Objective

Deliver the complete video upload and processing pipeline: presigned-URL-based upload of files up to 10GB directly to MinIO (bypassing the API), automatic draft video registration at upload initiation, BullMQ+Redis background processing queue, a separate video worker container consuming jobs and running FFmpeg for metadata extraction and thumbnail generation, unique URL slugs per video, streaming and download via presigned MinIO URLs, and a status lifecycle (draft → processing → ready | error) persisted in the database.

---

## Step Implementations

### SI-03.1 — Docker Compose: MinIO, Redis, and video-worker Services

**Description:** Extend `nestjs-project/compose.yaml` with three new services — MinIO (object storage), Redis (BullMQ backing), and video-worker (job processor) — and install ffmpeg in `Dockerfile.dev` so the worker container has it available.

**Technical actions:**

- Add `minio` service to `compose.yaml`: image `minio/minio:RELEASE.2025-01-20T14-49-07Z`, ports `9000:9000` (S3 API) and `9001:9001` (console), environment `MINIO_ROOT_USER=streamtube` and `MINIO_ROOT_PASSWORD=streamtube`, command `server /data --console-address ":9001"`, healthcheck `curl -f http://localhost:9000/minio/health/live`, volume `minio_data:/data`
- Add `redis` service to `compose.yaml`: image `redis:7.4-alpine`, port `6379:6379`, healthcheck `redis-cli ping`
- Add `video-worker` service to `compose.yaml`: same `build` and `volumes` as `nestjs-api`, `depends_on: { db: service_healthy, redis: service_healthy, minio: service_healthy }`, command `["npm", "run", "start:worker:dev"]`
- Update `nestjs-api` `depends_on` to also include `redis: { condition: service_healthy }` and `minio: { condition: service_healthy }`
- Add `minio_data:` to the top-level `volumes:` key
- Add `RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*` to `Dockerfile.dev` (before the `USER node` directive)
- Add `"start:worker:dev": "nest start --entryFile worker --watch"` to `nestjs-project/package.json` scripts

**Dependencies:** None

**Acceptance criteria:**

- `docker compose up -d` starts all 6 services (nestjs-api, db, mailpit, minio, redis, video-worker) and all reach `healthy` or `running` state
- `curl -f http://localhost:9000/minio/health/live` returns 200
- MinIO console accessible at `http://localhost:9001` (login: streamtube/streamtube)
- `docker compose exec redis redis-cli ping` returns `PONG`
- `docker compose exec nestjs-api ffmpeg -version` returns the ffmpeg version

---

### SI-03.2 — Config Namespaces: Storage and Queue

**Description:** Create `storage.config.ts` and `queue.config.ts` following the `registerAs` pattern from Phase 01, extend the Joi validation schema with all new environment variables, and update `.env` and `.env.example`.

**Technical actions:**

- Create `src/config/storage.config.ts` — `registerAs('storage', () => ({ endpoint, port, accessKey, secretKey, bucket, useSSL, presignedUrlExpiresIn, publicEndpoint }))` reading env vars `MINIO_ENDPOINT` (default `'minio'`), `MINIO_PORT` (default `9000`), `MINIO_ACCESS_KEY` (required), `MINIO_SECRET_KEY` (required), `MINIO_BUCKET` (default `'streamtube'`), `MINIO_USE_SSL` (default `false`), `PRESIGNED_URL_EXPIRES_IN` (default `7200` — 2 hours for upload URL), `MINIO_PUBLIC_ENDPOINT` (default `'http://localhost:9000'`)
- Create `src/config/queue.config.ts` — `registerAs('queue', () => ({ redisHost, redisPort, videoProcessingQueue }))` reading env vars `REDIS_HOST` (default `'redis'`), `REDIS_PORT` (default `6379`), `VIDEO_PROCESSING_QUEUE` (default `'video-processing'`)
- Update `src/config/env.validation.ts` — add all new env vars to the Joi schema: `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY` as `Joi.string().required()`, others with defaults
- Update `.env` and `.env.example` with MinIO and Redis variables (Docker Compose service name defaults: `MINIO_ENDPOINT=minio`, `REDIS_HOST=redis`)

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/config/env.validation.spec.ts` (update existing) | Unit | Missing `MINIO_ACCESS_KEY` or `MINIO_SECRET_KEY` fails Joi validation |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- Application fails to start when `MINIO_ACCESS_KEY` is missing — Joi validation error logged at bootstrap
- `npx tsc --noEmit` exits with code 0 after adding the new config files

---

### SI-03.3 — StorageModule + StorageService

**Description:** Create the `StorageModule` with an injected `S3Client` configured for MinIO and a `StorageService` exposing presigned URL generation, bucket initialization, and object deletion.

**Technical actions:**

- Install: `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- Create `src/storage/storage.constants.ts` — export `S3_CLIENT = 'S3_CLIENT'` injection token
- Create `src/storage/storage.module.ts` — provides a factory provider for `S3Client` (token: `S3_CLIENT`) using `storageConfig.KEY`; exports `StorageService`; implements `OnModuleInit` delegating to `StorageService.ensureBucketExists()`
- Create `src/storage/storage.service.ts` — injects `S3_CLIENT` and `storageConfig.KEY`; public API:
  - `ensureBucketExists(): Promise<void>` — `HeadBucketCommand`; on `NoSuchBucket` error, `CreateBucketCommand`
  - `generateUploadPresignedUrl(key: string, contentType: string, expiresIn?: number): Promise<string>` — `PutObjectCommand` + `getSignedUrl`
  - `generateDownloadPresignedUrl(key: string, expiresIn?: number, contentDisposition?: string): Promise<string>` — `GetObjectCommand` with optional `ResponseContentDisposition`; `getSignedUrl`
  - `deleteObject(key: string): Promise<void>` — `DeleteObjectCommand`
- S3Client config: `endpoint: http://${cfg.endpoint}:${cfg.port}`, `region: 'us-east-1'`, `forcePathStyle: true` (required for MinIO)

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/storage/storage.service.spec.ts` | Unit | `generateUploadPresignedUrl` calls `PutObjectCommand` with correct key/contentType; `generateDownloadPresignedUrl` passes `ResponseContentDisposition`; `deleteObject` calls `DeleteObjectCommand`; `ensureBucketExists` creates bucket only when `HeadBucketCommand` throws `NoSuchBucket` |
| `src/storage/storage.service.integration-spec.ts` | Integration | Against real MinIO in compose: `ensureBucketExists` idempotent; upload small buffer via presigned PUT URL; HEAD object confirms existence; `generateDownloadPresignedUrl` returns accessible URL; `deleteObject` removes the object |

**Dependencies:** SI-03.2

**Acceptance criteria:**

- `StorageModule` compiles without errors
- Integration test passes: upload 1KB buffer to MinIO via presigned URL, HEAD returns 200, delete removes it

---

### SI-03.4 — QueueModule (BullMQ)

**Description:** Create the `QueueModule` using `@nestjs/bullmq` to register the video processing queue backed by Redis.

**Technical actions:**

- Install: `npm install @nestjs/bullmq bullmq ioredis`
- Create `src/queue/queue.constants.ts` — export `VIDEO_PROCESSING_QUEUE = 'video-processing'` constant
- Create `src/queue/video-processing.queue.ts` — export `VideoProcessingJobData` interface: `{ videoId: string; channelId: string; storageKey: string }`
- Create `src/queue/queue.module.ts` — `BullModule.forRootAsync` injecting `queueConfig.KEY` for Redis connection (`{ host: cfg.redisHost, port: cfg.redisPort }`); `BullModule.registerQueue({ name: VIDEO_PROCESSING_QUEUE })`; exports `BullModule`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/queue/queue.module.spec.ts` | Unit | `QueueModule` compiles with BullMQ wiring |

**Dependencies:** SI-03.2

**Acceptance criteria:**

- `QueueModule` compiles without errors
- `npx tsc --noEmit` exits 0

---

### SI-03.5 — Video Entity + Migration CreateVideos

**Description:** Create the `Video` TypeORM entity with the `VideoStatus` enum and generate the database migration creating the `videos` table with FK, indexes, and enum type.

**Technical actions:**

- Install: `npm install nanoid@3`
- Create `src/videos/entities/video.entity.ts` — `@Entity('videos')` with columns: `id` (uuid PK), `channel_id` (uuid FK → channels.id ON DELETE CASCADE), `title` (varchar(255), not null), `description` (text, nullable), `status` (enum VideoStatus, default `draft`), `storage_key` (varchar, nullable), `thumbnail_key` (varchar, nullable), `duration` (integer, nullable — seconds), `metadata` (jsonb, nullable), `slug` (varchar, unique, not null), `error_message` (text, nullable), `created_at` (CreateDateColumn), `updated_at` (UpdateDateColumn)
- Define `@ManyToOne(() => Channel, { onDelete: 'CASCADE' })` with `@JoinColumn({ name: 'channel_id' })`
- Export `VideoStatus` enum: `DRAFT = 'draft'`, `PROCESSING = 'processing'`, `READY = 'ready'`, `ERROR = 'error'`
- Generate migration: `npm run migration:generate -- src/database/migrations/CreateVideos`; review generated SQL for correct columns, constraints, and FK
- Migration `up()` must: create `videos_status_enum` PostgreSQL enum, create `videos` table, add FK constraint `channel_id → channels.id CASCADE`, create unique index on `slug`, create composite index on `(channel_id, status)`, create index on `(status)`
- Migration `down()` must reverse in order: drop indexes, drop FK, drop table, drop enum

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/entities/video.entity.integration-spec.ts` | Integration | Unique `slug` constraint; FK CASCADE (delete channel → deletes video); `VideoStatus` enum values accepted/rejected; nullable fields accept `null`; default status is `draft` |
| `src/database/migrations.integration-spec.ts` (update) | Integration | Adds `Video` entity and `CreateVideos` migration; asserts `videos` table exists after all migrations run; `undoLastMigration` removes it |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- `npm run migration:run` creates `videos` table with all columns, FK, and indexes
- Unique slug constraint violation raises database error
- Cascade delete: deleting a channel removes all its videos

---

### SI-03.6 — VideosModule Skeleton

**Description:** Create the `VideosModule` wiring together `Video` entity, `StorageModule`, and `QueueModule`.

**Technical actions:**

- Create `src/videos/videos.module.ts` — `TypeOrmModule.forFeature([Video])` in imports; imports `StorageModule` and `QueueModule`; providers: `[VideosService]`; controllers: `[VideosController]`; exports: `[VideosService]`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.module.spec.ts` | Unit | Module compiles with all imports/providers/controllers |

**Dependencies:** SI-03.3, SI-03.4, SI-03.5

**Acceptance criteria:**

- `VideosModule` compiles without errors
- Module spec passes

---

### SI-03.7 — VideosService, DTOs, and Domain Exceptions

**Description:** Implement `VideosService` with all business methods, create DTOs, and add video-specific `DomainException` subclasses.

**Technical actions:**

- Create `src/videos/videos.constants.ts` — `CONTENT_TYPE_TO_EXTENSION: Record<string, string>` map (`'video/mp4': '.mp4'`, `'video/webm': '.webm'`, `'video/ogg': '.ogg'`, `'video/quicktime': '.mov'`); `DEFAULT_VIDEO_EXTENSION = '.mp4'`
- Create `src/videos/dto/create-video.dto.ts` — fields: `title` (`@IsString @IsNotEmpty @MaxLength(255)`), `description` (`@IsString @IsOptional`), `content_type` (`@IsString @IsNotEmpty`) — the MIME type of the video file
- Create `src/videos/dto/query-videos.dto.ts` — fields: `page` (`@IsInt @Min(1) @IsOptional`, default 1), `limit` (`@IsInt @Min(1) @Max(50) @IsOptional`, default 20); use `@Type(() => Number)` for transform
- Add to `src/common/exceptions/domain.exception.ts`: `VideoNotFoundException` (HTTP 404, code `VIDEO_NOT_FOUND`), `VideoNotInDraftStatusException` (HTTP 409, code `VIDEO_NOT_IN_DRAFT_STATUS`)
- Add to `src/channels/channels.service.ts`: `findByUserId(userId: string): Promise<Channel | null>` — `findOne({ where: { user_id: userId } })` using the injected `Channel` repository (already available in `ChannelsModule`)
- Create `src/videos/videos.service.ts` — injects `Repository<Video>` (via `@InjectRepository(Video)`), `StorageService`, `Queue<VideoProcessingJobData>` (via `@InjectQueue(VIDEO_PROCESSING_QUEUE)`), `storageConfig.KEY`:
  - `initiateUpload(channelId: string, dto: CreateVideoDto): Promise<{ video: Video; presigned_upload_url: string }>` — generates `slug = nanoid()`, derives `storage_key = channels/${channelId}/videos/${slug}/original${ext}`, saves `Video` entity with `status = DRAFT`, calls `storageService.generateUploadPresignedUrl(storage_key, dto.content_type, presignedUrlExpiresIn)`, returns both
  - `startProcessing(videoId: string, channelId: string): Promise<Video>` — finds video where `id = videoId AND channel_id = channelId AND status = DRAFT`; throws `VideoNotFoundException` if not found; throws `VideoNotInDraftStatusException` if video exists but has wrong status; updates `status = PROCESSING`, saves; publishes job with `{ videoId, channelId, storageKey }` and options `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }`; returns updated video
  - `findAll(query: QueryVideosDto): Promise<{ data: Video[]; total: number }>` — finds `status = READY` with `skip` and `take` for pagination; returns data + total
  - `findBySlug(slug: string): Promise<Video>` — finds `status = READY AND slug = slug`; throws `VideoNotFoundException` if not found
  - `getStreamUrl(slug: string): Promise<string>` — finds READY video by slug; returns `storageService.generateDownloadPresignedUrl(storage_key, 3600)`
  - `getDownloadUrl(slug: string): Promise<string>` — finds READY video by slug; returns `storageService.generateDownloadPresignedUrl(storage_key, 3600, 'attachment; filename="<title>.mp4"')`
  - `delete(videoId: string, channelId: string): Promise<void>` — finds video where `id = videoId AND channel_id = channelId`; throws `VideoNotFoundException` if not found; calls `storageService.deleteObject` for `storage_key` and `thumbnail_key` if non-null; deletes entity

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` | Unit | `initiateUpload`: generates slug, saves draft, calls presigned URL, returns both; `startProcessing`: finds draft, transitions to processing, publishes job; throws `VideoNotFoundException` for unknown/wrong-owner video; throws `VideoNotInDraftStatusException` for non-draft; `findAll`: pagination, only READY; `findBySlug`: throws for non-READY; `delete`: calls `deleteObject` for both keys, skips null keys; `getStreamUrl`/`getDownloadUrl`: calls `generateDownloadPresignedUrl` with correct args |

**Dependencies:** SI-03.6

**Acceptance criteria:**

- All unit tests pass
- `npx tsc --noEmit` exits 0

---

### SI-03.8 — VideosController

**Description:** Create `VideosController` with 7 endpoints following the API Contracts.

**Technical actions:**

- Create `src/videos/videos.controller.ts` — `@ApiTags('videos')`, `@Controller('videos')`; injects `VideosService` and `ChannelsService`:
  - `POST /videos` (`@Post()`) — authenticated; extracts `@CurrentUser() user`; resolves `channel` via `channelsService.findByUserId(user.sub)` (throws 404 via standard NestJS exception if no channel); calls `videosService.initiateUpload(channel.id, dto)`; returns 201 `{ video, presigned_upload_url }`
  - `PATCH /videos/:id/start-processing` (`@Patch(':id/start-processing')`) — authenticated; resolves channel; calls `videosService.startProcessing(id, channel.id)`; returns 200 updated video
  - `GET /videos` (`@Get()`, `@Public()`) — calls `videosService.findAll(query)`; returns 200 `{ data, total, page, limit }`
  - `GET /videos/:slug` (`@Get(':slug')`, `@Public()`) — calls `videosService.findBySlug(slug)`; returns 200 video
  - `GET /videos/:slug/stream` (`@Get(':slug/stream')`, `@Public()`) — calls `videosService.getStreamUrl(slug)`; uses `@Res() res: Response` to `res.redirect(302, url)`; no body
  - `GET /videos/:slug/download` (`@Get(':slug/download')`, `@Public()`) — calls `videosService.getDownloadUrl(slug)`; uses `@Res() res: Response` to `res.redirect(302, url)`
  - `DELETE /videos/:id` (`@Delete(':id')`, `@HttpCode(204)`) — authenticated; resolves channel; calls `videosService.delete(id, channel.id)`; returns 204 no body
- Add `@ApiBearerAuth('access-token')` and `@ApiResponse` decorators for OpenAPI documentation on authenticated endpoints
- `ChannelsModule` must be imported by `VideosModule` (add to imports) so `ChannelsService` is available

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.controller.spec.ts` | Unit | Each endpoint calls the correct service method with correct args; 302 redirect set correctly for stream/download; 204 returned for delete; `@Public()` routes are accessible without JWT mock |

**Dependencies:** SI-03.7

**Acceptance criteria:**

- Controller compiles without errors
- Unit tests pass
- `npx tsc --noEmit` exits 0

---

### SI-03.9 — app.module.ts Updates

**Description:** Register `StorageModule`, `QueueModule`, and `VideosModule` in `AppModule` and add new config namespaces to the `ConfigModule` load array.

**Technical actions:**

- Update `src/app.module.ts`: add `storageConfig` and `queueConfig` to `ConfigModule.forRoot({ load: [...] })` array
- Add `StorageModule`, `QueueModule`, `VideosModule` to `AppModule` imports
- Ensure `ChannelsModule` is exported from `ChannelsModule` so `VideosModule` can import it (already exports `ChannelsService` — verify)

**Dependencies:** SI-03.6, SI-03.8

**Acceptance criteria:**

- Application starts without errors (`docker compose exec nestjs-api npm run start:dev`)
- Existing `GET /` returns 200 (no regressions)
- `GET /videos` returns 200 with empty list `{ data: [], total: 0 }`
- Swagger at `/api` shows `videos` tag with all 7 endpoints

---

### SI-03.10 — Video Worker (worker.ts, WorkerModule, VideoProcessingProcessor)

**Description:** Create the standalone NestJS worker application entry point, a minimal `WorkerModule`, and the BullMQ processor that runs FFmpeg to extract metadata and generate thumbnails.

**Technical actions:**

- Install: `npm install fluent-ffmpeg @ffprobe-installer/ffprobe && npm install --save-dev @types/fluent-ffmpeg`
- Add `"start:worker:dev": "nest start --entryFile worker --watch"` to `package.json` scripts (may already be added in SI-03.1)
- Create `src/worker.ts` — bootstraps `NestFactory.createApplicationContext(WorkerModule)` (no HTTP server, no port); add `process.on('SIGTERM', async () => { await app.close(); process.exit(0) })`
- Create `src/worker.module.ts` — `WorkerModule` imports: `ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig, storageConfig, queueConfig], validationSchema: envValidationSchema })`, `TypeOrmModule.forRootAsync` (same factory as AppModule), `StorageModule`, `QueueModule`, `TypeOrmModule.forFeature([Video])`; providers: `[VideoProcessingProcessor]`
- Create `src/videos/processors/video-processing.processor.ts` — `@Processor(VIDEO_PROCESSING_QUEUE)` class; injects `@InjectRepository(Video) videoRepository`, `StorageService`; implements `@Process()` async method:
  1. Find video by `job.data.videoId`; if not found log warning and return
  2. Download video from MinIO via `GetObjectCommand` streaming to a temp file in `/tmp`
  3. Run `ffprobe(tempFile)` to extract duration (seconds) and format metadata
  4. Calculate thumbnail timestamp: `Math.floor(duration * 0.1)` seconds (10% of duration, min 1s)
  5. Generate thumbnail via `ffmpeg(tempFile).screenshots({ timestamps: [timestamp], filename: 'thumb.jpg', folder: '/tmp' })`
  6. Upload thumbnail to MinIO: `thumbnail_key = channels/${channelId}/videos/${slug}/thumbnail.jpg`; use `@aws-sdk/client-s3` `PutObjectCommand` with the thumbnail buffer
  7. Update video: `status = READY`, `duration`, `metadata`, `thumbnail_key`; save
  8. Cleanup temp files
  9. On any error: catch, update video `status = ERROR`, `error_message = error.message`; save; rethrow so BullMQ records the failure and triggers retry

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/processors/video-processing.processor.spec.ts` | Unit | Happy path: downloads file, calls ffprobe, generates thumbnail, uploads, updates status to READY; Failure path: error during ffprobe → status = ERROR with error_message; missing video ID → logs warning without throwing |

**Dependencies:** SI-03.3, SI-03.4, SI-03.5, SI-03.9

**Acceptance criteria:**

- Worker container starts without errors: `docker compose logs video-worker`
- Unit tests pass
- Worker logs show job processing when `PATCH /videos/:id/start-processing` is called

---

### SI-03.11 — Unit Tests

**Description:** Ensure comprehensive unit test coverage for `VideosService`, `StorageService`, and `VideoProcessingProcessor`. Tests written using NestJS testing module with mocked dependencies.

**Technical actions:**

- Complete/verify `src/videos/videos.service.spec.ts` (started in SI-03.7) — all 7 service methods tested with mock `Repository<Video>`, mock `StorageService`, mock `Queue`; edge cases: null `storage_key`/`thumbnail_key` on delete, pagination boundary, non-existent slug
- Complete/verify `src/storage/storage.service.spec.ts` (started in SI-03.3) — mock `S3Client.send` with `jest.fn()`; test: `generateUploadPresignedUrl` includes `ContentType` in command; `generateDownloadPresignedUrl` passes `ResponseContentDisposition` when contentDisposition arg provided; `ensureBucketExists` skips `CreateBucketCommand` when `HeadBucketCommand` succeeds; `deleteObject` sends correct key
- Complete/verify `src/videos/processors/video-processing.processor.spec.ts` (started in SI-03.10) — mock `videoRepository`, `StorageService`, `fluent-ffmpeg` module; happy path → READY; ffprobe error → ERROR with message

**Dependencies:** SI-03.7, SI-03.10

**Acceptance criteria:**

- `npm test -- --runInBand` passes all unit tests with no failures
- Coverage includes all service methods and error branches

---

### SI-03.12 — Integration Tests

**Description:** Write integration tests that exercise the `Video` entity constraints against a real database and `StorageService` operations against the real MinIO instance from Docker Compose.

**Technical actions:**

- Complete/verify `src/videos/entities/video.entity.integration-spec.ts` (started in SI-03.5) — connects to real test DB; tests: slug unique constraint, FK cascade delete, all `VideoStatus` enum values, nullable fields, default status `draft`
- Complete/verify `src/storage/storage.service.integration-spec.ts` (started in SI-03.3) — connects to real MinIO; `beforeAll` calls `ensureBucketExists()`; tests: upload 1KB buffer via presigned PUT URL, HEAD object returns 200, download presigned URL accessible, content-disposition header on download URL, `deleteObject` removes object; `afterAll` cleans test objects
- Update `src/database/migrations.integration-spec.ts` — add `Video` to entity list, add `CreateVideos` migration to migrations array; assert 3 migrations total, `videos` table present after run, `undoLastMigration` removes it; re-run migrations in `afterAll` to restore state
- Update `src/test/create-test-data-source.ts` — add `DELETE FROM "videos"` to `cleanAllTables` function (before `DELETE FROM "channels"` due to FK)

**Dependencies:** SI-03.5, SI-03.3

**Acceptance criteria:**

- `npm test -- --runInBand src/videos/entities/video.entity.integration-spec.ts` passes
- `npm test -- --runInBand src/storage/storage.service.integration-spec.ts` passes
- `npm test -- --runInBand src/database/migrations.integration-spec.ts` passes

---

### SI-03.13 — E2E Tests

**Description:** Write end-to-end tests that exercise the full video upload flow via HTTP using supertest, including presigned URL upload to MinIO, start-processing, listing, streaming redirect, download redirect, and delete.

**Technical actions:**

- Create `test/videos.e2e-spec.ts` — full NestJS app boot (same pattern as `auth.e2e-spec.ts`); `beforeAll`: register + confirm + login a test user; obtain `access_token` and `channel_id` (via `GET /auth/me` or stored from registration); `overrideProvider(getQueueToken(VIDEO_PROCESSING_QUEUE)).useValue({ add: jest.fn() })` to mock queue (worker not running in E2E test environment)
- Test suites:
  - `POST /videos`: 201 with `{ video: { status: 'draft', slug: string }, presigned_upload_url: string }`; 401 without token
  - `PATCH /videos/:id/start-processing`: after uploading small buffer to `presigned_upload_url` via axios/node-fetch, 200 with `{ status: 'processing' }`; 409 if called twice; 401 without token; 404 for another user's video
  - `GET /videos`: 200 with `{ data: [], total: 0 }` when no READY videos
  - `GET /videos/:slug`: 404 for draft/processing video; 404 for unknown slug
  - `GET /videos/:slug/stream`: 302 with `Location` header for READY video; 404 for draft
  - `GET /videos/:slug/download`: 302 with `Location` header containing `content-disposition=attachment`
  - `DELETE /videos/:id`: 204; 401 without token; 404 for another user's video
- For stream/download tests, a helper function manually sets a video to `READY` status in the DB (direct repository update) bypassing the worker
- `afterAll`: clean all video records and MinIO test objects; `cleanAllTables`

**Dependencies:** SI-03.8, SI-03.9

**Acceptance criteria:**

- `npm run test:e2e -- --testPathPattern=videos` passes all E2E tests
- No regressions in existing `auth.e2e-spec.ts` (run full E2E suite)

---

### SI-03.14 — CLAUDE.md Updates

**Description:** Update both CLAUDE.md files (root and `nestjs-project/`) to reflect the Phase 03 additions: MinIO, Redis, video-worker services, video module endpoints, and queue/storage configuration.

**Technical actions:**

- Update root `CLAUDE.md`:
  - In the "Architecture (C4 Container Diagram)" section: replace "Message Queue (TBD)" with "Message Queue (BullMQ + Redis)"
  - In "Object Storage (S3/MinIO)": confirm "MinIO in development (Docker Compose), S3 in production"
- Update `nestjs-project/CLAUDE.md`:
  - Add `minio`, `redis`, and `video-worker` to the Docker Compose services list with their ports
  - Add `npm run start:worker:dev` command documentation
  - Add MinIO and Redis environment variables to the env section
  - Add `videos/` module to the module list with its endpoints and purpose
  - Add note about the `storage/` and `queue/` shared modules

**Dependencies:** SI-03.1 (new services exist to document)

**Acceptance criteria:**

- Both CLAUDE.md files reference the same ports, service names, and module structure that exist in the code
- No references to "TBD" for the queue technology remain

---

## Technical Specifications

### Data Model

**Table: `videos`**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, auto-generated | |
| channel_id | uuid | FK → channels.id, ON DELETE CASCADE, NOT NULL | |
| title | varchar(255) | NOT NULL | |
| description | text | nullable | |
| status | enum(draft,processing,ready,error) | NOT NULL, default `draft` | |
| storage_key | varchar | nullable | MinIO object key: `channels/{id}/videos/{slug}/original.{ext}` |
| thumbnail_key | varchar | nullable | MinIO object key: `channels/{id}/videos/{slug}/thumbnail.jpg` |
| duration | integer | nullable | Duration in seconds, extracted by ffprobe |
| metadata | jsonb | nullable | Raw ffprobe format output |
| slug | varchar | UNIQUE, NOT NULL | nanoid(21), URL-safe |
| error_message | text | nullable | Set when status = error |
| created_at | timestamp with time zone | auto (CreateDateColumn) | |
| updated_at | timestamp with time zone | auto (UpdateDateColumn) | |

**Indexes:**
- `UNIQUE idx_videos_slug ON videos(slug)`
- `idx_videos_channel_status ON videos(channel_id, status)` — listing a channel's ready videos
- `idx_videos_status ON videos(status)` — worker queries

**Enum:** `videos_status_enum` PostgreSQL enum with values: `draft`, `processing`, `ready`, `error`

### API Contracts

**POST /videos** — Initiate video upload

Request (authenticated):
```json
{
  "title": "My Video",
  "description": "Optional description",
  "content_type": "video/mp4"
}
```
Response 201:
```json
{
  "video": {
    "id": "uuid",
    "channel_id": "uuid",
    "title": "My Video",
    "description": "Optional description",
    "status": "draft",
    "storage_key": "channels/{id}/videos/{slug}/original.mp4",
    "thumbnail_key": null,
    "duration": null,
    "metadata": null,
    "slug": "nanoid21chars",
    "error_message": null,
    "created_at": "2026-06-29T00:00:00.000Z",
    "updated_at": "2026-06-29T00:00:00.000Z"
  },
  "presigned_upload_url": "http://minio:9000/streamtube/channels/...?X-Amz-Signature=..."
}
```

**PATCH /videos/:id/start-processing** — Notify upload complete

Response 200: updated `Video` object with `status: "processing"`

**GET /videos** — List ready videos

Query params: `page` (default 1), `limit` (default 20, max 50)

Response 200:
```json
{
  "data": [ /* Video[] with status=ready */ ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

**GET /videos/:slug** — Get video details

Response 200: `Video` object (only `status = ready` videos returned; 404 otherwise)

**GET /videos/:slug/stream** — Stream video

Response 302: `Location: <presigned-minio-url>` — client streams directly from MinIO (supports Range requests / 206 Partial Content natively)

**GET /videos/:slug/download** — Download video

Response 302: `Location: <presigned-minio-url-with-attachment>` — URL includes `response-content-disposition=attachment%3B+filename%3D%22...%22`

**DELETE /videos/:id** — Delete video

Response 204: no body

### Authorization Matrix

| Endpoint | Auth Required | Notes |
|----------|--------------|-------|
| POST /videos | Yes (Bearer JWT) | User must own a channel |
| PATCH /videos/:id/start-processing | Yes (Bearer JWT) | Video must belong to user's channel |
| GET /videos | No (`@Public()`) | Only READY videos returned |
| GET /videos/:slug | No (`@Public()`) | 404 if not READY |
| GET /videos/:slug/stream | No (`@Public()`) | 404 if not READY |
| GET /videos/:slug/download | No (`@Public()`) | 404 if not READY |
| DELETE /videos/:id | Yes (Bearer JWT) | Video must belong to user's channel |

Ownership check: controller resolves `channelId` via `channelsService.findByUserId(user.sub)` and passes it to the service. The service includes `channel_id = channelId` in all WHERE clauses — if video not found for that combination, throws `VideoNotFoundException` (404), which leaks no ownership information.

### Error Catalog

New errors added to `src/common/exceptions/domain.exception.ts`:

| Code | HTTP Status | Class | Message |
|------|-------------|-------|---------|
| `VIDEO_NOT_FOUND` | 404 | `VideoNotFoundException` | "Video not found" |
| `VIDEO_NOT_IN_DRAFT_STATUS` | 409 | `VideoNotInDraftStatusException` | "Video is not in draft status" |

### Events/Messages

**BullMQ Queue Name:** `video-processing` (from `VIDEO_PROCESSING_QUEUE` constant)

**Job Data:**
```typescript
interface VideoProcessingJobData {
  videoId: string;    // UUID of the Video entity
  channelId: string;  // UUID of the Channel (for thumbnail storage key)
  storageKey: string; // MinIO object key of the uploaded video
}
```

**Job Options:**
```typescript
{ attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
// Retries: immediately, then 5s, then 25s (exponential backoff)
```

**Job Producer:** `VideosService.startProcessing()` via `@InjectQueue(VIDEO_PROCESSING_QUEUE)`

**Job Consumer:** `VideoProcessingProcessor` in `src/videos/processors/video-processing.processor.ts`

**Success outcome:** Video updated: `status = READY`, `duration = <seconds>`, `metadata = <ffprobe output>`, `thumbnail_key = channels/{id}/videos/{slug}/thumbnail.jpg`

**Failure outcome:** Video updated: `status = ERROR`, `error_message = <error.message>`; BullMQ marks job as failed; retry triggered per backoff policy

---

## Dependency Map

```
SI-03.1 (compose.yaml + Dockerfile.dev)
└── SI-03.2 (storage.config + queue.config + env.validation)
    ├── SI-03.3 (StorageModule + StorageService)
    │   ├── [integration test] → real MinIO
    │   └── SI-03.6 ──────────────────────────────────────────────────────────┐
    └── SI-03.4 (QueueModule + BullMQ)                                        │
        └── SI-03.6 ──────────────────────────────────────────────────────────┤
                                                                               │
SI-03.5 (Video entity + migration CreateVideos)                               │
    ├── [integration test] → real DB                                           │
    └── SI-03.6 ──────────────────────────────────────────────────────────────┘
                                                                               │
SI-03.6 (VideosModule skeleton) ◄─────────────────────────────────────────────┘
    └── SI-03.7 (VideosService + DTOs + DomainExceptions)
        └── SI-03.8 (VideosController)
            └── SI-03.9 (app.module.ts updates)
                └── SI-03.10 (worker.ts + WorkerModule + VideoProcessingProcessor)
                    ├── SI-03.11 (unit tests: all three spec files)
                    ├── SI-03.12 (integration tests: entity + migrations + storage)
                    └── SI-03.13 (E2E tests: full upload flow)

SI-03.14 (CLAUDE.md updates) — depends on SI-03.1, can run at end
```

**Linearized execution order:**
SI-03.1 → SI-03.2 → SI-03.3 + SI-03.4 (parallel) → SI-03.5 → SI-03.6 → SI-03.7 → SI-03.8 → SI-03.9 → SI-03.10 → SI-03.11 → SI-03.12 → SI-03.13 → SI-03.14

---

## Deliverables

- [ ] `docs/decisions/technical-decisions-phase-03-videos.md` — all 9 TDs decided and justified
- [ ] `docs/phases/phase-03-videos/context.md` — scope, decisions index, capability coverage
- [ ] `docs/phases/phase-03-videos/validation.md` — `status: clean`
- [ ] `docs/phases/phase-03-videos/library-refs.md` — all new libraries with versions
- [ ] `docs/phases/phase-03-videos/phase-03-videos.md` — this plan (SI-03.1..SI-03.14)
- [ ] `docs/phases/phase-03-videos/progress.md` — updated as SIs complete
- [ ] `nestjs-project/compose.yaml` — minio, redis, video-worker services added
- [ ] `nestjs-project/Dockerfile.dev` — ffmpeg installed via apt
- [ ] `nestjs-project/src/config/storage.config.ts` + `queue.config.ts` — new namespaces
- [ ] `nestjs-project/src/config/env.validation.ts` — MinIO + Redis vars added
- [ ] `nestjs-project/src/storage/` — `StorageModule` + `StorageService`
- [ ] `nestjs-project/src/queue/` — `QueueModule` + constants + job data interface
- [ ] `nestjs-project/src/videos/` — `VideosModule`, `VideosService`, `VideosController`, DTOs, entity, processor
- [ ] `nestjs-project/src/database/migrations/<timestamp>-CreateVideos.ts` — creates `videos` table
- [ ] `nestjs-project/src/worker.ts` + `worker.module.ts` — worker bootstrap
- [ ] Tests passing: `npm test -- --runInBand` (unit + integration) + `npm run test:e2e`
- [ ] `npx tsc --noEmit` exits with code 0
- [ ] `npm run lint` exits with code 0
- [ ] `CLAUDE.md` (root) and `nestjs-project/CLAUDE.md` updated and consistent with code
