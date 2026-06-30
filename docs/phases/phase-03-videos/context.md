---
kind: phase
name: phase-03-videos
sources_mtime:
  docs/project-plan.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-06-29T00:00:00-03:00"
  docs/phases/phase-02-auth/phase-02-auth.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-02-auth.md: "2026-06-29T00:00:00-03:00"
---

# phase-03-videos — Context

## Scope

**Phase name:** Fase 03 — Upload e Processamento de Vídeos

**Capabilities**

- Serviço de armazenamento de arquivos (vídeos e thumbnails)
- Serviço de processamento em segundo plano (filas)
- Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance
- Pré-cadastro automático do vídeo como rascunho ao iniciar o upload
- Processamento automático do vídeo após upload (extração de duração e metadados)
- Geração automática de thumbnail a partir de um frame do vídeo
- URL única por vídeo, sem conflito com outros vídeos
- Reprodução via streaming (sem necessidade de download completo)
- Download do vídeo pelo usuário

**Out of scope:** Interface de upload de vídeos no frontend, edição de metadados de vídeo, visibilidade pública/unlisted, comentários, likes, inscrições em canais (fases posteriores).

**Deliverables:** upload de até 10GB funcional, processamento automático do vídeo, streaming funcionando, URLs únicas geradas.

**Affected subprojects:** `nestjs-project/`

**Deferred subprojects:** `next-frontend/` — interface de upload e player de vídeo ficam diferidos.

**Sequencing notes:** Depends on Fase 01 (configuração base) and Fase 02 (auth, users, channels — entidade Channel que os vídeos referenciam).

**Neighbors (for boundary detection only):** Fase 02 (prior), Fase 04 — Gerenciamento de Vídeos e Canal (next).

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| phase-03-videos/TD-01 | technical-decisions-phase-03-videos.md | Backend | Upload Strategy for Files Up to 10GB | decided | A (Presigned URL — client uploads directly to MinIO) | @aws-sdk/client-s3@^3.x, @aws-sdk/s3-request-presigner@^3.x |
| phase-03-videos/TD-02 | technical-decisions-phase-03-videos.md | Backend | Background Queue Technology | decided | A (BullMQ + Redis) | @nestjs/bullmq@^11.x, bullmq@^5.x, ioredis@^5.x |
| phase-03-videos/TD-03 | technical-decisions-phase-03-videos.md | Backend + Infrastructure | Video Worker Deployment | decided | A (Separate container, shared NestJS codebase) | — |
| phase-03-videos/TD-04 | technical-decisions-phase-03-videos.md | Backend | Video Streaming Strategy | decided | A (302 redirect to presigned GET URL) | — |
| phase-03-videos/TD-05 | technical-decisions-phase-03-videos.md | Backend | Unique Video URL Identifier | decided | A (nanoid@^3.3.x, 21-char URL-safe slug) | nanoid@^3.3.x |
| phase-03-videos/TD-06 | technical-decisions-phase-03-videos.md | Backend (Worker) | Thumbnail Generation Strategy | decided | A (fluent-ffmpeg + @ffprobe-installer/ffprobe in worker) | fluent-ffmpeg@^2.x, @ffprobe-installer/ffprobe@^1.4.x |
| phase-03-videos/TD-07 | technical-decisions-phase-03-videos.md | Infrastructure | FFmpeg Binary Availability in Docker | decided | A (Add apt install ffmpeg to Dockerfile.dev) | — |
| phase-03-videos/TD-08 | technical-decisions-phase-03-videos.md | Backend | MinIO Bucket Initialization | decided | A (OnModuleInit in StorageService) | — |
| phase-03-videos/TD-09 | technical-decisions-phase-03-videos.md | Backend | Video Status Lifecycle | decided | A (enum: draft \| processing \| ready \| error) | — |

_Source files:_

- `docs/decisions/technical-decisions-phase-03-videos.md`

## Capability Coverage

| Capability | Covered by |
|------------|------------|
| Serviço de armazenamento de arquivos (vídeos e thumbnails) | phase-03-videos/TD-01, phase-03-videos/TD-08 |
| Serviço de processamento em segundo plano (filas) | phase-03-videos/TD-02, phase-03-videos/TD-03 |
| Upload de vídeos com suporte a arquivos de até 10GB sem impacto na performance | phase-03-videos/TD-01 |
| Pré-cadastro automático do vídeo como rascunho ao iniciar o upload | phase-03-videos/TD-09 |
| Processamento automático do vídeo após upload (extração de duração e metadados) | phase-03-videos/TD-02, phase-03-videos/TD-03, phase-03-videos/TD-06 |
| Geração automática de thumbnail a partir de um frame do vídeo | phase-03-videos/TD-06, phase-03-videos/TD-07 |
| URL única por vídeo, sem conflito com outros vídeos | phase-03-videos/TD-05 |
| Reprodução via streaming (sem necessidade de download completo) | phase-03-videos/TD-04 |
| Download do vídeo pelo usuário | phase-03-videos/TD-04 |

## Decisions Detail

### phase-03-videos/TD-01

**Recommendation:** Option A (Presigned URL) — The only architecture that does not route file bytes through the API. Industry-standard approach. MinIO fully supports presigned PUT URLs with S3-compatible API. The two-step client flow (get URL → upload → notify) is straightforward and testable.

**Libraries:** `@aws-sdk/client-s3@^3.x`, `@aws-sdk/s3-request-presigner@^3.x`

### phase-03-videos/TD-02

**Recommendation:** Option A (BullMQ + Redis) — Best NestJS integration, feature set appropriate for video processing (retry, backoff, concurrency), and Redis adds infrastructure value beyond queuing (future caching).

**Libraries:** `@nestjs/bullmq@^11.x`, `bullmq@^5.x`, `ioredis@^5.x`

### phase-03-videos/TD-03

**Recommendation:** Option A (Separate container, shared NestJS codebase) — Clean architecture aligned with the project diagram. `createApplicationContext` is the correct NestJS API for non-HTTP apps.

**Libraries:** —

### phase-03-videos/TD-04

**Recommendation:** Option A (302 redirect to presigned GET URL) — Zero API overhead, MinIO handles Range natively, time-limited access via presigned URL expiry.

**Libraries:** —

### phase-03-videos/TD-05

**Recommendation:** Option A (nanoid@^3.3.x) — Shortest, most URL-appropriate format. Widely used for slugs in Node.js. CJS compatibility maintained by pinning to v3.3.x.

**Libraries:** `nanoid@^3.3.x`

### phase-03-videos/TD-06

**Recommendation:** Option A (fluent-ffmpeg + @ffprobe-installer/ffprobe) — The only practical option that runs fully locally in Docker.

**Libraries:** `fluent-ffmpeg@^2.x`, `@ffprobe-installer/ffprobe@^1.4.x`, `@types/fluent-ffmpeg@^2.x` (devDep)

### phase-03-videos/TD-07

**Recommendation:** Option A (Modify Dockerfile.dev) — Simpler to maintain. The API image size increase is negligible for a development project.

**Libraries:** —

### phase-03-videos/TD-08

**Recommendation:** Option A (OnModuleInit) — Clean NestJS pattern, self-contained, easy to test. `depends_on` health check ensures MinIO is ready before the API starts.

**Libraries:** —

### phase-03-videos/TD-09

**Recommendation:** Option A (four-state enum) — Distinction between `draft` and `processing` is important for UX and debugging. `error` state with `error_message` enables failure transparency.

**Libraries:** —

## Inherited Decisions Detail

### phase-02-auth/TD-02

**Recommendation:** Option A (@nestjs/passport) — original recommendation. Implemented as custom guards with @nestjs/jwt only.

**Note:** Custom JwtAuthGuard registered as APP_GUARD — all endpoints protected by default, opt-out with `@Public()`. Phase 03 video endpoints follow this pattern: public listing/streaming endpoints use `@Public()`, upload and management endpoints require Bearer JWT.

**Libraries:** `@nestjs/jwt@^11.0.0`

### phase-02-auth/TD-07

**Recommendation:** Option A (Custom Domain Exception Filter) — `DomainException` base class in `src/common/exceptions/domain.exception.ts`. Phase 03 adds `VideoNotFoundException` and `VideoNotInDraftStatusException` following the same pattern.

**Libraries:** —

### phase-01-configuracao-base/TD-03

**Recommendation:** Option B (Namespaced/grouped with registerAs) — Phase 03 adds `storage.config.ts` and `queue.config.ts` following the same `registerAs` pattern.

**Libraries:** —

## Inherited Conventions

- Backend config uses `@nestjs/config` with namespaced `registerAs(name, () => ({...}))` factories — one file per domain in `src/config/`. _(from phase 01)_
- Env variables are validated by a Joi schema in `src/config/env.validation.ts`, passed to `ConfigModule.forRoot({ validationSchema, validationOptions: { allowUnknown: true, abortEarly: false } })`. _(from phase 01)_
- Config is injected into modules via `ConfigType<typeof xxxConfig>` and `@Inject(xxxConfig.KEY)`. _(from phase 01)_
- `TypeOrmModule.forRootAsync` is used (not `forRoot`), with `autoLoadEntities: true`, `synchronize: false`. _(from phase 01)_
- All endpoints protected by `JwtAuthGuard` (APP_GUARD); public endpoints decorated with `@Public()`. _(from phase 02)_
- Domain errors use `DomainException` subclasses mapped by `DomainExceptionFilter`. _(from phase 02)_
- Migrations are versionated; `npm run migration:run` and `npm run migration:revert` commands used. _(from phase 02)_
- Tests: `*.spec.ts` (unit), `*.integration-spec.ts` (integration with real DB/services), `*.e2e-spec.ts` (HTTP E2E via supertest). _(from phase 01/02)_
- Docker: use service names (e.g., `db`, `redis`, `minio`) as hostnames, never `localhost`. _(from CLAUDE.md)_

## Inherited Deferred Capabilities

_No inherited deferred capabilities from Phase 02 affect this phase._

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale | TD refs |
|------------|--------|-----------|---------|
| Interface de upload de vídeos no frontend | deferred | `next-frontend/` video upload UI is out of scope for Phase 03. | — |
| Player de vídeo no frontend | deferred | `next-frontend/` video player is out of scope for Phase 03. | — |
| Visibilidade pública/unlisted, edição de metadados de vídeo | deferred | Addressed in Fase 04 — Gerenciamento de Vídeos e Canal. | — |

## Testing Requirements

Refer to the `testing-guide-nestjs-project` Skill for layer requirements per artifact type in `nestjs-project/`. Phase 03 introduces the first async processing pipeline (queue + worker), object storage integration, and streaming endpoints — each layer is exercised by unit (mocked infra), integration (real MinIO + real DB), and E2E (HTTP via supertest) tests. Specific layer coverage by SI is recorded in `progress.md`.
