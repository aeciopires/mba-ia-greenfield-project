# Changelog

All notable changes to StreamTube are documented here, organized by release phase.

---

## [Correções e Gerenciamento de Categorias] — 2026-06-30

### Backend — Correções (`nestjs-project/`)

- **Worker Docker networking**: `VideoProcessingProcessor` agora usa `generateInternalDownloadPresignedUrl` (signed com `s3Client` / `http://minio:9000`) ao invés de `generateDownloadPresignedUrl` (signed com endpoint público `localhost:9000`). Corrige o erro "Connection refused" que impedia o processamento de vídeos dentro do container.
- **Retry a partir do estado `error`**: `VideosService.startProcessing` aceita transição `ERROR → PROCESSING` (antes só `DRAFT`); `error_message` é resetado para null na nova tentativa.
- **Thumbnail GET endpoint**: adicionado `GET /videos/:slug/thumbnail` (público) que redireciona 302 para URL presigned da thumbnail no MinIO. Corrige 405 ao exibir thumbnails em `<img>` tags.
- **Rate limiting**: adicionado `@SkipThrottle()` em `CategoriesController`, `VideosController` e `ChannelsController` — o throttle de 10 req/60s permanece apenas em `AuthController` (proteção contra brute force). Corrige erro 429 em endpoints de leitura pública.
- **Gerenciamento de categorias** — novos endpoints no `CategoriesModule`:
  - `POST /categories` (JWT) — cria categoria; slug auto-gerado a partir do nome
  - `GET /categories/:id` (público) — retorna categoria por id
  - `PATCH /categories/:id` (JWT) — atualiza nome e slug
  - `DELETE /categories/:id` (JWT, 204) — remove categoria; vídeos que a usavam têm `category_id` zerado para null (FK `ON DELETE SET NULL`)
  - Nova exceção de domínio: `CategorySlugAlreadyExistsException` (409)
  - DTOs: `CreateCategoryDto`, `UpdateCategoryDto`
  - 13 novos testes unitários em `categories.service.spec.ts`

### Frontend — Correções e Novas Páginas (`next-frontend/`)

- **Studio — link do título**: na listagem de vídeos do studio, o título agora aponta para `/watch/${slug}` (play) em vez da página de edição.
- **Studio — link de categorias**: banner "Manage categories →" adicionado acima da tabela de vídeos na página de studio.
- **Gerenciamento de categorias**:
  - `/studio/categories` — lista de categorias com edição e remoção
  - `/studio/categories/new` — formulário de criação
  - `/studio/categories/[id]` — formulário de edição
  - Componentes: `CategoryForm` (create/edit), `CategoryDeleteButton` (confirm + delete)
  - BFF routes: `POST /api/categories`, `GET/PATCH/DELETE /api/categories/[id]`

### Documentação

- **README** — tutorial expandido de 9 para 16 passos: publicar vídeo, atualizar título, incrementar visualizações, listar/atribuir categorias, comentários, likes, inscrições em canal
- **Seed de categorias** reescrito (estava vazio): 8 categorias padrão inseridas de forma idempotente por slug
- **Correção no README**: parâmetro de filtro de vídeos por categoria era `?category=` (errado); corrigido para `?category_id=`

---

## [Fases 04–07 + Correções de Testes] — 2026-06-29

### Backend — Gerenciamento de Vídeos, Canal e Social (`nestjs-project/`)

**Fase 04 — Categorias, Edição e Publicação**
- `CategoriesModule` + entidade `Category` com `GET /categories` (público)
- `VideosModule` expandido: `PATCH /videos/:id` (edição), `POST /videos/:id/thumbnail` (presigned URL para thumbnail customizada), `PATCH /videos/:id/publish` (publicação)
- Enum `visibility` (`public | unlisted`) + campo `published_at` + FK nullable `category_id` na entidade `Video`
- `ChannelsModule` expandido: `GET /channels/:nickname`, `GET /channels/:nickname/videos`, `PATCH /channels/:nickname`, `GET /channels/:nickname/studio/videos`
- Migração `1781000000000-Phase04VideoManagement`

**Fase 05 — Visualização e Sugestões**
- `POST /videos/:slug/views` — incremento atômico de `view_count`
- `GET /videos/:slug/suggestions` — até 10 vídeos da mesma categoria por `view_count DESC`
- Migração `1782000000000-Phase05ViewCount`: coluna `view_count` em `videos`

**Fase 06 — Interações Sociais**
- `SocialModule` composto de `VideoLikesModule`, `CommentsModule`, `CommentLikesModule`, `SubscriptionsModule`
- 11 novos endpoints: likes/dislikes em vídeos e comentários, comentários com respostas (max depth 1), inscrições em canais, listagem de assinaturas
- Contadores atômicos: `likes_count`, `dislikes_count`, `comments_count` em `videos`; `subscribers_count` em `channels`
- Migração `1783000000000-Phase06SocialFeatures`: 4 novas tabelas + colunas de contador

**Fase 07 — Busca**
- `GET /videos?q=<texto>` — busca ILIKE no título e no nickname do canal, ordenado por `view_count DESC`

### Frontend — Páginas e Componentes (`next-frontend/`)

- `/studio/videos` — painel de vídeos do canal autenticado com edição e publicação
- `/channel/[nickname]` — perfil público do canal
- `/watch/[slug]` — player HTML5, view count, sugestões, like/dislike e comentários
- `/subscriptions` — canais seguidos pelo usuário autenticado
- `/` (home) — grid de vídeos mais assistidos
- `/search` — resultados de busca (`?q=`)
- Header com busca, logo e menu de autenticação
- Route Handlers BFF para todos os novos endpoints

### Correções de Testes e Isolamento de Infraestrutura

- **TypeORM entity metadata**: `Category` adicionada ao array de entidades em 5 arquivos de teste que incluíam `Video` sem a entidade relacionada (`Video#category`)
- **BullMQ Redis hang**: 4 arquivos de módulo spec agora usam `ConfigModule.forRoot` com `queueConfig` + `storageConfig` e `.overrideProvider(getQueueToken(VIDEO_PROCESSING_QUEUE))` para evitar conexão Redis real no DI graph de teste (`ChannelsModule → forwardRef(VideosModule) → QueueModule`)
- **`migrations.integration-spec.ts`**: atualizado para todas as 6 migrações e 10 tabelas; limpeza de todos os enum types criados nas fases 04-06
- **Frontend TypeScript**: `session.access_token` → `session.accessToken` em 14 arquivos BFF; `StreamtubeIcon` → `StreamTubeIcon`; cast `NextResponse<never>` na rota de stream

### Makefile

- `Makefile` na raiz com targets: `install`, `up`, `down`, `logs`, `test`, `test-backend`, `test-e2e`, `test-frontend`, `lint`, `typecheck`, `migrate`, `seed`

---

## [Planejamento Fases 04–07] — 2026-06-29

### Documentação de Planejamento

Criados todos os documentos de decisões técnicas e planos de implementação (Step Implementations) para as fases 04 a 07.

**Decisões técnicas criadas:**
- `docs/decisions/technical-decisions-phase-04-video-management.md` — 5 TDs: categorias (tabela separada), thumbnail customizado (presigned URL), visibilidade (`public | unlisted`), fluxo de publicação (endpoint PATCH /publish), contadores denormalizados
- `docs/decisions/technical-decisions-phase-05-video-watch.md` — 4 TDs: player nativo HTML5, view count síncrono (POST /views), sugestões por categoria, acesso a vídeos unlisted por link direto
- `docs/decisions/technical-decisions-phase-06-social.md` — 4 TDs: likes/dislikes (tabela única com `type`), estrutura de comentários (adjacency list, max depth 1), contadores atômicos, inscrições em canais (join table)
- `docs/decisions/technical-decisions-phase-07-home-search.md` — 4 TDs: busca com `ILIKE`, paginação offset com "Load more", header compartilhado em `layout.tsx`, breakpoints Tailwind mobile-first

**Planos de implementação criados (cada fase com 5 arquivos):**
- `docs/phases/phase-04-video-management/` — 10 SIs: migration, CategoriesModule, VideosService updates, 3 novos endpoints, GET /videos updates, ChannelsModule, páginas frontend Studio e Canal, testes, docs
- `docs/phases/phase-05-video-watch/` — 7 SIs: view_count column, /views endpoint, /suggestions endpoint, BFF handlers, watch page + player, suggestions sidebar, testes
- `docs/phases/phase-06-social/` — 10 SIs: migration 4 tabelas + counter columns, VideoLikesModule, CommentsModule, CommentLikesModule, SubscriptionsModule, SocialModule, like/dislike buttons, comment section, subscribe button, testes
- `docs/phases/phase-07-home-search/` — 8 SIs: /videos?q= ILIKE search, BFF forward q param, Header component, home page + VideoGrid, search results page, responsive layout pass, production Docker Compose, testes finais

**Documentação geral:**
- `README.md` — atualizado com estrutura de diretórios das fases 04-07, seções de funcionalidades planejadas, mermaid do fluxo de interações sociais, endpoints planejados
- `nestjs-project/CLAUDE.md` — adicionada seção "Planned Modules (Phases 04–07)" na seção Architecture
- `CHANGELOG.md` — adicionada esta seção

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
