---
kind: phase
name: phase-07-home-search
sources_mtime:
  docs/project-plan.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-07-home-search.md: "2026-06-29T00:00:00-03:00"
  docs/phases/phase-06-social/phase-06-social.md: "2026-06-29T00:00:00-03:00"
---

# phase-07-home-search — Context

## Scope

**Phase name:** Fase 07 — Página Inicial, Busca e Finalização

**Capabilities**

- Página inicial com grade de vídeos públicos (mais vistos)
- Filtro de categoria na home (barra horizontal de chips)
- Barra de busca no header (pesquisa por título e canal)
- Página de resultados de busca (`/search?q=...`)
- Header/navbar global com logo, busca, botão de login ou avatar do usuário
- Layout responsivo para dispositivos móveis (Tailwind breakpoints)
- Produção: Docker Compose pronto para deploy

**Out of scope:** Notificações push, feeds personalizados baseados em ML, recomendações além de "mesma categoria", analytics avançado, CDN global.

**Deliverables:** Home page funcional com busca e categorias; header global; layout responsivo; Docker Compose production-ready.

**Affected subprojects:** `nestjs-project/` (search enhancement on GET /videos), `next-frontend/` (home, search page, header, responsive layout).

**Sequencing notes:** Final phase. All prior phases (01-06) must be complete. The search enhancement to `GET /videos` adds `q` parameter and `ORDER BY view_count DESC` support. No new tables or migrations required.

**Neighbors:** Fase 06 — Interações Sociais (prior, provides all data).

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| phase-07/TD-01 | technical-decisions-phase-07-home-search.md | Backend | Search Implementation Strategy | decided | A (`ILIKE`) | — |
| phase-07/TD-02 | technical-decisions-phase-07-home-search.md | Backend + Frontend | Pagination Strategy | decided | A (Offset, "Load more" UX) | — |
| phase-07/TD-03 | technical-decisions-phase-07-home-search.md | Frontend | Navigation and Header | decided | A (Shared `layout.tsx` Header) | — |
| phase-07/TD-04 | technical-decisions-phase-07-home-search.md | Frontend | Responsive Layout Strategy | decided | A (Tailwind mobile-first breakpoints) | — |

## Capability Coverage

| Capability | Covered by |
|------------|------------|
| Home page com grade de vídeos | phase-07/TD-02 (Load more pagination) |
| Filtro de categoria na home | `GET /videos?category_id=` (implemented Phase 04, reused) |
| Barra de busca + resultados | phase-07/TD-01 (`ILIKE` on `GET /videos?q=`) |
| Header/navbar global | phase-07/TD-03 (shared `layout.tsx`) |
| Layout responsivo | phase-07/TD-04 (Tailwind breakpoints) |
| Production Docker Compose | No TD needed — configuration task |

## Decisions Detail

### phase-07/TD-01
**Recommendation:** `ILIKE '%:q%'` on `videos.title` and `channels.nickname` — no extra infrastructure, sufficient for MVP scale. Existing `GET /videos` enhanced with `q` query param. No migration needed.
**Libraries:** —

### phase-07/TD-02
**Recommendation:** Offset pagination already implemented in backend. Frontend uses "Load more" button that fetches the next page and appends results to the list (append-only client state). No backend changes required for home page.
**Libraries:** —

### phase-07/TD-03
**Recommendation:** `Header` Client Component in root `app/layout.tsx`. Contains: logo → `/`, search input (navigates to `/search?q=...` on enter), auth state (login button if unauthenticated; avatar + dropdown if authenticated). Uses server-side session reading and client interactivity.
**Libraries:** —

### phase-07/TD-04
**Recommendation:** Tailwind CSS mobile-first responsive design. Home grid: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`. Watch page: single column on mobile, `lg:grid-cols-3` for player+sidebar. Already set up in Phase 02.
**Libraries:** —

## Inherited Decisions Detail

### phase-04-video-management/TD-01
Categories are a separate table. `GET /videos?category_id=` already supports category filter from Phase 04. Home page reuses this.

### phase-05-video-watch/TD-02
View count tracked via `POST /videos/:slug/views`. Home page ordering by `view_count DESC` uses the existing counter column.

### phase-03-videos/TD-04
Video streaming via 302 redirect to MinIO presigned URL. Video thumbnails served from MinIO via presigned URLs on the home page video cards.

## Inherited Conventions
- `GET /videos` is `@Public()` — home page requires no auth. _(phase 03)_
- `category_id` filter already implemented in `GET /videos`. _(phase 04)_
- BFF Route Handlers proxy all browser traffic to NestJS API. _(phase 02)_
- shadcn/ui + Tailwind for all UI components. _(phase 02)_
- `@Public()` decorator for anonymous routes. _(phase 02)_

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale |
|------------|--------|-----------|
| Feed personalizado baseado em ML | deferred | Requer sistema de recomendação e dados históricos de uso |
| CDN para assets e vídeos | deferred | Infraestrutura de produção adicional; MinIO suficiente para MVP |
| Analytics de reprodução | deferred | Fora do escopo deste projeto |
| Notificações para inscritos (email/push) | deferred | Requer sistema de notificação assíncrono (Fase 06 decidiu manter deferred) |
