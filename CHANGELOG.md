# Changelog

All notable changes to StreamTube are documented here, organized by release phase.

---

## [Fase 03] — 2026-06-29

### Backend — Upload e Processamento de Vídeos (`nestjs-project/`)

**Infraestrutura (Docker Compose)**
- Adicionado serviço `minio` (MinIO RELEASE.2025-01-20, portas 9000/9001) com healthcheck e volume persistente
- Adicionado serviço `redis` (Redis 7.4-alpine, porta 6379) com healthcheck
- Adicionado serviço `video-worker` (mesmo Dockerfile.dev, entrypoint `npm run start:worker:dev`)
- `nestjs-api` passa a depender de `redis` e `minio` com `condition: service_healthy`
- `Dockerfile.dev`: adicionado `apt-get install -y ffmpeg curl` para disponibilizar ffmpeg e ffprobe no container

**Novos Módulos NestJS**
- `StorageModule` — fábrica do `S3Client` (AWS SDK v3) configurado para MinIO (`forcePathStyle: true`); expõe `StorageService` com:
  - `ensureBucketExists()` — cria o bucket na inicialização se não existir (`OnModuleInit`)
  - `generateUploadPresignedUrl(key, contentType, expiresIn?)` — URL de PUT assinada para upload direto do cliente
  - `generateDownloadPresignedUrl(key, expiresIn?, contentDisposition?)` — URL de GET assinada (com suporte a `attachment`)
  - `putObject(key, body, contentType)` — upload direto de Buffer (usado pelo worker para thumbnails)
  - `deleteObject(key)` — remoção de objeto
- `QueueModule` — integração BullMQ + Redis via `@nestjs/bullmq`; registra a fila `video-processing`
- `VideosModule` — módulo de vídeos com 7 endpoints REST:
  - `POST /videos` — cria rascunho e retorna URL de upload presigned (201)
  - `PATCH /videos/:id/start-processing` — transita para `processing` e enfileira job BullMQ (200)
  - `GET /videos` — lista paginada de vídeos com status `ready` (200, público)
  - `GET /videos/:slug` — detalhe de vídeo por slug único (200, público)
  - `GET /videos/:slug/stream` — redirect 302 para URL presigned de streaming (suporte nativo a Range)
  - `GET /videos/:slug/download` — redirect 302 com `content-disposition: attachment`
  - `DELETE /videos/:id` — remove vídeo e objetos do storage (204)
- `WorkerModule` + `worker.ts` — entrypoint separado (`NestFactory.createApplicationContext`) sem servidor HTTP; processa jobs com:
  - ffprobe para extração de duração e metadados
  - ffmpeg para geração de thumbnail (seek em 10% da duração ou 1s para vídeos ≤10s)
  - Upload de thumbnail para MinIO via `StorageService.putObject`
  - Atualização do vídeo para `ready` (ou `error` em falha)

**Entidade e Migração**
- Nova entidade `Video` com enum `VideoStatus` (`draft | processing | ready | error`), FK para `channels` (ON DELETE CASCADE), slug único (nanoid 21 chars), `storage_key`, `thumbnail_key`, `duration`, `metadata` (jsonb), `error_message`
- Migração `1780000000000-CreateVideos`: cria tipo enum, tabela `videos`, índice único em `slug`, índice composto em `(channel_id, status)`, índice em `status`

**Configuração**
- `storage.config.ts` — `registerAs('storage', ...)` com vars MinIO
- `queue.config.ts` — `registerAs('queue', ...)` com host/porta Redis
- `env.validation.ts` — adicionadas `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` como obrigatórias; `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_BUCKET`, `MINIO_USE_SSL`, `MINIO_PUBLIC_ENDPOINT`, `REDIS_HOST`, `REDIS_PORT` como opcionais com defaults
- `.env.example` atualizado com todas as novas variáveis

**Exceções de Domínio**
- `VideoNotFoundException` (HTTP 404, código `VIDEO_NOT_FOUND`)
- `VideoNotInDraftStatusException` (HTTP 409, código `VIDEO_NOT_IN_DRAFT_STATUS`)

**Dependências instaladas**
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — cliente S3 compatível com MinIO
- `@nestjs/bullmq`, `bullmq`, `ioredis` — fila de processamento com Redis
- `nanoid@3` — geração de slugs únicos (v3.x, CJS-compatível)
- `fluent-ffmpeg`, `@types/fluent-ffmpeg` — wrapper FFmpeg para o worker

**Testes**
- `src/storage/storage.service.spec.ts` — unit tests do StorageService (mock S3Client)
- `src/storage/storage.service.integration-spec.ts` — integration tests contra MinIO real (bucket de teste isolado)
- `src/videos/videos.service.spec.ts` — unit tests dos 7 métodos do VideosService
- `src/videos/processors/video-processing.processor.spec.ts` — unit tests do processor (ffprobe/ffmpeg mockados)
- `src/videos/entities/video.entity.integration-spec.ts` — integration tests da entidade (constraints, cascade, enum)
- `src/database/migrations.integration-spec.ts` — atualizado para incluir `CreateVideos` e verificar tabela `videos`
- `test/videos.e2e-spec.ts` — 14 E2E tests cobrindo o fluxo completo (upload, processamento, stream, download, delete)

**Qualidade e Tooling**
- `eslint.config.mjs`: adicionados overrides para arquivos de teste desativando regras `unsafe-*` e `unbound-method` (consistente com permissividade do projeto para `any`)
- `channels.service.ts`: corrigido `isPgUniqueViolationOnColumn` para usar interface tipada `PgDriverError` em vez de `as any`
- `create-test-data-source.ts`: `Function` substituído por `EntityClass` (type-safe); `cleanAllTables` verifica existência da tabela `videos` antes de deletar
- `package.json`: `test:e2e` agora inclui `--runInBand` para evitar race conditions entre suites que compartilham o banco
- `migrations.integration-spec.ts`: drops sequenciais (evita deadlock), remoção de tipos enum antes de re-migrar

**Documentação**
- `docs/decisions/technical-decisions-phase-03-videos.md` — 8 decisões técnicas (TD-01..TD-08): estratégia de upload, BullMQ, worker separado, streaming 302, nanoid, thumbnail FFmpeg, FFmpeg no container, inicialização do bucket
- `docs/phases/phase-03-videos/` — pasta completa com context.md, validation.md, library-refs.md, phase-03-videos.md e progress.md
- `CLAUDE.md` (raiz e `nestjs-project/`) — atualizados com arquitetura da fase 03, variáveis de ambiente e fluxo de upload

---

## [Fase 02] — 2026-04-08 a 2026-05-05

### Backend — Autenticação e Usuários (`nestjs-project/`)

**SI-02.1 e SI-02.2 — Dependências e Filtros Globais**
- Instaladas dependências de autenticação: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `@nestjs/throttler`
- Criados filtros globais: `DomainExceptionFilter` (mapeia exceções de domínio para respostas HTTP) e `ValidationExceptionFilter` (formata erros de validação do `class-validator`)

**SI-02.3 — Entidades User e Channel**
- Entidade `User`: `id` (uuid), `email` (unique), `password` (select: false), `is_confirmed`, `created_at`, `updated_at`
- Entidade `Channel`: `id` (uuid), `name`, `nickname` (unique), `description`, `user_id` (FK → users, ON DELETE CASCADE), timestamps
- Migração `1775687773260-CreateUsersAndChannels`: cria tabelas com FK e índices

**SI-02.4 — Entidades RefreshToken e VerificationToken**
- Entidade `RefreshToken`: `id`, `token` (hash), `user_id` (FK), `family`, `revoked_at`, `expires_at`
- Entidade `VerificationToken`: `id`, `token` (hash), `user_id` (FK), `type` (enum: `email_confirmation | password_reset`), `used_at`, `expires_at`
- Migração `1777579850478-CreateAuthTokens`

**SI-02.5 — MailModule**
- Integração com Nodemailer e templates Handlebars
- Templates: `confirm-email.hbs` e `reset-password.hbs`
- Configuração via `mail.config.ts` (host, port, from)
- Serviço Mailpit para desenvolvimento (porta 1025/8025)

**SI-02.6 — Registro de Usuário**
- `POST /auth/register` — cria usuário + canal (com geração automática de nickname via sanitização do prefixo do email + retry com sufixo aleatório em colisão), envia email de confirmação

**SI-02.7 — Confirmação de Email**
- `GET /auth/confirm-email?token=...` — confirma conta via token assinado
- `POST /auth/resend-confirmation` — reenvia email de confirmação

**SI-02.8 — Login**
- `POST /auth/login` — autentica usuário confirmado, emite `access_token` (JWT curto) e `refresh_token` (JWT longo armazenado em hash no banco)

**SI-02.9 — Guard JWT Global**
- `JwtAuthGuard` registrado globalmente via `APP_GUARD`
- Decorator `@Public()` para endpoints sem autenticação
- Decorator `@CurrentUser()` para injeção do payload JWT no controller

**SI-02.10 — Rotação de Refresh Token**
- `POST /auth/refresh` — emite novo par de tokens; detecta reuso de refresh token por família (revoga toda a família em reuso)

**SI-02.11 — Logout**
- `POST /auth/logout` — revoga todos os refresh tokens do usuário

**SI-02.12 — Redefinição de Senha**
- `POST /auth/forgot-password` — gera token de reset e envia email
- `POST /auth/reset-password` — valida token e atualiza senha

**SI-02.13 — Rate Limiting**
- `ThrottlerModule` com limite de 10 requisições/minuto nos endpoints de autenticação

**Correções pós-fase 02**
- Atualização de regras e documentação de IA com aprendizados

---

## [Fase 02 — Frontend] — 2026-05-13 a 2026-06-23

### Frontend (`next-frontend/`)

**Fundação do Projeto Next.js**
- Criação do projeto Next.js com App Router
- Configuração de variáveis de ambiente (`next.config.ts`, `.env.local`)
- Tipagem automática do OpenAPI gerado pelo backend (`openapi-types`)
- Fundação de testes com Vitest e MSW (Mock Service Worker)
- Guia de testes e instruções de IA no `claude.md`

**Design System e UI**
- Instalação e configuração do shadcn/ui
- Implementação do componente `Button` com tokens do design system
- Ajustes de `globals.css` para tokens de cores, tipografia e espaçamento

**Figma e Design**
- Arquivo-fonte `FC Tube.fig` com design system completo (tokens, componentes, telas)
- Configuração do Figma MCP para integração com Claude Code
- Skills de auditoria e aplicação de tokens do Figma no projeto
- Regras de design system no `.claude/rules/`

**Documentação Frontend**
- `docs/design-system.md` — referência de tokens visuais
- Skills e regras de IA para o contexto Next.js/React

---

## [Fase 01] — 2026-03-15 a 2026-04-08

### Backend — Configuração Base (`nestjs-project/`)

**Infraestrutura**
- Criação do projeto NestJS com TypeScript
- Docker Compose com serviços: `nestjs-api` (porta 3000), `db` (PostgreSQL 17, porta 5432), `mailpit` (porta 8025)
- `.gitignore` configurado para Node.js, Docker e variáveis de ambiente

**Configuração do Projeto**
- TypeORM com PostgreSQL e suporte a migrations
- `ConfigModule` global com validação via Joi (`env.validation.ts`)
- Configs por domínio: `database.config.ts`, `auth.config.ts`, `mail.config.ts`
- `DataSource` de migrations separado (`src/database/data-source.ts`)
- Scripts npm: `migration:run`, `migration:revert`, `migration:generate`

**Qualidade e Documentação**
- ESLint + Prettier configurados
- Estrutura de `docs/` com `project-plan.md` e diagrama C4 de arquitetura (`docs/diagrams/software-arch.mermaid`)
- `CLAUDE.md` global e `nestjs-project/CLAUDE.md` com convenções de desenvolvimento
- Rules de IA: `nestjs-common-conventions.md`, `nestjs-testing.md`, `typeorm-migrations.md`, `typeorm-queries.md`, `typescript-strict.md`

---

## [Setup Inicial] — 2026-03-15 a 2026-04-08

### Configuração do Repositório e Tooling de IA

- Criação do `CLAUDE.md` global com visão geral do projeto StreamTube
- Regras de desenvolvimento (`rules/`) para NestJS, TypeORM, TypeScript e testes
- Skills do Claude Code para research, planejamento de implementação e geração de guias de teste
- Configuração dos MCPs: Context7 (documentação de bibliotecas) e PostgreSQL
- Whiteboard com mapa mental do projeto
- `README.md` com descrição do projeto, links para design system e quadro branco
- Diagramas de fluxo para as fases de pesquisa, planejamento e implementação
- Documentação de decisões técnicas por fase (`docs/decisions/`)
