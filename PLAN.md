# Plano de Implementação — Fase 03: Upload e Processamento de Vídeos

## Context

TASK.md exige a entrega completa da Fase 03 do StreamTube (plataforma YouTube-like), seguindo o workflow
obrigatório do projeto: research → planejamento pipeline → implementação. O projeto já tem Fase 01
(configuração base) e Fase 02 (auth/users/channels) fechadas em NestJS 11 + TypeORM + PostgreSQL 17.

A fase introduz quatro componentes que não existem: módulo de vídeos, object storage (MinIO), fila de
processamento (BullMQ + Redis) e worker de vídeo (FFmpeg). A reprovação automática ocorre por: pular
o workflow, passar 10GB pela API, não ter fila/worker/storage reais no Compose, tsc/lint/testes
quebrando, commit direto na main, ou CLAUDE.md inconsistente com o código.

## Git Setup

```bash
# A partir da branch dev (nunca main)
git checkout dev
git pull
git checkout -b feature/phase-03-videos
```

---

## Etapa 1 — Research e Decisões Técnicas

### Arquivo: `docs/decisions/technical-decisions-phase-03-videos.md`

Formato idêntico a `docs/decisions/technical-decisions-phase-02-auth.md` (frontmatter YAML +
TD-NN com Options A/B/C → Recommendation → Decision → Libraries).

**Decisões a documentar (já pesquisadas e definidas):**

| TD | Tópico | Decisão |
|----|--------|---------|
| TD-01 | Estratégia de upload de 10GB | Presigned PUT URL (client → MinIO direto, API não recebe o arquivo) |
| TD-02 | Sistema de fila | BullMQ + Redis (@nestjs/bullmq) |
| TD-03 | Deployment do worker | Container separado, mesma codebase NestJS, entrypoint diferente |
| TD-04 | Estratégia de streaming | Redirect 302 para presigned GET URL do MinIO (suporta Range nativo) |
| TD-05 | URL única por vídeo | nanoid v3.x (CJS-compatível; v4+ é ESM-only) |
| TD-06 | Geração de thumbnail | ffmpeg no worker (frame no 5s ou 10% da duração) |
| TD-07 | FFmpeg no container | Modificar Dockerfile.dev: `RUN apt-get install -y ffmpeg` |
| TD-08 | Inicialização do bucket | `OnModuleInit` no StorageService (`ensureBucketExists()`) |

**Opções rejeitadas a documentar:**
- TD-02: pg-boss (sem Redis extra, mas fila dentro do Postgres), RabbitMQ (overkill)
- TD-04: Proxy via API (overhead desnecessário para streaming)
- TD-05: uuid-slug/hashids (menos padrão)

---

## Etapa 2 — Pipeline de Planejamento

### Pasta: `docs/phases/phase-03-videos/`

Formato de referência: `docs/phases/phase-02-auth/` (YAML frontmatter + seções em markdown com tabelas).

#### 2a. `context.md`
- Frontmatter: `kind: phase`, `name: phase-03-videos`, `sources_mtime`
- Seções: Scope (capabilities, out-of-scope, deliverables), Decisions Index (tabela com TD-01..TD-08),
  Capability Coverage, Decisions Detail (subsection por TD), Inherited Conventions/Decisions da Fase 02

#### 2b. `validation.md`
- Frontmatter: `kind: plan-validation`, `status: clean`, `issue_count: 0`
- Todos os sections de issues mostram "None" ou "_No issues_"
- **Deve fechar em `status: clean` antes da implementação**
- Issues a resolver antes de fechar clean:
  - Confirmar compatibilidade ESM do nanoid v3 (resolvido: pin v3.3.x)
  - Confirmar FFmpeg binário no container (resolvido: TD-07)
  - Confirmar bootstrap do worker (resolvido: TD-03, `createApplicationContext`)

#### 2c. `library-refs.md`
Bibliotecas novas fixadas com versão consultada via context7:

| Library | Version | Purpose |
|---------|---------|---------|
| @aws-sdk/client-s3 | ^3.x | MinIO S3-compatible client |
| @aws-sdk/s3-request-presigner | ^3.x | Presigned URL generation |
| @nestjs/bullmq | ^11.x | BullMQ NestJS integration |
| bullmq | ^5.x | Redis-based job queue |
| ioredis | ^5.x | Redis client (used by BullMQ internally) |
| nanoid | ^3.3.x | URL-safe unique ID (CJS-compatible) |
| fluent-ffmpeg | ^2.x | FFmpeg wrapper (worker only) |
| @ffprobe-installer/ffprobe | ^1.4.x | Prebuilt ffprobe binary |
| @types/fluent-ffmpeg | ^2.x | TypeScript types (devDep) |

#### 2d. `phase-03-videos.md` (o plano executável)

Formato: frontmatter + Objective + SIs + Technical Specifications + Dependency Map + Deliverables.

**Step Implementations (SIs):**

| SI | Título | Depende de |
|----|--------|-----------|
| SI-03.1 | compose.yaml: MinIO + Redis + video-worker | — |
| SI-03.2 | Config: storage.config.ts + queue.config.ts + env.validation.ts | SI-03.1 |
| SI-03.3 | StorageModule + StorageService (presigned URLs, ensureBucketExists) | SI-03.2 |
| SI-03.4 | QueueModule (BullMQ, registerQueue) | SI-03.2 |
| SI-03.5 | Video entity + migration CreateVideos | SI-03.1 |
| SI-03.6 | VideosModule skeleton (imports StorageModule, QueueModule) | SI-03.3, SI-03.4, SI-03.5 |
| SI-03.7 | VideosService + DTOs + domain exceptions | SI-03.6 |
| SI-03.8 | VideosController (7 endpoints) | SI-03.7 |
| SI-03.9 | app.module.ts: importar StorageModule, QueueModule, VideosModule | SI-03.6 |
| SI-03.10 | Video worker: worker.ts + worker.module.ts + VideoProcessingProcessor | SI-03.3, SI-03.4, SI-03.5 |
| SI-03.11 | Unit tests (videos.service.spec, storage.service.spec, processor.spec) | SI-03.7, SI-03.3 |
| SI-03.12 | Integration tests (entity, migrations, storage real MinIO) | SI-03.5, SI-03.3 |
| SI-03.13 | E2E tests (upload flow, stream, download) | SI-03.8, SI-03.9 |
| SI-03.14 | CLAUDE.md updates (root + nestjs-project/) | SI-03.1 |

**Technical Specifications no plano:**

*Data Model — tabela `videos`:*
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| channel_id | uuid | FK → channels.id ON DELETE CASCADE |
| title | varchar(255) | NOT NULL |
| description | text | nullable |
| status | enum(draft,processing,ready,error) | NOT NULL, default draft |
| storage_key | varchar | nullable |
| thumbnail_key | varchar | nullable |
| duration | integer | nullable (seconds) |
| metadata | jsonb | nullable (ffprobe output) |
| slug | varchar | UNIQUE, NOT NULL (nanoid 21 chars) |
| error_message | text | nullable |
| created_at / updated_at | timestamp | auto |

Índices: `(slug)` unique, `(channel_id, status)` composto, `(status)`.

*API Contracts:*
| Method | Path | Auth | Response |
|--------|------|------|----------|
| POST | /videos | Bearer JWT | 201 `{ video, presigned_upload_url }` |
| PATCH | /videos/:id/start-processing | Bearer JWT | 200 `{ ...video }` |
| GET | /videos | Public | 200 `{ data, total, page, limit }` |
| GET | /videos/:slug | Public | 200 `Video` |
| GET | /videos/:slug/stream | Public | 302 Location (presigned GET URL) |
| GET | /videos/:slug/download | Public | 302 Location (presigned GET, attachment) |
| DELETE | /videos/:id | Bearer JWT | 204 |

*Authorization Matrix:* endpoints públicos com `@Public()`, endpoints autenticados verificam ownership via `channel_id`.

*Error Catalog (adições ao domain.exception.ts):*
| Code | HTTP | Trigger |
|------|------|---------|
| VIDEO_NOT_FOUND | 404 | Vídeo não existe ou não pertence ao canal do user |
| VIDEO_NOT_IN_DRAFT_STATUS | 409 | start-processing em vídeo não-draft |

*Events/Messages (BullMQ):*
```typescript
interface VideoProcessingJobData {
  videoId: string;
  channelId: string;
  storageKey: string;
}
// Job options: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
```

*Dependency Map (linearizado):*
SI-03.1 → SI-03.2 → SI-03.3 + SI-03.4 (paralelo) → SI-03.5 → SI-03.6 → SI-03.7 → SI-03.8 → SI-03.9 → SI-03.10 → SI-03.11 → SI-03.12 → SI-03.13 → SI-03.14

#### 2e. `progress.md`
Inicia com `Status: pending`, `SIs: 0/14 completed`. Atualizado a cada SI concluído.

---

## Etapa 3 — Implementação

### SI-03.1 — compose.yaml

**Arquivo:** `nestjs-project/compose.yaml`

Adicionar serviços ao compose existente (mantendo nestjs-api, db, mailpit):

```yaml
minio:
  image: minio/minio:RELEASE.2025-01-20T14-49-07Z
  ports: ["9000:9000", "9001:9001"]
  environment:
    MINIO_ROOT_USER: streamtube
    MINIO_ROOT_PASSWORD: streamtube
  command: server /data --console-address ":9001"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 5s
    timeout: 5s
    retries: 5
  volumes: [minio_data:/data]

redis:
  image: redis:7.4-alpine
  ports: ["6379:6379"]
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 5s
    retries: 5

video-worker:
  build: { context: ., dockerfile: Dockerfile.dev }
  volumes: [.:/home/node/app]
  depends_on:
    db: { condition: service_healthy }
    redis: { condition: service_healthy }
    minio: { condition: service_healthy }
  command: ["npm", "run", "start:worker:dev"]
  # Herda o .env da raiz via env_file ou environment vars
```

Adicionar `minio_data:` em `volumes:` no nível raiz.
Atualizar `nestjs-api` depends_on para incluir `redis` e `minio` com `service_healthy`.
Adicionar `RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*`
ao `Dockerfile.dev` (para que o video-worker tenha ffmpeg).

### SI-03.2 — Config Modules

**Arquivos novos:**
- `nestjs-project/src/config/storage.config.ts` — `registerAs('storage', ...)` com endpoint, port, accessKey, secretKey, bucket, useSSL, presignedUrlExpiresIn, publicEndpoint
- `nestjs-project/src/config/queue.config.ts` — `registerAs('queue', ...)` com redisHost, redisPort, videoProcessingQueue

**Arquivos modificados:**
- `nestjs-project/src/config/env.validation.ts` — adicionar vars MINIO_* e REDIS_* com Joi (MINIO_ACCESS_KEY e MINIO_SECRET_KEY como required)
- `nestjs-project/.env` e `.env.example` — adicionar vars MinIO e Redis

Padrão: idêntico a `src/config/auth.config.ts` (registerAs, ConfigType).

### SI-03.3 — StorageModule

**Arquivos novos:**
- `nestjs-project/src/storage/storage.constants.ts` — token `S3_CLIENT`
- `nestjs-project/src/storage/storage.module.ts` — módulo com factory provider do S3Client
- `nestjs-project/src/storage/storage.service.ts` — métodos públicos:
  - `ensureBucketExists()` — HeadBucketCommand + CreateBucketCommand (OnModuleInit)
  - `generateUploadPresignedUrl(key, contentType, expiresIn?)` → PutObjectCommand + getSignedUrl
  - `generateDownloadPresignedUrl(key, expiresIn?, contentDisposition?)` → GetObjectCommand + getSignedUrl
  - `deleteObject(key)` → DeleteObjectCommand

**S3Client config para MinIO:**
```typescript
new S3Client({
  endpoint: `http://${cfg.endpoint}:${cfg.port}`,
  region: 'us-east-1',
  credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
  forcePathStyle: true,  // obrigatório para MinIO
})
```

**Instalar antes deste SI:**
```bash
docker compose exec nestjs-api npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### SI-03.4 — QueueModule

**Arquivos novos:**
- `nestjs-project/src/queue/queue.constants.ts` — `VIDEO_PROCESSING_QUEUE = 'video-processing'`
- `nestjs-project/src/queue/video-processing.queue.ts` — interface `VideoProcessingJobData`
- `nestjs-project/src/queue/queue.module.ts` — `BullModule.forRootAsync` + `BullModule.registerQueue`

**Instalar antes deste SI:**
```bash
docker compose exec nestjs-api npm install @nestjs/bullmq bullmq ioredis
```

### SI-03.5 — Video Entity + Migration

**Arquivos novos:**
- `nestjs-project/src/videos/entities/video.entity.ts` — entity com enum VideoStatus + @ManyToOne Channel
- `nestjs-project/src/database/migrations/<timestamp>-CreateVideos.ts` — cria enum + tabela + FK + índices

**Migration up():** cria `videos_status_enum`, tabela `videos`, FK `channel_id → channels.id CASCADE`, índices.
**Migration down():** drops em ordem inversa.

**Instalar antes deste SI:**
```bash
docker compose exec nestjs-api npm install nanoid@3
```

### SI-03.6 — VideosModule Skeleton

**Arquivo novo:** `nestjs-project/src/videos/videos.module.ts`
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Video]), StorageModule, QueueModule],
  providers: [VideosService],
  controllers: [VideosController],
  exports: [VideosService],
})
export class VideosModule {}
```

### SI-03.7 — VideosService + DTOs

**Arquivos novos:**
- `nestjs-project/src/videos/dto/create-video.dto.ts` — title (max 255), description (optional), content_type
- `nestjs-project/src/videos/dto/query-videos.dto.ts` — page (default 1), limit (default 20, max 50)
- `nestjs-project/src/videos/videos.service.ts` — 7 métodos (ver Technical Specs)
- `nestjs-project/src/videos/videos.constants.ts` — CONTENT_TYPE_TO_EXTENSION map

**Lógica de storage_key:** `channels/${channelId}/videos/${slug}/original${ext}`
**Lógica de thumbnail_key:** `channels/${channelId}/videos/${slug}/thumbnail.jpg`

**Adições ao `common/exceptions/domain.exception.ts`:**
- `VideoNotFoundException` (404, VIDEO_NOT_FOUND)
- `VideoNotInDraftStatusException` (409, VIDEO_NOT_IN_DRAFT_STATUS)

**Adição ao `ChannelsService`:** método `findByUserId(userId: string): Promise<Channel | null>` para que o controller resolva o channelId do usuário autenticado.

### SI-03.8 — VideosController

**Arquivo novo:** `nestjs-project/src/videos/videos.controller.ts`

7 endpoints conforme API Contracts. Para endpoints autenticados, injeta `ChannelsService` para resolver
`channel_id` a partir do `user.sub` (JWT payload). Streaming e download usam `@Res() res: Response` com
`res.redirect(302, url)`.

Padrão de decorators idêntico a `auth.controller.ts` (@ApiTags, @ApiBearerAuth, @ApiResponse).

### SI-03.9 — app.module.ts

**Arquivo modificado:** `nestjs-project/src/app.module.ts`
- Adicionar `storageConfig` e `queueConfig` ao array `load` do ConfigModule
- Adicionar `StorageModule`, `QueueModule`, `VideosModule` aos imports do AppModule

### SI-03.10 — Video Worker

**Arquivos novos:**
- `nestjs-project/src/worker.ts` — bootstrap com `NestFactory.createApplicationContext(WorkerModule)`
- `nestjs-project/src/worker.module.ts` — módulo mínimo: ConfigModule, TypeOrmModule, QueueModule, StorageModule + VideosWorkerModule
- `nestjs-project/src/videos/processors/video-processing.processor.ts` — `@Processor(VIDEO_PROCESSING_QUEUE)` com método `@Process()` que:
  1. Download do arquivo do MinIO via GetObject stream para arquivo temp
  2. ffprobe → extrai duração e metadados
  3. ffmpeg → gera thumbnail.jpg a partir do frame no 10% da duração
  4. Upload do thumbnail para MinIO
  5. Atualiza video: `status = READY`, `duration`, `metadata`, `thumbnail_key`
  6. Em falha: `status = ERROR`, `error_message = job.failedReason`

**Adições ao `package.json`:**
```json
"start:worker:dev": "nest start --entryFile worker --watch"
```

**Instalar antes deste SI:**
```bash
docker compose exec nestjs-api npm install fluent-ffmpeg @ffprobe-installer/ffprobe
docker compose exec nestjs-api npm install --save-dev @types/fluent-ffmpeg
```

### SI-03.11 — Unit Tests

**Arquivos novos:**
- `src/videos/videos.service.spec.ts` — mock Repository<Video>, StorageService, Queue; testa todos os 7 métodos
- `src/storage/storage.service.spec.ts` — mock S3Client.send; testa 3 métodos + ensureBucketExists
- `src/videos/processors/video-processing.processor.spec.ts` — mock Repository + StorageService + fluent-ffmpeg; happy path → READY; falha → ERROR

### SI-03.12 — Integration Tests

**Arquivos novos/modificados:**
- `src/videos/entities/video.entity.integration-spec.ts` — constraints (slug unique, FK cascade, enum values, nullable fields, default status)
- `src/storage/storage.service.integration-spec.ts` — testa contra MinIO real do compose (upload via presigned URL, HEAD verify, download URL, delete)
- `src/database/migrations.integration-spec.ts` — atualizar: adicionar Video entity, CreateVideos migration; assert tabela `videos` existe após migrar
- `src/test/create-test-data-source.ts` — adicionar `DELETE FROM "videos"` em `cleanAllTables` (antes de channels, por FK)

### SI-03.13 — E2E Tests

**Arquivo novo:** `nestjs-project/test/videos.e2e-spec.ts`

Fluxo completo: register → confirm → login → POST /videos → upload direto MinIO → PATCH start-processing → GET /videos/:slug → GET /videos/:slug/stream (302) → GET /videos/:slug/download (302) → DELETE.

Para E2E, o BullMQ queue é mockado via `overrideProvider(getQueueToken(...))` para evitar dependência do worker rodando durante os testes.

### SI-03.14 — CLAUDE.md Updates

**Arquivos modificados:**
- `CLAUDE.md` (raiz) — atualizar seção "Architecture": substituir "Message Queue (TBD)" por "BullMQ + Redis", documentar MinIO como object storage
- `nestjs-project/CLAUDE.md` — adicionar:
  - Serviços `minio` (9000/9001), `redis` (6379), `video-worker` no Docker Compose
  - Comando `npm run start:worker:dev` para o worker
  - Novo módulo `videos/` com endpoints
  - Variáveis de ambiente MinIO e Redis necessárias

---

## Estrutura de Arquivos Novos/Modificados

```
nestjs-project/
├── Dockerfile.dev                          ← + apt-get install ffmpeg
├── compose.yaml                            ← + minio, redis, video-worker
├── CLAUDE.md                               ← atualizado
├── src/
│   ├── app.module.ts                       ← + StorageModule, QueueModule, VideosModule
│   ├── config/
│   │   ├── storage.config.ts               ← NOVO
│   │   ├── queue.config.ts                 ← NOVO
│   │   └── env.validation.ts               ← + vars MinIO/Redis
│   ├── storage/                            ← NOVO
│   │   ├── storage.constants.ts
│   │   ├── storage.module.ts
│   │   └── storage.service.ts
│   ├── queue/                              ← NOVO
│   │   ├── queue.constants.ts
│   │   ├── queue.module.ts
│   │   └── video-processing.queue.ts
│   ├── videos/                             ← NOVO
│   │   ├── videos.module.ts
│   │   ├── videos.service.ts
│   │   ├── videos.controller.ts
│   │   ├── videos.constants.ts
│   │   ├── dto/
│   │   │   ├── create-video.dto.ts
│   │   │   └── query-videos.dto.ts
│   │   ├── entities/
│   │   │   └── video.entity.ts
│   │   └── processors/
│   │       └── video-processing.processor.ts
│   ├── worker.ts                           ← NOVO
│   ├── worker.module.ts                    ← NOVO
│   ├── channels/
│   │   └── channels.service.ts             ← + findByUserId()
│   ├── common/exceptions/
│   │   └── domain.exception.ts             ← + VideoNotFoundException, VideoNotInDraftStatusException
│   ├── database/
│   │   └── migrations/
│   │       └── <timestamp>-CreateVideos.ts ← NOVO
│   └── test/
│       └── create-test-data-source.ts      ← + DELETE FROM videos
CLAUDE.md (raiz)                            ← atualizado
docs/
├── decisions/
│   └── technical-decisions-phase-03-videos.md  ← NOVO
└── phases/
    └── phase-03-videos/                         ← NOVA PASTA
        ├── context.md
        ├── validation.md
        ├── library-refs.md
        ├── phase-03-videos.md
        └── progress.md
```

---

## Verificação (Definition of Done)

### Infra
```bash
docker compose up -d
docker compose ps                        # todos healthy
curl -f http://localhost:9000/minio/health/live  # MinIO OK
docker compose exec redis redis-cli ping # PONG
```

### Testes
```bash
docker compose exec nestjs-api npm test -- --runInBand           # unit + integration
docker compose exec nestjs-api npm run test:e2e                  # e2e
docker compose exec nestjs-api npx tsc --noEmit                  # exit 0
docker compose exec nestjs-api npm run lint                      # exit 0
```

### Teste Manual do Fluxo Completo
1. `POST /auth/register` + confirmar email + `POST /auth/login` → `access_token`
2. `POST /videos` com Bearer token + `{ title, content_type: "video/mp4" }` → copia `presigned_upload_url`
3. `curl -X PUT -T video_pequeno.mp4 "<presigned_upload_url>"`
4. `PATCH /videos/:id/start-processing` com Bearer token → status: processing
5. Aguardar worker: `docker compose logs -f video-worker`
6. `GET /videos/:slug` → status: ready, thumbnail_key preenchido
7. `GET /videos/:slug/stream` → 302 com Location (MinIO URL, abre em browser)
8. `GET /videos/:slug/download` → 302 com content-disposition: attachment
9. `DELETE /videos/:id` com Bearer token → 204

### Critérios de Aceite — Checklist Final
- [ ] `technical-decisions-phase-03-videos.md` com TD-01..TD-08 decididos e justificados
- [ ] `docs/phases/phase-03-videos/` com context.md, validation.md (clean), library-refs.md, phase-03-videos.md, progress.md
- [ ] Plano com SI-03.1..SI-03.14, Technical Specs completas (Data Model, API Contracts, Auth Matrix, Error Catalog, Events/Messages), Dependency Map, Deliverables
- [ ] Upload 10GB sem travar API (presigned URL flow)
- [ ] Processamento automático pós-upload (ffmpeg: duração + thumbnail)
- [ ] URL única (nanoid slug)
- [ ] Streaming (302 → MinIO presigned GET)
- [ ] Download (302 → MinIO presigned GET com content-disposition: attachment)
- [ ] Ciclo draft → processing → ready | error no banco
- [ ] MinIO + Redis + video-worker no compose.yaml subindo healthy
- [ ] Migration cria tabela videos com FK para channels
- [ ] Testes verdes (npm test + npm run test:e2e)
- [ ] tsc sem erros + lint sem erros
- [ ] Git Flow: branch feature/phase-03-videos a partir de dev, nenhum commit direto na main
- [ ] CLAUDE.md (raiz e nestjs-project/) coerente com o código
