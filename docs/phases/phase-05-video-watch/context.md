---
kind: phase
name: phase-05-video-watch
sources_mtime:
  docs/project-plan.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-05-video-watch.md: "2026-06-29T00:00:00-03:00"
  docs/phases/phase-04-video-management/phase-04-video-management.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-04-video-management.md: "2026-06-29T00:00:00-03:00"
---

# phase-05-video-watch — Context

## Scope

**Phase name:** Fase 05 — Página de Visualização do Vídeo

**Capabilities**

- Player de vídeo com controles: play/pause, volume e barra de progresso
- Layout da página: vídeo principal + informações + sidebar com sugestões
- Descrição do vídeo com expansão/recolhimento
- Contagem de visualizações
- Sugestões de vídeos da mesma categoria na sidebar
- Acesso anônimo à visualização de vídeos
- Botão de download do vídeo
- Vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens)

**Out of scope:** Likes, comentários, inscrições (Fase 06); home page, busca, navegação global (Fase 07).

**Deliverables:** Página de visualização com player funcional, sidebar de sugestões, download e acesso anônimo.

**Affected subprojects:** `next-frontend/` (primary), `nestjs-project/` (view count + suggestions endpoints)

**Sequencing notes:** Depends on Fase 03 (streaming endpoint, presigned URLs) and Fase 04 (category, visibility, channel page context). Provides the watch experience required by Fase 06 (social features appear on this page).

**Neighbors (for boundary detection only):** Fase 04 (prior), Fase 06 — Interações Sociais (next).

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| phase-05-video-watch/TD-01 | technical-decisions-phase-05-video-watch.md | Frontend | Video Player Technology | decided | A (Native HTML5 `<video>` element) | — |
| phase-05-video-watch/TD-02 | technical-decisions-phase-05-video-watch.md | Backend | View Count Tracking | decided | A (Synchronous DB increment via POST /views) | — |
| phase-05-video-watch/TD-03 | technical-decisions-phase-05-video-watch.md | Backend | Suggestions Algorithm | decided | A (Same category, by view count, limit 10) | — |
| phase-05-video-watch/TD-04 | technical-decisions-phase-05-video-watch.md | Backend + Frontend | Unlisted Video Access | decided | A (Visibility check per endpoint) | — |

## Capability Coverage

| Capability | Covered by |
|------------|------------|
| Player de vídeo com controles | phase-05-video-watch/TD-01 |
| Layout da página (vídeo + info + sidebar) | phase-05-video-watch/TD-01, phase-05-video-watch/TD-03 |
| Contagem de visualizações | phase-05-video-watch/TD-02 |
| Sugestões da mesma categoria | phase-05-video-watch/TD-03 |
| Acesso anônimo | phase-05-video-watch/TD-04 (no auth required for watch) |
| Botão de download | phase-03-videos/TD-04 (download endpoint already exists) |
| Unlisted via link direto | phase-05-video-watch/TD-04 |

## Decisions Detail

### phase-05-video-watch/TD-01
**Recommendation:** Native HTML5 `<video>` element — zero dependencies, works natively with the presigned URL redirect from Phase 03, full browser Range request support.
**Libraries:** —

### phase-05-video-watch/TD-02
**Recommendation:** Synchronous DB increment (`UPDATE ... SET view_count = view_count + 1`) — sufficient for project scale. Frontend debounces to one call per page visit.
**Libraries:** —

### phase-05-video-watch/TD-03
**Recommendation:** Same category ordered by view_count DESC, exclude current video, limit 10.
**Libraries:** —

### phase-05-video-watch/TD-04
**Recommendation:** Visibility check per endpoint — `GET /videos` list requires `visibility = 'public'`; `GET /videos/:slug` and streaming/download allow both public and unlisted when status = ready.
**Libraries:** —

## Inherited Decisions Detail

### phase-04-video-management/TD-03
**Recommendation:** Enum column `visibility: public | unlisted` — Phase 05 enforces this in the watch page: unlisted videos do not appear in listings but ARE watchable via direct URL.
**Libraries:** —

### phase-04-video-management/TD-05
**Recommendation:** Denormalized counter columns — Phase 05 adds `view_count` increment logic.
**Libraries:** —

### phase-03-videos/TD-04
**Recommendation:** 302 redirect to presigned GET URL — the `<video src>` will follow the redirect and stream from MinIO with native Range request support.
**Libraries:** —

## Inherited Conventions
- `@Public()` decorator for unauthenticated access. _(phase 02)_
- BFF Route Handlers in `next-frontend/app/api/` proxy to NestJS API. _(phase 02)_
- `GET /videos/:slug/stream` already returns 302 → presigned MinIO URL. _(phase 03)_
- Server Components for data fetching; Client Components only for interactive elements (player controls). _(phase 02)_

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale |
|------------|--------|-----------|
| Likes e comentários na página de watch | deferred | Implementados na Fase 06 |
| Botão de inscrição no canal | deferred | Implementado na Fase 06 |
| Qualidade adaptativa (HLS) | deferred | Requer transcodificação — fora do escopo do projeto |
