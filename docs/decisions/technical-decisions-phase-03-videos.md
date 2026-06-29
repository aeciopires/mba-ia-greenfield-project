---
scope_type: phase
related_phases: [3]
status: decided
date: 2026-06-29
scope_description: "Backend infrastructure and feature set for video upload (up to 10GB), background processing queue, video worker (FFmpeg), object storage (MinIO/S3), streaming, download, and unique URL generation."
---

# Technical Decisions — Phase 03: Upload e Processamento de Vídeos

_Subprojects in scope:_

- `nestjs-project/` — backend delivering video upload initiation, processing queue, video worker container, object storage integration, streaming and download endpoints, and unique URL generation.
- `next-frontend/` — frontend deferred: video upload UI and player are out of scope for this phase.

---

## TD-01: Upload Strategy for Files Up to 10GB

**Scope:** Backend

**Capability:** Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance

**Context:** Allowing users to upload video files up to 10GB raises a critical architecture decision: should the file pass through the NestJS API, or should clients upload directly to object storage? Routing 10GB through the API would block the event loop, exhaust memory, and make the API unresponsive for the duration of the upload.

**Options:**

### Option A: Presigned URL (Client Uploads Directly to MinIO/S3)
- The API generates a time-limited presigned PUT URL pointing directly to MinIO. The client uploads the file to MinIO via that URL without involving the API server. After the upload finishes, the client calls a lightweight API endpoint to trigger processing.
- **Pros:** API never handles the file bytes — no memory pressure, no event-loop blocking, no streaming overhead. Native S3 multipart support for resilient large uploads. Works with any HTTP client on any platform. URL expires automatically (e.g., 2 hours), limiting the attack surface. Standard industry pattern (YouTube, Cloudflare Stream, AWS S3 direct upload).
- **Cons:** Requires the client to implement two steps (get URL, upload, notify). CORS must be configured on MinIO to allow browser-origin PUT requests. Content-type must be specified at URL generation time.

### Option B: Multipart Upload Through the API (Chunked)
- The client splits the file into chunks (e.g., 5MB) and sends each chunk to the API via `multipart/form-data`. The API receives each chunk, pipes it to MinIO, and reassembles.
- **Pros:** Single upload surface (only the API). Simpler client-side implementation (one endpoint). Allows server-side validation of each chunk.
- **Cons:** Every byte passes through the NestJS process — for a 10GB file this saturates memory and blocks the event loop. Requires complex chunking/reassembly logic on the API side. Does not scale beyond single-instance deployments. Explicitly the "wrong" approach mentioned in TASK.md.

### Option C: Streaming Proxy Through the API
- The API accepts a streaming `multipart/form-data` upload and pipes each byte directly to MinIO as it arrives, without buffering.
- **Pros:** Avoids full file buffering in memory. Preserves a single API upload surface.
- **Cons:** Still saturates the API's network interface for the entire upload duration. Backpressure between client and MinIO is complex to manage. Adds significant latency versus direct MinIO upload. Still passes all bytes through the NestJS process.

**Recommendation:** **Option A (Presigned URL)** — The only architecture that does not route file bytes through the API. Industry-standard approach. MinIO fully supports presigned PUT URLs with S3-compatible API. The two-step client flow (get URL → upload → notify) is straightforward and testable.

**Decision:** A (Presigned URL — client uploads directly to MinIO)

---

## TD-02: Background Queue Technology

**Scope:** Backend

**Capability:** Serviço de processamento em segundo plano (filas)

**Context:** After a video is uploaded, processing (FFmpeg metadata extraction, thumbnail generation, status updates) must happen asynchronously without blocking the API. A message queue is required. The project plan explicitly leaves this decision as "TBD". This is the primary stack decision for Phase 03.

**Options:**

### Option A: BullMQ + Redis
- BullMQ is a Redis-based queue library for Node.js. `@nestjs/bullmq` provides first-class NestJS integration with `@Processor`, `@Process`, `InjectQueue`, and `BullModule` decorators and modules.
- **Pros:** Native NestJS module (`@nestjs/bullmq`) with DI integration. Retry with exponential backoff built-in. Job priority, delay, rate limiting, and concurrency control. Persistent jobs survive process restarts (Redis-backed). Bull Board UI for job monitoring. Redis adds fast key-value cache capability beyond queuing. Well-documented with large ecosystem. Active maintenance (NestJS team officially supports `@nestjs/bullmq`).
- **Cons:** Requires a Redis instance (new infrastructure). Redis is more infrastructure than pg-boss (which reuses Postgres). BullMQ v4+ requires `ioredis` v5+.

### Option B: pg-boss (PostgreSQL-based Queue)
- pg-boss is a queue library that uses PostgreSQL as the backing store — no new infrastructure. A dedicated `pgboss` schema manages job tables.
- **Pros:** Reuses existing PostgreSQL infrastructure (no Redis). Transactional job enqueue within Postgres transactions. No new service in compose.yaml.
- **Cons:** No official NestJS integration module. Queue operations add load to the primary database. Less feature-rich than BullMQ (no rate limiting, less concurrency control). Smaller ecosystem. Performance limited by PostgreSQL throughput.

### Option C: RabbitMQ (AMQP)
- Full-featured message broker with exchanges, bindings, and routing keys. `@nestjs/microservices` provides AMQP transport.
- **Pros:** Enterprise-grade message broker. Publish/subscribe, fan-out, routing patterns. Dead-letter exchanges for failed messages. Decoupled producer/consumer.
- **Cons:** Significant operational overhead (exchanges, queues, bindings configuration). Overkill for a single-worker video processing pipeline. No official NestJS BullMQ-equivalent DI integration — requires microservices architecture pattern. AMQP adds learning curve. More compose services and configuration.

**Recommendation:** **Option A (BullMQ + Redis)** — Best NestJS integration, feature set appropriate for video processing (retry, backoff, concurrency), and Redis adds infrastructure value beyond queuing (future caching). pg-boss would save one service but at the cost of database coupling. RabbitMQ is overkill for this use case.

**Decision:** A (BullMQ + Redis)

**Libraries:** `@nestjs/bullmq@^11.x`, `bullmq@^5.x`, `ioredis@^5.x`

---

## TD-03: Video Worker Deployment

**Scope:** Backend + Infrastructure

**Capability:** Serviço de processamento em segundo plano (filas)

**Context:** The video worker consumes BullMQ jobs from Redis, downloads the video from MinIO, runs FFmpeg, and updates the database. The question is how the worker is deployed relative to the API.

**Options:**

### Option A: Separate Docker Container with Shared NestJS Codebase
- The worker is a separate service in `compose.yaml`, built from the same `Dockerfile.dev`. A separate entry file (`src/worker.ts`) bootstraps a minimal `NestFactory.createApplicationContext(WorkerModule)` (no HTTP server). The `WorkerModule` imports only what the worker needs: Config, TypeORM, Queue, Storage, and the processor class.
- **Pros:** Clear separation of concerns — API container handles HTTP, worker container handles processing. Independent scaling. Worker crash does not affect API. Shared codebase eliminates code duplication (same entities, config, storage service). Standard container-per-responsibility pattern. Matches the architecture diagram in `docs/diagrams/software-arch.mermaid`.
- **Cons:** Two containers to manage. Worker module must carefully avoid importing API-only dependencies (HTTP modules, guards, Swagger).

### Option B: Worker Runs Inside the API Container (Same Process)
- The `@Processor` class is imported by `AppModule` alongside controllers. The same NestJS process handles both HTTP requests and queue jobs.
- **Pros:** Single container — simpler compose setup. No separate entry file.
- **Cons:** FFmpeg processing competes for CPU with HTTP request handling — degrades API response times under load. Cannot scale the worker independently. A crashed FFmpeg job can affect the API process. Violates separation of concerns. Does not match the architecture diagram.

### Option C: Standalone Worker Process (Plain Node.js)
- A completely separate Node.js script (not NestJS) consumes BullMQ jobs and runs FFmpeg.
- **Pros:** Minimal overhead — no NestJS bootstrap cost. Simple script.
- **Cons:** Cannot reuse NestJS services (StorageService, config, TypeORM repositories) without duplicating them. No DI, no config validation, no TypeORM entity types. Maintenance burden of two codebases.

**Recommendation:** **Option A (Separate Docker Container with Shared NestJS Codebase)** — Clean architecture aligned with the project diagram. Shared codebase prevents duplication. `createApplicationContext` is the correct NestJS API for non-HTTP apps.

**Decision:** A (Separate container, `src/worker.ts` entry, `WorkerModule`)

---

## TD-04: Video Streaming Strategy

**Scope:** Backend

**Capability:** Reprodução via streaming (sem necessidade de download completo)

**Context:** Video streaming requires serving byte ranges (HTTP Range requests / 206 Partial Content) so video players can seek without downloading the entire file. The question is whether the API proxies the stream or redirects the client to object storage.

**Options:**

### Option A: Redirect to Presigned GET URL (302)
- The API generates a presigned GET URL for the video object in MinIO and returns a `302 Found` redirect. The client (browser/player) follows the redirect and streams directly from MinIO. MinIO natively handles HTTP Range requests.
- **Pros:** Zero streaming load on the API — MinIO serves all bytes. No backpressure management. MinIO's Range support is native and battle-tested. Simple implementation (one `storageService.generateDownloadPresignedUrl()` call + `res.redirect(302, url)`). Presigned URL expiry limits access duration.
- **Cons:** Client sees the MinIO URL (presigned, time-limited — acceptable). CORS on MinIO must allow the browser origin for direct streaming. Requires the MinIO public endpoint to be accessible from the client's network (works for local dev; in production, MinIO sits behind a CDN or public-facing URL).

### Option B: Stream Proxy Through the API (Range Pass-Through)
- The API receives Range requests, issues a corresponding `GetObjectCommand` to MinIO with a `Range` header, and pipes the response bytes back to the client with the correct `206 Partial Content` status.
- **Pros:** Hides the storage URL from clients. Allows the API to intercept and log streaming access. Can apply auth before serving bytes.
- **Cons:** Every byte of every stream passes through the API — significant CPU and memory overhead for concurrent streamers. Complex backpressure management between MinIO stream and client response. API becomes a bottleneck. Streaming is public (no auth required per TASK.md) — the overhead is not justified by access control.

### Option C: MinIO CDN / Public Bucket
- The MinIO bucket is made public; the API returns a permanent (non-presigned) URL. No redirect needed.
- **Pros:** Zero URL generation overhead on the API.
- **Cons:** All objects are publicly readable without any expiry — no access control possible. Object keys are guessable if the pattern is known. Violates the principle of least privilege.

**Recommendation:** **Option A (302 Redirect to Presigned GET URL)** — Zero API overhead, MinIO handles Range natively, time-limited access via presigned URL expiry. Standard pattern for streaming from object storage.

**Decision:** A (302 redirect to presigned GET URL; MinIO handles Range/206 natively)

---

## TD-05: Unique Video URL Identifier

**Scope:** Backend

**Capability:** URL única por vídeo, sem conflito com outros vídeos

**Context:** Each video needs a short, unique, URL-safe identifier used in public URLs (e.g., `/videos/:slug`). The identifier must be collision-resistant and not expose sequential IDs.

**Options:**

### Option A: nanoid (URL-safe random string)
- Generate a 21-character URL-safe random string using the `nanoid` library. Default alphabet: `A-Za-z0-9_-`. At 21 chars, collision probability is ~1% after generating 149 billion IDs.
- **Pros:** Short (21 chars vs. 36 for UUID), URL-safe by design, no separators. De facto standard for URL slugs in Node.js. Cryptographically random. Simple API: `nanoid()`.
- **Cons:** nanoid v4+ is ESM-only — incompatible with CommonJS NestJS builds without special handling. Must pin to v3.x (last CJS-compatible version) or configure a dynamic import shim.

### Option B: UUID v4 (formatted as slug)
- Use Node.js built-in `crypto.randomUUID()` (available since Node 14.17). Use as-is or strip hyphens for a 32-char hex string.
- **Pros:** No extra dependency. Built-in Node.js API. Standard format.
- **Cons:** UUIDs with hyphens (36 chars) are long for URLs. Without hyphens (32 chars) still longer than nanoid (21). Less readable in URLs. `crypto.randomUUID()` uses the same RFC 4122 spec — same collision resistance as nanoid.

### Option C: hashids / sqids (numeric-to-string encoding)
- Encode the numeric auto-increment ID (or a sequence) into a short alphanumeric string.
- **Pros:** Deterministic and reversible (can decode back to ID). Very short if IDs are small.
- **Cons:** Requires sequential numeric ID — conflicts with UUID PK strategy. Reversible encoding means IDs are enumerable. Adds a dependency. More complex setup.

**Recommendation:** **Option A (nanoid v3.x)** — Shortest, most URL-appropriate format. Widely used for slugs in Node.js. CJS compatibility maintained by pinning to v3.3.x.

**Decision:** A (nanoid@^3.3.x, 21-char URL-safe slug)

**Libraries:** `nanoid@^3.3.x`

---

## TD-06: Thumbnail Generation Strategy

**Scope:** Backend (Worker)

**Capability:** Geração automática de thumbnail a partir de um frame do vídeo

**Context:** The video worker must generate a thumbnail image automatically after upload. The thumbnail must be extracted from the video without a separate service.

**Options:**

### Option A: FFmpeg in Worker (via fluent-ffmpeg)
- Use `fluent-ffmpeg` (Node.js FFmpeg wrapper) and `@ffprobe-installer/ffprobe` (prebuilt ffprobe binary) in the worker container to extract a frame at a specified timestamp and generate a JPEG thumbnail.
- **Pros:** FFmpeg is the industry standard for video processing. Single container handles all processing (metadata + thumbnail). `fluent-ffmpeg` provides a clean Node.js API. `@ffprobe-installer/ffprobe` ships a prebuilt binary — no system-level install needed for ffprobe. Thumbnail timestamp can be set to 10% of duration for a representative frame.
- **Cons:** FFmpeg binary must be available in the worker container (requires `apt-get install ffmpeg`). Processing is CPU-bound — can be intensive for long videos (acceptable for a single worker).

### Option B: Sharp (Image Library from a Frame)
- Extract a frame from the video using a separate tool and process it with `sharp` for thumbnail generation.
- **Pros:** `sharp` is a fast image processing library.
- **Cons:** Cannot extract video frames — still requires FFmpeg or another tool. Adds a dependency without solving the frame extraction problem.

### Option C: External Thumbnail Service (e.g., AWS MediaConvert)
- Delegate thumbnail generation to a managed media processing service.
- **Pros:** Offloads CPU-intensive work. Managed infrastructure.
- **Cons:** External service dependency. Cost. Overkill for a local development project. Conflicts with the requirement for all infrastructure to run in Docker Compose.

**Recommendation:** **Option A (FFmpeg in worker via fluent-ffmpeg)** — The only practical option that runs fully locally in Docker. Standard approach for server-side video thumbnail generation.

**Decision:** A (fluent-ffmpeg + @ffprobe-installer/ffprobe in worker container)

**Libraries:** `fluent-ffmpeg@^2.x`, `@ffprobe-installer/ffprobe@^1.4.x`, `@types/fluent-ffmpeg@^2.x` (devDep)

---

## TD-07: FFmpeg Binary Availability in Docker

**Scope:** Infrastructure

**Capability:** Geração automática de thumbnail a partir de um frame do vídeo (worker dependency)

**Context:** The video worker needs the `ffmpeg` binary available in its container. `@ffprobe-installer/ffprobe` ships a prebuilt ffprobe binary, but the full `ffmpeg` binary (for frame extraction) requires system installation. Two deployment options exist.

**Options:**

### Option A: Modify Dockerfile.dev to Install ffmpeg via apt
- Add `RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*` to the shared `Dockerfile.dev`. Both the API container and the worker container get ffmpeg.
- **Pros:** Single Dockerfile to maintain. The `video-worker` service in compose reuses the same image. The API container has ffmpeg available (useful for future API-level processing or testing). Simple one-line change.
- **Cons:** API container gets ffmpeg it doesn't strictly need (minor image size increase). Any change to ffmpeg install affects both containers.

### Option B: Create a Separate Dockerfile.worker
- Create `Dockerfile.worker` that extends `Dockerfile.dev` (or starts from the same base) and adds ffmpeg. The `video-worker` compose service uses `dockerfile: Dockerfile.worker`.
- **Pros:** Clear separation — API image stays minimal. Worker image has exactly what it needs.
- **Cons:** Two Dockerfiles to maintain. Compose references two different dockerfiles. More files for a non-essential concern (both containers need Node.js anyway).

**Recommendation:** **Option A (Modify Dockerfile.dev)** — Simpler to maintain. The API image size increase is negligible (ffmpeg binary ~20MB). For a development project with a single compose stack, a unified Dockerfile is preferred over splitting for minimal benefit.

**Decision:** A (Add `ffmpeg` apt install to `Dockerfile.dev`)

---

## TD-08: MinIO Bucket Initialization

**Scope:** Backend

**Capability:** Serviço de armazenamento de arquivos (vídeos e thumbnails)

**Context:** The MinIO bucket (`streamtube`) must exist before the API can generate presigned URLs or the worker can upload thumbnails. The bucket must be created on first run and not fail if it already exists.

**Options:**

### Option A: OnModuleInit in StorageService (NestJS Lifecycle Hook)
- Implement `OnModuleInit` in `StorageService`. The `onModuleInit()` method calls `ensureBucketExists()`: sends a `HeadBucketCommand` to check existence; if not found (404 `NoSuchBucket`), sends a `CreateBucketCommand`. Called once at application startup.
- **Pros:** Pure NestJS solution — no extra infra. Happens automatically on `docker compose up` before the first request is handled. Self-documenting (the service manages its own bucket dependency). Easy to test (spy on `ensureBucketExists` in integration tests).
- **Cons:** Adds a startup delay (one extra round-trip to MinIO). MinIO must be healthy before the API starts (handled by `depends_on: minio: { condition: service_healthy }` in compose).

### Option B: MinIO Client (`mc`) Init Container in Compose
- Add a Docker Compose `minio-init` service using the `minio/mc` image that runs `mc mb` commands to create the bucket, then exits. `nestjs-api` depends on `minio-init`.
- **Pros:** Bucket creation is separate from application code.
- **Cons:** Extra compose service. `mc` commands require careful scripting. Init container pattern adds complexity. Harder to replicate in tests.

### Option C: MinIO Default Bucket via Environment Variable
- MinIO supports `MINIO_DEFAULT_BUCKETS` environment variable to auto-create buckets on startup.
- **Pros:** Zero code — just an env var. Bucket created before any service connects.
- **Cons:** `MINIO_DEFAULT_BUCKETS` is not an official MinIO environment variable for the standard MinIO server (it's a Bitnami-specific var). Relying on undocumented behavior is fragile.

**Recommendation:** **Option A (OnModuleInit in StorageService)** — Clean NestJS pattern, self-contained, easy to test, no extra infra. The `depends_on` health check ensures MinIO is ready before the API starts.

**Decision:** A (OnModuleInit in StorageService with `ensureBucketExists()`)

---

## TD-09: Video Status Lifecycle

**Scope:** Backend

**Capability:** Pré-cadastro automático do vídeo como rascunho ao iniciar o upload

**Context:** A video goes through multiple states from creation to availability. The status must reflect the current processing state and be stored in the database.

**Options:**

### Option A: Four-State Enum (draft → processing → ready | error)
- `draft`: created, presigned URL generated, not yet uploaded or processing requested.
- `processing`: upload confirmed, worker picked up the job, processing in progress.
- `ready`: processing complete, video available for streaming.
- `error`: processing failed, `error_message` field contains the reason.
- **Pros:** Clear, unambiguous states. Frontend can render different UI for each state. `error` state with message enables debugging and user feedback. Standard pattern for async processing pipelines.
- **Cons:** Four states to handle in business logic and UI.

### Option B: Three-State Enum (pending → ready | error)
- Skip the `processing` state — transition directly from `pending` (draft+processing merged) to `ready` or `error`.
- **Pros:** Simpler — one fewer state.
- **Cons:** Cannot distinguish "not yet uploaded" from "currently being processed" — both look the same to the user. No way to know if the worker picked up the job.

**Recommendation:** **Option A (four-state enum: draft | processing | ready | error)** — The distinction between `draft` (upload not started/finished) and `processing` (worker active) is important for UX and debugging. The `error` state with `error_message` is essential for worker failure transparency.

**Decision:** A (enum: draft | processing | ready | error)

---

## Decisions Summary

| ID | Decision | Recommendation | Choice |
|----|----------|---------------|--------|
| TD-01 | Upload Strategy for Files Up to 10GB | Presigned PUT URL (client → MinIO direct) | A (Presigned URL) |
| TD-02 | Background Queue Technology | BullMQ + Redis | A (BullMQ + Redis) |
| TD-03 | Video Worker Deployment | Separate container, shared codebase | A (Separate container) |
| TD-04 | Video Streaming Strategy | 302 redirect to presigned GET URL | A (302 redirect) |
| TD-05 | Unique Video URL Identifier | nanoid v3.x (21-char, URL-safe) | A (nanoid@^3.3.x) |
| TD-06 | Thumbnail Generation Strategy | FFmpeg in worker via fluent-ffmpeg | A (fluent-ffmpeg) |
| TD-07 | FFmpeg Binary Availability in Docker | Modify Dockerfile.dev | A (apt install in Dockerfile.dev) |
| TD-08 | MinIO Bucket Initialization | OnModuleInit in StorageService | A (OnModuleInit) |
| TD-09 | Video Status Lifecycle | draft → processing → ready \| error | A (four-state enum) |
