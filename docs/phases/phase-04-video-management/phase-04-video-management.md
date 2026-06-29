---
kind: phase
name: phase-04-video-management
sources_mtime:
  docs/phases/phase-04-video-management/context.md: "2026-06-29T00:00:00-03:00"
---

# Phase 04 — Gerenciamento de Vídeos e Canal

## Objective

Deliver complete video metadata management and the channel administration layer: categories table and listing endpoint, video editing (title, description, category, custom thumbnail via presigned URL), visibility model (public/unlisted), dedicated publish flow, channel admin panel showing per-video stats, channel settings editing, and a public channel page listing published videos.

---

## Step Implementations

### SI-04.1 — Migration + Category Entity + Seed

**Description:** Create the `categories` table, `Category` TypeORM entity, seed the initial category set, and add `category_id`, `visibility`, and `published_at` columns to the `videos` table.

**Technical actions:**

- Create `src/categories/entities/category.entity.ts` — `@Entity('categories')` with `id` (int, PK autoincrement), `name` (varchar(100), not null), `slug` (varchar(100), unique, not null)
- Create migration `<timestamp>-CreateCategories` — creates `categories` table and adds to `videos`: `category_id` (int, FK → categories.id, nullable, ON DELETE SET NULL), `visibility` (enum `video_visibility_enum: public | unlisted`, default `unlisted`), `published_at` (timestamp with time zone, nullable)
- Create `src/database/seeds/categories.seed.ts` — inserts initial categories: `technology`, `music`, `gaming`, `sports`, `education`, `entertainment`, `science`, `lifestyle`, `news`, `other`
- Add `npm run seed:categories` script that runs the categories seed

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/categories/entities/category.entity.integration-spec.ts` | Integration | Slug unique constraint; FK from videos (SET NULL on category delete); all enum values accepted |
| `src/database/migrations.integration-spec.ts` (update) | Integration | New migration in list; `categories` table and new `videos` columns present after run |

**Dependencies:** Phase 03 complete (videos entity must exist)

**Acceptance criteria:**
- `npm run migration:run` creates `categories` and alters `videos` without errors
- Seed inserts 10 categories; re-running is idempotent (ON CONFLICT DO NOTHING)

---

### SI-04.2 — CategoriesModule + CategoriesService + CategoriesController

**Description:** Create the `CategoriesModule` with a simple `GET /categories` public endpoint listing all categories.

**Technical actions:**

- Create `src/categories/categories.module.ts`, `categories.service.ts`, `categories.controller.ts`
- `CategoriesService.findAll()` — `repository.find({ order: { name: 'ASC' } })`
- `GET /categories` (`@Public()`) — returns `Category[]` with 200
- Add `CategoriesModule` to `AppModule` imports

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/categories/categories.service.spec.ts` | Unit | `findAll` returns categories ordered by name |
| `src/categories/categories.controller.spec.ts` | Unit | GET returns 200 with list |

**Dependencies:** SI-04.1

**Acceptance criteria:**
- `GET /categories` returns seeded list with 200

---

### SI-04.3 — VideosService: Edit, Thumbnail, Publish

**Description:** Extend `VideosService` with edit, custom thumbnail presigned URL, and publish methods.

**Technical actions:**

- Create `src/videos/dto/update-video.dto.ts` — optional fields: `title` (`@MaxLength(255)`), `description`, `category_id` (`@IsInt @IsOptional`); inherits from `PartialType(CreateVideoDto)` minus `content_type`
- Add to `src/common/exceptions/domain.exception.ts`: `VideoNotReadyException` (409, `VIDEO_NOT_READY` — for publish when status ≠ ready), `CategoryNotFoundException` (404, `CATEGORY_NOT_FOUND`)
- Add `VideosService.updateVideo(videoId, channelId, dto)` — finds video by `id + channel_id`; validates `category_id` exists if provided (`CategoryRepository.findOneBy`); patches allowed fields; saves
- Add `VideosService.getThumbnailUploadUrl(videoId, channelId, contentType)` — finds video; derives thumbnail key `channels/${channelId}/videos/${slug}/thumbnail-custom.jpg`; returns presigned PUT URL
- Add `VideosService.publishVideo(videoId, channelId)` — finds video; validates `status = READY`; sets `visibility = 'public'`, `published_at = new Date()`; saves

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` (extend) | Unit | `updateVideo`: patches fields, validates category, throws for unknown video; `getThumbnailUploadUrl`: derives correct key, calls presigned service; `publishVideo`: sets visibility+published_at, throws `VideoNotReadyException` for non-ready status |

**Dependencies:** SI-04.2

**Acceptance criteria:**
- Unit tests pass; `tsc --noEmit` exits 0

---

### SI-04.4 — VideosController: Edit, Thumbnail, Publish Endpoints

**Description:** Add 3 new endpoints to `VideosController`.

**Technical actions:**

- `PATCH /videos/:id` — authenticated; resolves channel; calls `videosService.updateVideo`; returns 200 updated video
- `POST /videos/:id/thumbnail` (body: `{ content_type: string }`) — authenticated; resolves channel; calls `videosService.getThumbnailUploadUrl`; returns 200 `{ presigned_thumbnail_url }`
- `PATCH /videos/:id/publish` — authenticated; resolves channel; calls `videosService.publishVideo`; returns 200 updated video

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.controller.spec.ts` (extend) | Unit | Each endpoint routes to correct service method with correct args |

**Dependencies:** SI-04.3

**Acceptance criteria:**
- All 3 endpoints documented in Swagger

---

### SI-04.5 — `GET /videos` Filter: Public Only + Category Filter

**Description:** Update `findAll` to return only `visibility = 'public'` videos (in addition to `status = READY`), and support `?category_id=` query param.

**Technical actions:**

- Update `src/videos/dto/query-videos.dto.ts` — add optional `category_id` (`@IsInt @IsOptional @Type(() => Number)`)
- Update `VideosService.findAll` — WHERE: `status = READY AND visibility = 'public'`; add `category_id` filter when provided
- Update `GET /videos/:slug` (public) — already requires `status = READY`; also require `visibility = 'public' OR (visibility = 'unlisted' AND channel is owner)`; for public access: `status = READY` is sufficient (unlisted accessible via link)

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` (extend) | Unit | `findAll` only returns public+ready videos; category filter narrows results; unlisted video not in list |

**Dependencies:** SI-04.4

**Acceptance criteria:**
- Unlisted `READY` video NOT returned by `GET /videos` but IS accessible via `GET /videos/:slug`

---

### SI-04.6 — ChannelsModule: Edit Channel + Public Page + Admin Panel

**Description:** Add channel settings editing, public channel page, and admin panel (own video listing) endpoints.

**Technical actions:**

- Create `src/channels/dto/update-channel.dto.ts` — optional `name` (`@MaxLength(100)`), `description` (`@IsString @IsOptional`)
- Add `ChannelsService.updateChannel(userId, dto)` — finds channel by `user_id`; patches `name` and/or `description`; saves; throws on duplicate nickname if nickname is patchable (keep nickname immutable in this phase)
- Add `ChannelsService.findPublicByNickname(nickname)` — finds by `nickname`; throws `ChannelNotFoundException` if not found; returns channel + count of public videos
- Add `ChannelsService.findOwnVideos(userId, query)` — finds videos for user's channel (all statuses, all visibilities); pagination
- Add `src/common/exceptions/domain.exception.ts`: `ChannelNotFoundException` (404, `CHANNEL_NOT_FOUND`)
- Add to `ChannelsController`:
  - `GET /channels/:nickname` (`@Public()`) — calls `findPublicByNickname`; returns channel info + video_count
  - `GET /channels/:nickname/videos` (`@Public()`) — lists public READY videos for that channel; pagination
  - `PATCH /channels/me` (authenticated) — calls `updateChannel`
  - `GET /channels/me/videos` (authenticated) — calls `findOwnVideos`; returns all videos (all statuses) with stats

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/channels/channels.service.spec.ts` (extend) | Unit | `updateChannel` patches, throws for not-found; `findPublicByNickname` throws 404; `findOwnVideos` returns all statuses |
| `src/channels/channels.controller.spec.ts` (extend) | Unit | Route → service mapping for all 4 new endpoints |

**Dependencies:** SI-04.3

**Acceptance criteria:**
- `GET /channels/:nickname` returns channel info
- `GET /channels/me/videos` requires auth and returns own videos across all statuses

---

### SI-04.7 — Frontend: Studio (Admin Panel) Pages

**Description:** Implement the channel admin panel in Next.js — video listing with stats and edit form.

**Technical actions:**

- Create `next-frontend/app/studio/page.tsx` — redirects to `/studio/videos`
- Create `next-frontend/app/studio/videos/page.tsx` — protected page (redirect to login if not authenticated); fetches `GET /channels/me/videos` via BFF Route Handler; renders table with columns: thumbnail, title, status, visibility, views, likes, comments, published_at, actions (edit/delete)
- Create `next-frontend/app/studio/videos/[id]/edit/page.tsx` — loads video; form with title, description, category select, visibility radio, thumbnail upload; submits `PATCH /videos/:id`; thumbnail upload uses `POST /videos/:id/thumbnail` presigned URL flow
- Create BFF Route Handlers: `app/api/channels/me/videos/route.ts`, `app/api/videos/[id]/route.ts` (PATCH), `app/api/videos/[id]/thumbnail/route.ts` (POST), `app/api/videos/[id]/publish/route.ts` (PATCH)
- Create `next-frontend/app/studio/layout.tsx` — studio sidebar navigation

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `components/studio/video-table.test.tsx` | Unit | Renders video rows with correct stats; edit link points to correct URL |
| `app/api/channels/me/videos/route.integration.test.ts` | Integration (MSW) | BFF proxies GET correctly; handles 401 → redirect |

**Dependencies:** SI-04.6

**Acceptance criteria:**
- Studio page accessible at `/studio/videos` only when authenticated
- Edit form saves changes and reflects in the table

---

### SI-04.8 — Frontend: Public Channel Page

**Description:** Implement the public channel page at `/channel/[nickname]`.

**Technical actions:**

- Create `next-frontend/app/channel/[nickname]/page.tsx` — Server Component; fetches `GET /channels/:nickname` and `GET /channels/:nickname/videos`; renders channel banner (name, description, video count), grid of public videos
- Create BFF Route Handlers: `app/api/channels/[nickname]/route.ts`, `app/api/channels/[nickname]/videos/route.ts`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `app/channel/[nickname]/page.test.tsx` | Unit | Renders channel name and videos; shows empty state when no videos |

**Dependencies:** SI-04.6

**Acceptance criteria:**
- `/channel/streamtubeuser` renders correctly for a channel with public videos

---

### SI-04.9 — Integration + E2E Tests

**Description:** Cover the new flows with integration and E2E tests.

**Technical actions:**

- Integration: `src/videos/videos.service.integration-spec.ts` — test `updateVideo`, `publishVideo`, `getThumbnailUploadUrl` against real DB
- E2E (`test/videos.e2e-spec.ts` extend): `PATCH /videos/:id` edits video; `PATCH /videos/:id/publish` publishes; published video appears in `GET /videos`; unlisted video not in list but accessible by slug; `GET /channels/:nickname` returns channel info; `GET /channels/me/videos` requires auth

**Dependencies:** SI-04.4, SI-04.6

**Acceptance criteria:**
- `npm run test:e2e` passes all new scenarios with no regressions

---

### SI-04.10 — CLAUDE.md + README Updates

**Description:** Update documentation to reflect Phase 04 additions.

**Technical actions:**

- Update `nestjs-project/CLAUDE.md`: add `categories/` module; document new video endpoints (edit, thumbnail, publish); document channel endpoints; add `videos.visibility` and `published_at` to data model section
- Update root `README.md`: update Phase 04 status; add channel page and studio to tutorial

**Dependencies:** SI-04.1..SI-04.9

**Acceptance criteria:**
- CLAUDE.md reflects all new modules and endpoints

---

## Technical Specifications

### Data Model Changes

**New table: `categories`**

| Column | Type | Constraints |
|--------|------|-------------|
| id | integer | PK, autoincrement |
| name | varchar(100) | NOT NULL |
| slug | varchar(100) | UNIQUE, NOT NULL |

**Alterations to `videos`:**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| category_id | integer | FK → categories.id, ON DELETE SET NULL, nullable | null = uncategorized |
| visibility | enum(public, unlisted) | NOT NULL, default `unlisted` | |
| published_at | timestamp with time zone | nullable | set when publish endpoint is called |

### API Contracts

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| GET | /categories | Public | 200 | List all categories |
| PATCH | /videos/:id | Bearer JWT | 200 | Edit video metadata |
| POST | /videos/:id/thumbnail | Bearer JWT | 200 | Get presigned URL for custom thumbnail |
| PATCH | /videos/:id/publish | Bearer JWT | 200 | Publish video (sets visibility=public) |
| GET | /channels/:nickname | Public | 200 | Public channel page data |
| GET | /channels/:nickname/videos | Public | 200 | Public videos of a channel |
| PATCH | /channels/me | Bearer JWT | 200 | Edit own channel info |
| GET | /channels/me/videos | Bearer JWT | 200 | Own videos (admin panel, all statuses) |

### Error Catalog Additions

| Code | HTTP | Trigger |
|------|------|---------|
| `CATEGORY_NOT_FOUND` | 404 | `category_id` provided does not exist |
| `VIDEO_NOT_READY` | 409 | Publish called on video with status ≠ `ready` |
| `CHANNEL_NOT_FOUND` | 404 | Channel with given nickname not found |

### Authorization Matrix

| Endpoint | Auth | Notes |
|----------|------|-------|
| GET /categories | Public | Always accessible |
| PATCH /videos/:id | Bearer JWT | Video must belong to user's channel |
| POST /videos/:id/thumbnail | Bearer JWT | Video must belong to user's channel |
| PATCH /videos/:id/publish | Bearer JWT | Video status must be `ready` |
| GET /channels/:nickname | Public | Shows only public info |
| GET /channels/:nickname/videos | Public | Shows only `public + ready` videos |
| PATCH /channels/me | Bearer JWT | Edits own channel |
| GET /channels/me/videos | Bearer JWT | Returns all statuses/visibilities for owner |

---

## Dependency Map

```
SI-04.1 (Migration + Category entity + seed)
└── SI-04.2 (CategoriesModule + GET /categories)
    └── SI-04.3 (VideosService: edit, thumbnail, publish)
        ├── SI-04.4 (VideosController: 3 new endpoints)
        │   └── SI-04.5 (GET /videos filter update)
        └── SI-04.6 (ChannelsModule: edit + public page + admin panel)
            ├── SI-04.7 (Frontend: Studio pages)
            ├── SI-04.8 (Frontend: Public channel page)
            └── SI-04.9 (Integration + E2E tests)
                └── SI-04.10 (CLAUDE.md + README updates)
```

---

## Deliverables

- [ ] `docs/decisions/technical-decisions-phase-04-video-management.md` — TD-01..TD-05 decided
- [ ] `docs/phases/phase-04-video-management/` — all 5 planning files
- [ ] `nestjs-project/src/categories/` — Category entity, module, service, controller
- [ ] Migration CreateCategories + video column alterations
- [ ] `nestjs-project/src/database/seeds/categories.seed.ts`
- [ ] `nestjs-project/src/videos/` — UpdateVideoDto, 3 new service methods, 3 new controller endpoints
- [ ] `nestjs-project/src/channels/` — UpdateChannelDto, 4 new service methods, 4 new controller endpoints
- [ ] `next-frontend/app/studio/` — Studio layout + videos list + edit form
- [ ] `next-frontend/app/channel/[nickname]/` — Public channel page
- [ ] BFF Route Handlers for all new API calls
- [ ] Tests: unit + integration + E2E passing
- [ ] `npx tsc --noEmit` exits 0; `npm run lint` exits 0
