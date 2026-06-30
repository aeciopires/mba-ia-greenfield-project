---
scope_type: phase
related_phases: [5]
status: decided
date: 2026-06-29
scope_description: "Frontend video watch page with HTML5 player, view count tracking, sidebar suggestions, anonymous access, unlisted access via link, and download button."
---

# Technical Decisions — Phase 05: Página de Visualização do Vídeo

_Subprojects in scope:_

- `next-frontend/` — watch page with player, description, sidebar suggestions, download button.
- `nestjs-project/` — view count endpoint and suggestions endpoint.

---

## TD-01: Video Player Technology

**Scope:** Frontend

**Capability:** Player de vídeo com controles: play/pause, volume e barra de progresso

**Context:** The watch page needs a video player. The video files are hosted on MinIO and served via presigned GET URLs (302 redirect from the API). The player must support basic controls and work with standard MP4/WebM files via HTTP Range requests (which MinIO already handles natively).

**Options:**

### Option A: Native HTML5 `<video>` element
- Standard browser `<video>` tag with `src` pointing to the API redirect endpoint (`/videos/:slug/stream`). Browser handles buffering, seeking, and Range requests natively.
- **Pros:** Zero dependencies. Works out of the box with MinIO's 302 redirect + Range support. Full browser native controls or custom CSS overlay. No JavaScript bundle size impact. Accessible by default.
- **Cons:** No HLS/DASH adaptive bitrate. No advanced features (quality switching, DRM). Limited analytics hooks.

### Option B: Video.js (open-source player library)
- Video.js wraps the native `<video>` element with a customizable skin and plugin ecosystem.
- **Pros:** Consistent cross-browser UI. Plugin for analytics, thumbnails, chapters. HLS plugin available.
- **Cons:** ~500KB bundle. Adds a CSS theme to manage. No HLS needed for this project (no transcoding to HLS). Overkill for basic MP4 playback.

### Option C: HLS.js (adaptive bitrate streaming)
- Requires transcoding videos to HLS format (`.m3u8` + `.ts` segments). HLS.js plays the stream in the browser.
- **Pros:** Adaptive bitrate (quality switches based on bandwidth). Better seek performance on large files.
- **Cons:** Requires FFmpeg HLS transcoding in the worker (multiple quality variants). Significant increase in worker complexity and storage cost. Out of scope for this phase (single-quality MP4 already works).

**Recommendation:** **Option A (Native HTML5 `<video>`)** — Zero dependencies, works natively with the presigned URL redirect already implemented in Phase 03. HLS can be added in a future phase if needed.

**Decision:** A (Native HTML5 `<video>` element)

---

## TD-02: View Count Tracking

**Scope:** Backend

**Capability:** Contagem de visualizações

**Context:** When a user watches a video (or loads the watch page), the view count should increment. The two main approaches are a synchronous DB update on each page load vs. an asynchronous/debounced increment.

**Options:**

### Option A: Synchronous DB increment on page load
- `POST /videos/:slug/views` increments `videos.view_count = view_count + 1` atomically with a single `UPDATE` statement. Called by the frontend when the watch page mounts.
- **Pros:** Simple. Accurate (within transaction). No extra infrastructure. Atomic `UPDATE ... SET view_count = view_count + 1` prevents race conditions.
- **Cons:** Every page load = one DB write. At scale, a popular video could saturate the DB with UPDATE locks. However, at this project's scale, this is not a concern.

### Option B: Async via BullMQ job
- The API enqueues a view-count job instead of writing directly. The worker processes the queue and batches updates.
- **Pros:** Decoupled from the request path. Enables batching (e.g., batch 100 views → 1 UPDATE).
- **Cons:** Adds latency (views not visible until processed). Requires BullMQ + worker changes for a very simple operation. Overkill for this project scale.

**Recommendation:** **Option A (Synchronous DB increment)** — Sufficient for the project scale. The atomic `UPDATE` prevents race conditions. Add debouncing on the frontend (only call once per page visit, not on every re-render).

**Decision:** A (Synchronous DB increment via `POST /videos/:slug/views`)

---

## TD-03: Suggestions Algorithm

**Scope:** Backend

**Capability:** Sugestões de vídeos da mesma categoria na sidebar

**Context:** The watch page shows a sidebar with suggested videos. The criteria for suggestions need to be defined.

**Options:**

### Option A: Same category, ordered by view count, exclude current video
- `SELECT * FROM videos WHERE category_id = :categoryId AND status = 'ready' AND visibility = 'public' AND id != :currentId ORDER BY view_count DESC LIMIT 10`
- **Pros:** Simple SQL. Relevant to the current video topic. Popular videos surface first. No ML needed.
- **Cons:** Always the same top-10 for a given category. No personalization.

### Option B: Same channel first, then same category
- Priority: same channel → same category → by view count.
- **Pros:** Promotes channel growth (more channel views per session).
- **Cons:** Slightly more complex query (UNION or ORDER BY CASE). May not be relevant if channel has few videos.

### Option C: ML-based recommendations
- Collaborative filtering or content-based embeddings.
- **Pros:** Highly relevant.
- **Cons:** Requires significant infrastructure (recommendation engine). Out of scope.

**Recommendation:** **Option A (Same category, by view count)** — Simple, deterministic, and relevant. Option B can be implemented in Phase 07 as a refinement.

**Decision:** A (Same category, ordered by view count, exclude current, limit 10)

---

## TD-04: Unlisted Video Access

**Scope:** Backend + Frontend

**Capability:** Vídeos unlisted acessíveis apenas via link direto (sem aparecer em listagens)

**Context:** Unlisted videos (visibility = `unlisted`) should be watchable by anyone with the direct link but must not appear in `GET /videos` (home page), search results, or channel public page.

**Options:**

### Option A: Visibility check per endpoint
- `GET /videos` (list): filter `visibility = 'public'`. `GET /videos/:slug` (detail): allow both `public` and `unlisted` when `status = READY`. `GET /videos/:slug/stream` and `download`: same — allow both visibilities.
- **Pros:** Simple per-endpoint logic. No extra table or flag needed. Unlisted videos are effectively "access by obscurity via slug".
- **Cons:** If the slug leaks (e.g., analytics logs), the video is discoverable. Accepted trade-off — this is the standard YouTube unlisted behavior.

### Option B: Token-based unlisted access
- Unlisted videos require a secret access token appended to the URL (e.g., `/watch/slug?token=xyz`).
- **Pros:** Stronger access control — sharing the slug without the token doesn't grant access.
- **Cons:** Significantly more complex. Breaks the established slug-based routing. Not the standard behavior the project plan describes.

**Recommendation:** **Option A (Visibility check per endpoint)** — Matches industry-standard unlisted behavior (YouTube-style). The slug itself is the "access key".

**Decision:** A (Visibility check per endpoint — `public` in listings, both in direct access)
