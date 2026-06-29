---
kind: phase
name: phase-04-video-management
sources_mtime:
  docs/project-plan.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-04-video-management.md: "2026-06-29T00:00:00-03:00"
  docs/phases/phase-03-videos/phase-03-videos.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-06-29T00:00:00-03:00"
---

# phase-04-video-management — Context

## Scope

**Phase name:** Fase 04 — Gerenciamento de Vídeos e Canal

**Capabilities**

- Categorias de vídeo disponíveis na plataforma
- Edição das informações do vídeo: título, descrição, categoria e thumbnail customizada
- Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)
- Fluxo de rascunho → publicação
- Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)
- Edição de vídeos a partir do painel
- Edição das informações do canal: nickname, nome e descrição
- Página pública do canal com informações e listagem de vídeos

**Out of scope:** Likes, comentários, inscrições, visualizações (Fase 06); home page e busca (Fase 07); player de vídeo completo (Fase 05).

**Deliverables:** Edição completa de vídeos, rascunho/publicação, painel de gerenciamento, edição de canal, página pública do canal.

**Affected subprojects:** `nestjs-project/`, `next-frontend/`

**Sequencing notes:** Depends on Fase 02 (users, channels, auth) and Fase 03 (videos entity, storage, queue). Provides the channel page and video management foundations required by Fase 05 (watch page) and Fase 06 (social features on managed videos).

**Neighbors (for boundary detection only):** Fase 03 (prior), Fase 05 — Página de Visualização do Vídeo (next).

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| phase-04-video-management/TD-01 | technical-decisions-phase-04-video-management.md | Backend | Category Storage Strategy | decided | A (Separate `categories` table with FK from `videos`) | — |
| phase-04-video-management/TD-02 | technical-decisions-phase-04-video-management.md | Backend | Custom Thumbnail Upload Strategy | decided | A (Presigned PUT URL — same pattern as Phase 03) | — |
| phase-04-video-management/TD-03 | technical-decisions-phase-04-video-management.md | Backend + Frontend | Video Visibility Model | decided | A (Enum column `visibility: public \| unlisted`) | — |
| phase-04-video-management/TD-04 | technical-decisions-phase-04-video-management.md | Backend | Draft → Publish Flow | decided | A (Dedicated `PATCH /videos/:id/publish` endpoint) | — |
| phase-04-video-management/TD-05 | technical-decisions-phase-04-video-management.md | Backend | Channel Admin Panel Stats | decided | A (Denormalized counter columns on `videos`) | — |

_Source files:_

- `docs/decisions/technical-decisions-phase-04-video-management.md`

## Capability Coverage

| Capability | Covered by |
|------------|------------|
| Categorias de vídeo disponíveis na plataforma | phase-04-video-management/TD-01 |
| Edição das informações do vídeo (título, descrição, categoria, thumbnail) | phase-04-video-management/TD-02, phase-04-video-management/TD-01 |
| Visibilidade do vídeo (público/unlisted) | phase-04-video-management/TD-03 |
| Fluxo de rascunho → publicação | phase-04-video-management/TD-04 |
| Painel de gerenciamento (stats por vídeo) | phase-04-video-management/TD-05 |
| Edição de vídeos a partir do painel | phase-04-video-management/TD-04, phase-04-video-management/TD-02 |
| Edição das informações do canal | phase-04-video-management/TD-01 (channel module extension) |
| Página pública do canal | phase-04-video-management/TD-03 (public listing filter) |

## Decisions Detail

### phase-04-video-management/TD-01

**Recommendation:** Option A (Separate `categories` table) — Enables dynamic management, clean `GET /categories` endpoint, and a FK reference required by Phase 07 filtering. Seed the initial category set in a dedicated seeder.

**Libraries:** —

### phase-04-video-management/TD-02

**Recommendation:** Option A (Presigned PUT URL) — Stays consistent with Phase 03's storage pattern, keeps the API stateless, and reuses existing `StorageService.generateUploadPresignedUrl`.

**Libraries:** (reuses `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)

### phase-04-video-management/TD-03

**Recommendation:** Option A (Enum column `visibility: public | unlisted`) — Explicit, extensible, readable. Consistent with `VideoStatus` enum from Phase 03.

**Libraries:** —

### phase-04-video-management/TD-04

**Recommendation:** Option A (Dedicated `PATCH /videos/:id/publish` endpoint) — Publishing is a meaningful state transition, not just a field update. Mirrors Phase 03's `start-processing` pattern. Tracks `published_at` timestamp.

**Libraries:** —

### phase-04-video-management/TD-05

**Recommendation:** Option A (Denormalized counter columns) — O(1) reads for the admin panel. Counters incremented atomically via `UPDATE ... SET counter = counter + 1`.

**Libraries:** —

## Inherited Decisions Detail

### phase-03-videos/TD-01

**Recommendation:** Option A (Presigned URL) — Phase 04 custom thumbnail upload follows the same presigned URL pattern for consistency.

**Libraries:** `@aws-sdk/client-s3@^3.x`, `@aws-sdk/s3-request-presigner@^3.x`

### phase-03-videos/TD-09

**Recommendation:** Option A (VideoStatus enum) — Phase 04 adds `publish` transition: video must be in `READY` status to be published.

**Libraries:** —

### phase-02-auth/TD-07

**Recommendation:** Option A (Custom Domain Exception Filter) — Phase 04 adds `CategoryNotFoundException`, `VideoVisibilityException`, `ChannelNotFoundException` following the same pattern.

**Libraries:** —

## Inherited Conventions

- Backend config uses `@nestjs/config` with namespaced `registerAs` factories. _(phase 01)_
- All endpoints protected by `JwtAuthGuard` (APP_GUARD); public endpoints use `@Public()`. _(phase 02)_
- Domain errors use `DomainException` subclasses mapped by `DomainExceptionFilter`. _(phase 02)_
- Storage operations via `StorageService` (presigned URLs, `putObject`, `deleteObject`). _(phase 03)_
- Migrations are versionated; `synchronize: false`. _(phase 01/03)_
- Tests: `*.spec.ts` (unit), `*.integration-spec.ts` (integration), `*.e2e-spec.ts` (HTTP E2E). _(phase 01/02)_
- Counter columns use atomic `UPDATE ... SET col = col + 1` — never read-modify-write. _(phase 04/TD-05)_

## Inherited Deferred Capabilities

| Capability | Deferred from | Status |
|------------|---------------|--------|
| Interface de upload de vídeos no frontend | Phase 03 | **Addressed in Phase 04** — video upload UI and Studio pages implemented |
| Player de vídeo no frontend | Phase 03 | Remains deferred — addressed in Phase 05 |

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale | TD refs |
|------------|--------|-----------|---------|
| Likes e visualizações no painel | deferred | Counters exist but are populated by Phase 05/06 | TD-05 |
| Restrição de canal verificado/monetizado | deferred | Fora do escopo do projeto | — |
