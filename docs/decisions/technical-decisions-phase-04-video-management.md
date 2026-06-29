---
scope_type: phase
related_phases: [4]
status: decided
date: 2026-06-29
scope_description: "Backend and frontend for video metadata editing, custom thumbnail upload, visibility model (public/unlisted), draft→publish flow, channel admin panel, and public channel page."
---

# Technical Decisions — Phase 04: Gerenciamento de Vídeos e Canal

_Subprojects in scope:_

- `nestjs-project/` — new API endpoints for category listing, video editing, thumbnail upload, publish flow, channel admin panel, public channel page, and channel settings.
- `next-frontend/` — Studio pages (video management), public channel page, video edit form.

---

## TD-01: Category Storage Strategy

**Scope:** Backend

**Capability:** Categorias de vídeo disponíveis na plataforma; edição das informações do vídeo: título, descrição, categoria e thumbnail customizada

**Context:** Videos need to belong to a category for filtering and suggestions in later phases. Two approaches exist: a fixed enum list in the TypeORM entity, or a separate `categories` table with a FK from `videos`.

**Options:**

### Option A: Separate `categories` DB table with FK from `videos`
- `Category` entity with `id`, `name`, `slug` fields. `Video.category_id` FK → `categories.id`. API exposes `GET /categories` (public) and optionally a seed script to pre-populate.
- **Pros:** Dynamic — new categories can be added without a migration. Easy to seed initial data. Enables category-level stats (video count per category). `GET /categories` endpoint is trivial to implement and cache. Required by Phase 07 filter.
- **Cons:** Adds one JOIN on video queries. Requires a seed migration for initial categories.

### Option B: PostgreSQL enum on the `videos` table
- A `VideoCategory` enum type in TypeORM with values pre-defined (e.g., `technology`, `music`, `gaming`).
- **Pros:** No JOIN needed. Schema is self-documenting.
- **Cons:** Adding a new category requires a migration. No `GET /categories` endpoint possible without hard-coding the list. Breaks the DRY principle between DB and frontend. Less flexible.

**Recommendation:** **Option A (Separate `categories` table)** — Enables dynamic management, clean `GET /categories` endpoint, and a FK reference that is required by Phase 07 filtering. Seed the initial category set in a dedicated seeder.

**Decision:** A (Separate `categories` table with FK from `videos`)

---

## TD-02: Custom Thumbnail Upload Strategy

**Scope:** Backend

**Capability:** Edição das informações do vídeo: thumbnail customizada

**Context:** After a video is published, the owner may want to replace the auto-generated thumbnail with a custom image. Two strategies: presigned PUT URL (client uploads directly to MinIO) or multipart POST through the API.

**Options:**

### Option A: Presigned PUT URL (same pattern as video upload)
- `POST /videos/:id/thumbnail` returns a presigned PUT URL for the thumbnail object key. The client uploads the image directly to MinIO, then calls `PATCH /videos/:id` with `thumbnail_key` or a webhook/polling to confirm.
- **Pros:** Consistent with the Phase 03 upload pattern. No bytes pass through the API. MinIO handles the upload. Reuses `StorageService.generateUploadPresignedUrl`.
- **Cons:** Two-step flow (get URL → upload). Client must implement the same pattern as video upload.

### Option B: Multipart POST to the API
- Client POSTs the thumbnail file as `multipart/form-data` to the API. API pipes it to MinIO via `StorageService.putObject`.
- **Pros:** Single step for the client. Server can validate image dimensions and MIME type before upload.
- **Cons:** Thumbnail images are small (typically <500KB) so passing through the API is acceptable, but it breaks the architectural pattern established in Phase 03. Adds streaming complexity. Sets a different precedent.

**Recommendation:** **Option A (Presigned PUT URL)** — Stays consistent with Phase 03's storage pattern, keeps the API stateless, and reuses existing infrastructure.

**Decision:** A (Presigned PUT URL for custom thumbnail)

**Libraries:** (no new libraries — reuses `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` from Phase 03)

---

## TD-03: Video Visibility Model

**Scope:** Backend + Frontend

**Capability:** Visibilidade do vídeo: público (aparece para todos) ou unlisted (somente via link)

**Context:** Videos need two visibility states: `public` (appears in listings, home page, search) and `unlisted` (accessible only via direct link). This decision covers how visibility is stored and enforced.

**Options:**

### Option A: Enum column on `videos` table (`visibility: public | unlisted`)
- Add `visibility` column to `videos` with PostgreSQL enum `video_visibility_enum`. Default: `unlisted`. Published videos may be either `public` or `unlisted` (owner's choice at publish time).
- **Pros:** Explicit, queryable, indexable. Clean semantic distinction. Easy to extend (e.g., `private` in the future). Listing endpoints filter by `visibility = 'public'` when public-facing.
- **Cons:** Adds one column and migration.

### Option B: Boolean `is_public` column
- A simple boolean column.
- **Pros:** Simpler schema.
- **Cons:** Less expressive; adding a third state (e.g., `members_only`) requires a migration and breaks boolean semantics. Less readable in queries.

**Recommendation:** **Option A (Enum column)** — Explicit, extensible, readable. Consistent with `VideoStatus` enum from Phase 03.

**Decision:** A (Enum column `visibility: public | unlisted`)

---

## TD-04: Draft → Publish Flow

**Scope:** Backend

**Capability:** Fluxo de rascunho → publicação

**Context:** After a video reaches `status = ready`, the owner can "publish" it — making it appear in public listings. This requires a dedicated action (not just PATCH) to avoid accidental publishing.

**Options:**

### Option A: Dedicated `PATCH /videos/:id/publish` endpoint
- A focused endpoint that sets `visibility = 'public'` and `published_at = NOW()`. Cannot be undone by the same endpoint (requires a separate `unpublish`).
- **Pros:** Explicit intent. Mirrors the Phase 03 `start-processing` pattern. Easy to guard with validation (`status` must be `ready`). Auditable (`published_at` timestamp).
- **Cons:** Adds one endpoint.

### Option B: Allow `PATCH /videos/:id` to set `visibility` directly
- The general update endpoint accepts `visibility` as a patchable field. Publishing = setting `visibility = 'public'`.
- **Pros:** Fewer endpoints.
- **Cons:** Publishing is an intentional, non-reversible action (in most video platforms). Mixing it with routine metadata edits risks accidental publishing. No `published_at` tracking without extra logic.

**Recommendation:** **Option A (Dedicated publish endpoint)** — Publishing is a meaningful state transition, not just a field update. Mirrors Phase 03's `start-processing` pattern.

**Decision:** A (Dedicated `PATCH /videos/:id/publish` endpoint)

---

## TD-05: Channel Admin Panel Stats (View Count, Likes, Comments)

**Scope:** Backend

**Capability:** Painel de gerenciamento de vídeos do canal (thumbnail, título, visualizações, likes, comentários, tempo de publicação e status)

**Context:** The channel admin panel must show per-video stats: view count, like count, comment count. These can be computed on-the-fly (JOINs) or stored as denormalized counter columns on `videos`.

**Options:**

### Option A: Denormalized counter columns on `videos` (`view_count`, `likes_count`, `dislikes_count`, `comments_count`)
- Increment/decrement counters atomically when the action occurs. Phase 05 adds `view_count`; Phase 06 adds `likes_count`, `dislikes_count`, `comments_count`.
- **Pros:** O(1) reads. No JOINs on listing queries. Works well for high-traffic reads. Simple admin panel query.
- **Cons:** Counter can drift from truth if updates fail. Requires atomic UPDATE with `SET view_count = view_count + 1`.

### Option B: Computed on-the-fly (COUNT JOINs)
- `SELECT v.*, COUNT(vl.id) AS likes_count, COUNT(c.id) AS comments_count FROM videos v LEFT JOIN video_likes...`
- **Pros:** Always accurate. No counter management.
- **Cons:** Expensive for large datasets. N+1 risk in lists. Performance degrades with scale.

**Recommendation:** **Option A (Denormalized counters)** — For a video platform with potentially many reads per second, computed counts are too expensive. Counters with atomic increments/decrements are the industry standard (YouTube, Vimeo).

**Decision:** A (Denormalized counter columns — `view_count`, `likes_count`, `dislikes_count`, `comments_count` added across phases)
