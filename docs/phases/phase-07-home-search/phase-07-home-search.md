---
kind: phase
name: phase-07-home-search
sources_mtime:
  docs/phases/phase-07-home-search/context.md: "2026-06-29T00:00:00-03:00"
---

# Phase 07 — Página Inicial, Busca e Finalização

## Objective

Deliver the home page (video grid sorted by view count, category chip filter, load more), the global header (logo, search bar, auth state), the search results page (`/search?q=...`), responsive layout across all pages, and Docker Compose production readiness. The backend enhancement is limited to adding `q` (ILIKE search) and `order_by=view_count` support to the existing `GET /videos` endpoint.

---

## Step Implementations

### SI-07.1 — Backend: GET /videos — Add Search (`q`) Parameter

**Description:** Enhance the existing `GET /videos` endpoint with a free-text `q` query parameter that filters by title and channel nickname using `ILIKE`.

**Technical actions:**

- Extend `src/videos/dto/query-videos.dto.ts` — add optional `q?: string` field (max 255 chars, `@IsOptional @IsString @MaxLength`)
- Extend `VideosService.findAll()` — if `q` is provided, add `WHERE v.title ILIKE :q OR ch.nickname ILIKE :q` using `%${q}%` parameter (parameterized, not string concatenation); add `ORDER BY view_count DESC` as primary sort (secondary: `created_at DESC`)
- No migration required

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` (extend) | Unit | `q` param adds ILIKE clause; empty q returns all; special chars sanitized (TypeORM parameterization) |
| `test/videos.e2e-spec.ts` (extend) | E2E | `GET /videos?q=test` returns videos matching title; `GET /videos?q=channelname` returns videos by channel; empty result for unmatched query |

**Dependencies:** Phase 06 complete

**Acceptance criteria:**
- Search is case-insensitive; results are ordered by `view_count DESC`

---

### SI-07.2 — Frontend: BFF Route Handler for Home + Search

**Description:** Ensure the existing BFF `GET /api/videos` handler passes through `q` and `category_id` query params.

**Technical actions:**

- Review `next-frontend/app/api/videos/route.ts` — confirm `q`, `category_id`, `page`, `limit` are forwarded from incoming request URL to the NestJS API request
- Update if params are dropped or not forwarded

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `app/api/videos/route.integration.test.ts` (extend) | Integration (MSW) | `q` param forwarded; `category_id` forwarded; pagination params forwarded |

**Dependencies:** SI-07.1

---

### SI-07.3 — Frontend: Header Component

**Description:** Create the global header rendered in `app/layout.tsx`.

**Technical actions:**

- Create `next-frontend/components/layout/Header.tsx` (Client Component):
  - Logo link → `/`
  - Search form: `<input>` + submit → `router.push('/search?q=' + encodeURIComponent(q))` on enter/submit; pre-filled from `useSearchParams()` on search page
  - Auth state: if authenticated → avatar with dropdown (My Channel `/channel/:nickname`, My Studio `/studio/videos`, My Subscriptions `/subscriptions`, Logout); if unauthenticated → "Entrar" button → `/login`
  - Mobile: hamburger toggle collapses nav links
- Create `next-frontend/components/layout/UserMenu.tsx` (Client Component) — dropdown for authenticated users
- Register `Header` in `next-frontend/app/layout.tsx` above `{children}`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `components/layout/Header.test.tsx` | Unit | Logo links to `/`; search submit navigates to `/search?q=...`; unauthenticated shows login; authenticated shows avatar |

**Dependencies:** SI-07.2

---

### SI-07.4 — Frontend: Home Page

**Description:** Implement the home page at `/` showing the video grid.

**Technical actions:**

- Create/update `next-frontend/app/page.tsx` (Server Component) — fetches `GET /api/videos?page=1&limit=20` for initial videos; fetches `GET /api/categories` for category chips; passes data to Client Components
- Create `next-frontend/components/home/CategoryChips.tsx` (Client Component) — horizontal scrollable row of category chips; clicking a chip navigates to `/?category_id=:id` or clears filter; active chip highlighted
- Create `next-frontend/components/home/VideoGrid.tsx` (Client Component) — renders video cards in responsive grid (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`); "Load more" button fetches `?page=n+1` and appends results; shows loading skeleton during fetch; empty state if no videos
- Create `next-frontend/components/video/VideoCard.tsx` — displays thumbnail (from MinIO presigned URL via BFF), title, channel name, view count, duration, relative date; links to `/watch/:slug`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `components/home/VideoGrid.test.tsx` | Unit | Renders video cards; "Load more" appends on click; empty state shows; loading state shown |
| `components/home/CategoryChips.test.tsx` | Unit | Renders chips; active chip highlighted; click updates URL |
| `components/video/VideoCard.test.tsx` | Unit | Displays title, channel, view count; links to watch page |
| `app/page.test.tsx` | Unit | Renders with mocked data (VideoGrid + CategoryChips); 0 videos shows empty state |

**Dependencies:** SI-07.3

---

### SI-07.5 — Frontend: Search Results Page

**Description:** Implement the search results page at `/search`.

**Technical actions:**

- Create `next-frontend/app/search/page.tsx` (Server Component) — reads `q` from `searchParams`; fetches `GET /api/videos?q=:q&page=1&limit=20`; passes results to `VideoGrid`; shows "Resultados para: {q}" heading or "Nenhum resultado encontrado" if empty
- `VideoGrid` from SI-07.4 is reused; `CategoryChips` hidden on search page (search is already filtered by title)

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `app/search/page.test.tsx` | Unit | Renders with mocked results; shows query in heading; empty state when no results |

**Dependencies:** SI-07.4

---

### SI-07.6 — Responsive Layout Pass

**Description:** Audit and fix responsive layout across all existing pages.

**Technical actions:**

- Watch page (`/watch/[slug]`): single column on mobile → two columns (`lg:grid-cols-3` with suggestions sidebar) on desktop
- Channel page (`/channel/[nickname]`): single column on mobile, description + video grid
- Studio pages (`/studio/videos`, `/studio/videos/:id/edit`): table collapses to cards on mobile
- Header: hamburger menu on mobile (toggle nav links)
- Ensure all interactive targets ≥ 44px touch target size

**Tests:**

_Visual testing in browser (cannot be automated here). Dev server check required._

**Dependencies:** SI-07.5

---

### SI-07.7 — Production Docker Compose

**Description:** Prepare the Docker Compose setup for production-like deployment.

**Technical actions:**

- Create `nestjs-project/compose.prod.yaml` (or `docker-compose.prod.yml`) — production variant with:
  - `nestjs-api`: built image (`build: .`, `dockerfile: Dockerfile.prod`), `NODE_ENV=production`, `restart: unless-stopped`
  - `next-frontend`: production build container
  - `video-worker`: production entrypoint (`node dist/worker.js`)
  - All 7 services with health checks and proper `depends_on` conditions
  - Volumes for persistent data (`postgres_data`, `minio_data`, `redis_data`)
  - `env_file: .env.prod` (documented in `.env.example`)
- Create `nestjs-project/Dockerfile.prod` — multi-stage build: `builder` (tsc + build) → `runner` (production node, no devDeps, ffmpeg)
- Create `next-frontend/Dockerfile.prod` — multi-stage Next.js build: `deps` → `builder` → `runner` (standalone output)
- Update `docs/` with deployment guide

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| Manual: `docker compose -f compose.prod.yaml up --build` | Manual | All services start; API responds; video upload flow works |

**Dependencies:** SI-07.6

---

### SI-07.8 — Integration + E2E Tests + Final Documentation

**Description:** Full test suite pass and final documentation updates.

**Technical actions:**

- Extend `test/videos.e2e-spec.ts`: `GET /videos?q=<title>` returns matching results; `GET /videos?q=<channel>` returns by channel; `GET /videos?category_id=<id>&q=<text>` combines filters
- Playwright E2E (`tests/home.e2e-spec.ts`): home page loads video grid; category chip filters results; search redirects to `/search?q=...`; search page shows results
- Update `nestjs-project/CLAUDE.md`: document `q` parameter on `GET /videos`; add Phase 07 to module summary
- Update root `README.md`: Phase 07 status → ✅; add Phase 07 to Tutorial; document production deploy
- Update `CHANGELOG.md`: add Phase 07 section

**Dependencies:** SI-07.7

**Acceptance criteria:**
- `npm test -- --runInBand` all green; `npm run test:e2e` all green; Playwright tests pass; `tsc --noEmit` exits 0; lint exits 0
- All 7 phases ✅ in README.md

---

## Technical Specifications

### Backend Change: GET /videos — New Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| q | string (optional) | Free-text search on `videos.title ILIKE` OR `channels.nickname ILIKE` |
| order_by | string (optional, default: `view_count`) | Sort field — `view_count DESC` for home page |

_(Existing: `page`, `limit`, `category_id`, `channel_id`)_

### Responsive Grid Breakpoints

| Page | Mobile (default) | sm (640px+) | md (768px+) | lg (1024px+) |
|------|-----------------|-------------|-------------|--------------|
| Home grid | 1 col | 2 cols | 3 cols | 4 cols |
| Watch page | stacked | stacked | stacked | player (2/3) + sidebar (1/3) |
| Studio table | card list | card list | table | table |

### New Frontend Routes

| Route | Page | Auth |
|-------|------|------|
| `/` | Home page | Public |
| `/search` | Search results | Public |

---

## Dependency Map

```
SI-07.1 (Backend: GET /videos + search q param)
└── SI-07.2 (Frontend BFF: forward q param)
    └── SI-07.3 (Header component + layout.tsx)
        └── SI-07.4 (Home page + VideoGrid + CategoryChips)
            └── SI-07.5 (Search results page)
                └── SI-07.6 (Responsive layout pass)
                    └── SI-07.7 (Production Docker Compose)
                        └── SI-07.8 (E2E tests + final documentation)
```

---

## Deliverables

- [ ] `GET /videos?q=` — ILIKE search on title and channel nickname
- [ ] `QueryVideosDto` updated with `q` parameter
- [ ] `next-frontend/components/layout/Header.tsx` — global header
- [ ] `next-frontend/app/page.tsx` — home page
- [ ] `next-frontend/components/home/VideoGrid.tsx`, `CategoryChips.tsx`, `VideoCard.tsx`
- [ ] `next-frontend/app/search/page.tsx` — search results page
- [ ] Responsive layout on all pages (mobile-first Tailwind)
- [ ] `nestjs-project/Dockerfile.prod` + `compose.prod.yaml`
- [ ] `next-frontend/Dockerfile.prod`
- [ ] Tests: unit + integration + E2E passing
- [ ] `npx tsc --noEmit` exits 0; `npm run lint` exits 0
- [ ] README.md: all 7 phases ✅
