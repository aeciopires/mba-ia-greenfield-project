---
kind: phase
name: phase-05-video-watch
sources_mtime:
  docs/phases/phase-05-video-watch/context.md: "2026-06-29T00:00:00-03:00"
---

# Phase 05 — Página de Visualização do Vídeo

## Objective

Deliver the video watch page: native HTML5 player that streams via the existing presigned URL redirect, two-column layout (player + info column, sidebar with suggestions), collapsible description, view count tracking (synchronous DB increment), sidebar suggestions (same category, by view count), download button, anonymous access, and unlisted video accessibility via direct link only.

---

## Step Implementations

### SI-05.1 — Backend: view_count Column + POST /videos/:slug/views Endpoint

**Description:** Add `view_count` to the `videos` table and expose a lightweight endpoint to increment it.

**Technical actions:**

- Create migration `<timestamp>-AddViewCountToVideos` — `ALTER TABLE videos ADD COLUMN view_count integer NOT NULL DEFAULT 0`
- Add `VideosService.incrementViewCount(slug: string): Promise<void>` — `UPDATE videos SET view_count = view_count + 1 WHERE slug = :slug AND status = 'ready'` (atomic, ignores non-existent/non-ready)
- Add `POST /videos/:slug/views` (`@Public()`, `@HttpCode(204)`) to `VideosController` — calls `incrementViewCount`; returns 204 no body

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` (extend) | Unit | `incrementViewCount` issues correct UPDATE; no-op for unknown slug |
| `test/videos.e2e-spec.ts` (extend) | E2E | POST /videos/:slug/views returns 204; view_count increments in DB |

**Dependencies:** Phase 04 complete

**Acceptance criteria:**
- Migration runs without errors; `view_count` appears in `videos` table
- `POST /videos/:slug/views` is idempotent at the HTTP level (always 204, regardless of whether slug exists)

---

### SI-05.2 — Backend: GET /videos/:slug/suggestions Endpoint

**Description:** Add suggestions endpoint returning up to 10 videos from the same category.

**Technical actions:**

- Add `VideosService.getSuggestions(slug: string): Promise<Video[]>` — finds current video by slug; if `category_id` is null, returns 10 most-viewed public+ready videos excluding current; otherwise returns same-category public+ready ordered by `view_count DESC`, limit 10, excluding current slug
- Add `GET /videos/:slug/suggestions` (`@Public()`) to `VideosController` — returns 200 `Video[]`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` (extend) | Unit | Returns up to 10 same-category videos; excludes current; falls back to all public videos when no category |
| `test/videos.e2e-spec.ts` (extend) | E2E | Returns correct suggestions for a published video with category |

**Dependencies:** SI-05.1

**Acceptance criteria:**
- `GET /videos/:slug/suggestions` returns ≤10 videos, never includes the current video

---

### SI-05.3 — Frontend: BFF Route Handlers for Watch Page

**Description:** Create the BFF proxy endpoints for the watch page data.

**Technical actions:**

- Create `next-frontend/app/api/videos/[slug]/views/route.ts` — proxies `POST /videos/:slug/views`
- Create `next-frontend/app/api/videos/[slug]/suggestions/route.ts` — proxies `GET /videos/:slug/suggestions`
- Reuse existing `app/api/videos/[slug]/route.ts` for video detail

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `app/api/videos/[slug]/views/route.integration.test.ts` | Integration (MSW) | Proxies POST correctly; passes through 204 |
| `app/api/videos/[slug]/suggestions/route.integration.test.ts` | Integration (MSW) | Proxies GET; returns suggestion array |

**Dependencies:** SI-05.2

**Acceptance criteria:**
- Both BFF routes forward requests correctly to the NestJS API

---

### SI-05.4 — Frontend: Watch Page Layout + Player Component

**Description:** Implement the `/watch/[slug]` page with the video player and surrounding layout.

**Technical actions:**

- Create `next-frontend/app/watch/[slug]/page.tsx` (Server Component) — fetches `GET /videos/:slug` (via BFF) for metadata; passes data to Client Components; `@Public()` — no auth required; 404 if video not found or not ready; unlisted video loads normally if slug is valid
- Create `next-frontend/components/video/VideoPlayer.tsx` (Client Component) — `<video>` element with `src="/api/videos/${slug}/stream"` (BFF proxies 302 to MinIO); controls: play/pause button, volume slider, progress bar (custom overlay), fullscreen button; keyboard shortcuts (space = play/pause, arrow keys = seek ±5s)
- Create `next-frontend/components/video/VideoInfo.tsx` (Client Component) — title, channel name (link to `/channel/:nickname`), view count, published_at, download button (links to `/api/videos/${slug}/download`), collapsible description (shows 3 lines, expand on click)
- Layout: two-column grid — left column (main) takes ~70% width: player + info; right column: suggestions sidebar

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `components/video/VideoPlayer.test.tsx` | Unit | Renders `<video>` with correct src; play/pause toggle updates state; keyboard shortcut handled |
| `components/video/VideoInfo.test.tsx` | Unit | Displays title, view count; description truncated; expand shows full text; download link present |
| `app/watch/[slug]/page.test.tsx` | Unit | Renders VideoPlayer and VideoInfo with mocked data; 404 for not-found video |

**Dependencies:** SI-05.3

**Acceptance criteria:**
- `/watch/[slug]` page loads and streams video from MinIO via the existing 302 redirect
- Download button triggers download with `content-disposition: attachment`
- Unlisted video loads normally at `/watch/[slug]` when accessed directly

---

### SI-05.5 — Frontend: Suggestions Sidebar + View Count Call

**Description:** Add the suggestions sidebar and trigger the view count increment on mount.

**Technical actions:**

- Create `next-frontend/components/video/SuggestionsSidebar.tsx` (Client Component) — fetches `/api/videos/:slug/suggestions`; renders up to 10 video cards (thumbnail, title, channel name, view count, duration); each card links to `/watch/:targetSlug`
- In `app/watch/[slug]/page.tsx` — call `POST /api/videos/:slug/views` (via `fetch` with no-store cache) on page load using a Client Component `useEffect` (once per mount, not on re-renders)
- Style sidebar as a scrollable list at right column

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `components/video/SuggestionsSidebar.test.tsx` | Unit | Renders suggestion cards with correct links; handles empty state |
| View count call (in page component) | Unit | `useEffect` calls POST once on mount |

**Dependencies:** SI-05.4

**Acceptance criteria:**
- Sidebar shows related videos; each card links to correct watch page
- View count POST called once when page mounts (not on re-renders)

---

### SI-05.6 — Integration + E2E Tests

**Description:** Full integration and E2E coverage for Phase 05 additions.

**Technical actions:**

- E2E (`test/videos.e2e-spec.ts` extend): `GET /videos/:slug/suggestions` returns suggestions for categorized video; `POST /videos/:slug/views` increments count; `GET /videos/:slug` works for unlisted video; unlisted video NOT in `GET /videos`
- Playwright E2E (`tests/watch.e2e-spec.ts`): navigate to `/watch/:slug` → video player renders → view count incremented → download button downloads → suggestion card links work

**Dependencies:** SI-05.5

**Acceptance criteria:**
- All Playwright tests pass; `npm run test:e2e` (backend) all green

---

### SI-05.7 — Documentation Updates

**Technical actions:**

- Update `nestjs-project/CLAUDE.md`: document `POST /videos/:slug/views` and `GET /videos/:slug/suggestions` endpoints; add `view_count` to data model
- Update root `README.md`: update Phase 05 status

**Dependencies:** SI-05.1..SI-05.6

---

## Technical Specifications

### Data Model Changes

**Alteration to `videos`:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| view_count | integer | NOT NULL, DEFAULT 0 | Incremented atomically per view |

### API Contracts

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| POST | /videos/:slug/views | Public | 204 | Increment view count (atomic) |
| GET | /videos/:slug/suggestions | Public | 200 | Up to 10 videos from same category |

### Watch Page Layout

```
┌─────────────────────────────────────────────────┐
│  [Video Player — native HTML5 <video>]           │ 70%
│  ─────────────────────────────────────────────  │
│  Title | Views | Published Date                  │
│  Channel Name                    [Download]      │
│  ─────────────────────────────────────────────  │
│  Description (expandable, 3 lines default)       │
└─────────────────────────────────────────────────┘
┌─────────────────┐
│ Suggestion Card  │ 30%
│ Suggestion Card  │
│ Suggestion Card  │
│ ...              │
└─────────────────┘
```

---

## Dependency Map

```
SI-05.1 (view_count column + POST /views)
└── SI-05.2 (GET /suggestions)
    └── SI-05.3 (BFF Route Handlers)
        └── SI-05.4 (Watch page layout + player)
            └── SI-05.5 (Suggestions sidebar + view count call)
                └── SI-05.6 (Integration + E2E tests)
                    └── SI-05.7 (Documentation)
```

---

## Deliverables

- [ ] Migration AddViewCountToVideos
- [ ] `POST /videos/:slug/views` endpoint (backend)
- [ ] `GET /videos/:slug/suggestions` endpoint (backend)
- [ ] BFF Route Handlers for views and suggestions
- [ ] `next-frontend/app/watch/[slug]/page.tsx` — watch page
- [ ] `VideoPlayer.tsx`, `VideoInfo.tsx`, `SuggestionsSidebar.tsx` components
- [ ] Tests: unit + integration + E2E passing
- [ ] `npx tsc --noEmit` exits 0; `npm run lint` exits 0
