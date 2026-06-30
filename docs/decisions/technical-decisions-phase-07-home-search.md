---
scope_type: phase
related_phases: [7]
status: decided
date: 2026-06-29
scope_description: "Home page video grid with category filter, search by title/channel, header/navbar, pagination strategy, responsive layout, and production deployment preparation."
---

# Technical Decisions — Phase 07: Página Inicial, Busca e Finalização

_Subprojects in scope:_

- `nestjs-project/` — enhanced `GET /videos` with full-text search (`q`) and category filter; no new tables.
- `next-frontend/` — home page, header/navbar, search page, responsive layout, pagination/infinite scroll.

---

## TD-01: Search Implementation Strategy

**Scope:** Backend

**Capability:** Barra de busca (pesquisa por título e canal)

**Context:** The home page and search feature need to filter videos by a text query matching title and channel name (nickname). The decision is between PostgreSQL built-in text matching options.

**Options:**

### Option A: PostgreSQL `ILIKE` (case-insensitive pattern matching)
- `WHERE v.title ILIKE '%:q%' OR ch.nickname ILIKE '%:q%'`
- **Pros:** Zero extra infrastructure. No migration. Works immediately with TypeORM. Sufficient for small-to-medium datasets.
- **Cons:** Full table scan (no index used for leading wildcard). Performance degrades at scale (100k+ videos). However, for this MVP scope, performance is acceptable.

### Option B: PostgreSQL `pg_trgm` trigram similarity index
- `CREATE EXTENSION pg_trgm; CREATE INDEX idx_videos_title_trgm ON videos USING GIN (title gin_trgm_ops);`
- Then: `WHERE similarity(title, :q) > 0.3`
- **Pros:** Indexed fuzzy search. Handles typos. Faster at scale.
- **Cons:** Requires enabling the `pg_trgm` extension. More complex query. Trigram threshold tuning needed. Adds migration complexity.

### Option C: PostgreSQL Full-Text Search (`tsvector`)
- `ALTER TABLE videos ADD COLUMN search_vector tsvector; UPDATE SET search_vector = to_tsvector('portuguese', title);`
- **Pros:** Language-aware stemming, stop words. Ranked results (`ts_rank`). Industry standard for document search.
- **Cons:** Requires a `tsvector` column and update trigger. Only matches whole words (no partial). Language configuration needed (Portuguese/English mix is complex). Overkill for title+nickname search.

**Recommendation:** **Option A (`ILIKE`)** — Sufficient for the project's scale and scope. The leading wildcard performance issue is acceptable at this dataset size. Option B can be added later if search becomes a bottleneck.

**Decision:** A — `ILIKE '%:q%'` on `videos.title` and `channels.nickname`

---

## TD-02: Pagination Strategy

**Scope:** Backend + Frontend

**Capability:** Paginação ou scroll infinito nas listagens de vídeos

**Context:** The home page lists videos and needs a pagination mechanism. Two common approaches: offset pagination (page/limit) and cursor-based pagination (after/before ID).

**Options:**

### Option A: Offset pagination (`page` + `limit` query params)
- `SELECT ... LIMIT :limit OFFSET (:page - 1) * :limit`. Already implemented in `GET /videos` since Phase 03.
- Frontend: page number buttons or "Load more" button.
- **Pros:** Already implemented in the API (no backend changes for home page). Simple to understand. Bookmarkable URLs (`?page=2`). Easy to implement "Load more" (append results to existing list).
- **Cons:** Results can shift (new videos inserted between pages). Expensive at deep pages (OFFSET 10000 scans all rows).

### Option B: Cursor-based pagination (keyset pagination)
- `WHERE (view_count, id) < (:lastViewCount, :lastId) ORDER BY view_count DESC, id DESC LIMIT :limit`
- **Pros:** Stable (new inserts don't shift pages). Constant time regardless of page depth.
- **Cons:** Cannot jump to a specific page. Harder to implement on frontend. Requires cursor encoding/decoding. More complex API contract.

**Recommendation:** **Option A (Offset pagination)** — Already implemented. Frontend can use "Load more" (infinite scroll-style) by appending results from successive pages. At this scale, offset limitations are not a concern.

**Decision:** A — Offset pagination (`page` + `limit`); frontend uses "Load more" button for infinite-scroll UX

---

## TD-03: Navigation and Header

**Scope:** Frontend

**Capability:** Header/navbar com logo, barra de busca, botão de login/avatar e navegação

**Context:** Every page needs a consistent header. The header includes the logo, search bar, auth state (login button or user avatar), and navigation links.

**Options:**

### Option A: Shared Next.js `layout.tsx` Header component
- A `Header` Client Component rendered in the root `app/layout.tsx`. Uses `useSession()` (iron-session via BFF) or server-side session to show auth state.
- **Pros:** Standard Next.js App Router pattern. Single source of truth. Appears on all pages automatically.
- **Cons:** If server-side: re-renders on every navigation. Solution: use a mix of server layout + client component for interactive parts.

**Recommendation:** **Option A (Shared layout header)** — Standard Next.js App Router approach. Header includes: logo (links to `/`), search input (`GET /search?q=...`), login button (unauthenticated) / avatar + dropdown (authenticated).

**Decision:** A — Shared `Header` component in root `app/layout.tsx`

---

## TD-04: Responsive Layout Strategy

**Scope:** Frontend

**Capability:** Layout responsivo para dispositivos móveis

**Context:** The platform must work on mobile devices (small screens). Tailwind CSS is already configured. Breakpoints must be defined for the two-column watch page layout and video grid.

**Options:**

### Option A: Tailwind CSS mobile-first responsive breakpoints
- Default styles are mobile. `sm:`, `md:`, `lg:`, `xl:` breakpoints progressively enhance for larger screens.
- Watch page: single column on mobile (`flex-col`) → two columns on `lg:` (`grid grid-cols-3`).
- Home page grid: 1 column mobile → 2 columns `sm:` → 3 columns `md:` → 4 columns `lg:`.
- **Pros:** Tailwind built-in. Zero extra CSS. Consistent with existing `globals.css` design tokens.
- **Cons:** Requires discipline to apply breakpoints consistently.

**Recommendation:** **Option A (Tailwind mobile-first breakpoints)** — The only sensible choice given the existing Tailwind setup.

**Decision:** A — Tailwind CSS mobile-first responsive design
