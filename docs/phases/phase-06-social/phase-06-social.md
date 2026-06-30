---
kind: phase
name: phase-06-social
sources_mtime:
  docs/phases/phase-06-social/context.md: "2026-06-29T00:00:00-03:00"
---

# Phase 06 — Interações Sociais (Likes, Comentários, Inscrições)

## Objective

Deliver all social interaction features: like/dislike on videos and comments (single-table UPSERT model), threaded comments with max depth 1 (top-level + replies), like/dislike on comments, channel subscriptions with subscriber count, the subscribed channels list for authenticated users, and all corresponding frontend UI embedded in the watch page and channel page.

---

## Step Implementations

### SI-06.1 — Migration: Social Tables + Counter Columns

**Description:** Create `video_likes`, `comments`, `comment_likes`, `channel_subscriptions` tables and add counter columns to `videos` and `channels`.

**Technical actions:**

- Create migration `<timestamp>-CreateSocialFeatures`:
  - `video_likes(user_id UUID FK→users.id CASCADE, video_id UUID FK→videos.id CASCADE, type VARCHAR(8) CHECK(type IN ('like','dislike')), created_at TIMESTAMP DEFAULT NOW())` — PK `(user_id, video_id)`
  - `comments(id UUID PK default gen_random_uuid(), video_id UUID FK→videos.id CASCADE NOT NULL, user_id UUID FK→users.id CASCADE NOT NULL, parent_id UUID FK→comments.id SET NULL nullable, content TEXT NOT NULL, likes_count INTEGER DEFAULT 0, dislikes_count INTEGER DEFAULT 0, created_at TIMESTAMP, updated_at TIMESTAMP)` — index on `(video_id, parent_id)`
  - `comment_likes(user_id UUID FK→users.id CASCADE, comment_id UUID FK→comments.id CASCADE, type VARCHAR(8) CHECK(type IN ('like','dislike')), created_at TIMESTAMP DEFAULT NOW())` — PK `(user_id, comment_id)`
  - `channel_subscriptions(subscriber_id UUID FK→users.id CASCADE, channel_id UUID FK→channels.id CASCADE, created_at TIMESTAMP DEFAULT NOW())` — PK `(subscriber_id, channel_id)`
  - `ALTER TABLE videos ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0, ADD COLUMN dislikes_count INTEGER NOT NULL DEFAULT 0, ADD COLUMN comments_count INTEGER NOT NULL DEFAULT 0`
  - `ALTER TABLE channels ADD COLUMN subscribers_count INTEGER NOT NULL DEFAULT 0`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/social/social.migration.integration-spec.ts` | Integration | All 4 new tables exist; composite PKs prevent duplicate votes; FK CASCADE deletes; counter columns present |

**Dependencies:** Phase 05 complete

**Acceptance criteria:**
- `npm run migration:run` completes without errors
- Duplicate `(user_id, video_id)` in `video_likes` raises unique violation

---

### SI-06.2 — Video Likes Module (LikesModule — Videos)

**Description:** Create the `VideoLikesModule` handling like/dislike logic for videos.

**Technical actions:**

- Create `src/social/video-likes/video-like.entity.ts` — TypeORM entity for `video_likes`
- Create `src/social/video-likes/video-likes.service.ts`:
  - `upsertVote(userId, videoId, type: 'like'|'dislike')` — UPSERT vote; if same type already exists, DELETE (toggle off); if different type, UPDATE; atomically update `videos.likes_count` and `videos.dislikes_count`
  - `removeVote(userId, videoId)` — DELETE if exists; update counters
  - `getUserVote(userId, videoId)` — returns current vote type or null
- Create `src/social/video-likes/video-likes.controller.ts`:
  - `POST /videos/:slug/likes` body `{ type: 'like'|'dislike' }` (authenticated) — calls `upsertVote`; returns 200 `{ likes_count, dislikes_count, user_vote }`
  - `DELETE /videos/:slug/likes` (authenticated) — calls `removeVote`; returns 200 `{ likes_count, dislikes_count, user_vote: null }`
- `GET /videos/:slug` response should include `likes_count`, `dislikes_count` (already on entity via TD-05)

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/social/video-likes/video-likes.service.spec.ts` | Unit | Like increments count; dislike changes type; same type removes vote; counters updated atomically |
| `test/social.e2e-spec.ts` (new) | E2E | POST like → 200 with correct counts; POST same type → removes vote; DELETE → 200; 401 without auth |

**Dependencies:** SI-06.1

---

### SI-06.3 — Comments Module

**Description:** Create the `CommentsModule` handling CRUD and replies.

**Technical actions:**

- Create `src/social/comments/comment.entity.ts` — TypeORM entity with `parent_id` self-reference
- Create `src/social/comments/comments.service.ts`:
  - `findByVideo(slug, page, limit)` — fetches top-level comments (parent_id IS NULL) with their replies (parent_id = comment.id); ordered by `created_at DESC`; paginated
  - `create(userId, slug, content, parentId?)` — validates parent exists and has no parent itself (depth = 0); saves comment; increments `videos.comments_count` atomically
  - `delete(commentId, userId)` — finds comment by id; validates ownership; soft-deletes (or hard-deletes) replies first then comment; decrements counter
- Create `src/social/comments/comments.controller.ts`:
  - `GET /videos/:slug/comments` (`@Public()`) — paginated comments with nested replies
  - `POST /videos/:slug/comments` (authenticated) — creates top-level comment; body `{ content }`
  - `POST /comments/:id/replies` (authenticated) — creates reply to comment; body `{ content }`
  - `DELETE /comments/:id` (authenticated) — owner or channel owner can delete

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/social/comments/comments.service.spec.ts` | Unit | Create increments counter; delete decrements; reply to reply rejected; owner-only delete |
| `test/social.e2e-spec.ts` (extend) | E2E | Full comment flow: create, reply, list (nested), delete |

**Dependencies:** SI-06.2

---

### SI-06.4 — Comment Likes Module

**Description:** Add like/dislike for comments.

**Technical actions:**

- Create `src/social/comment-likes/comment-likes.service.ts` — same UPSERT pattern as SI-06.2 but for `comment_likes`; updates `comments.likes_count` and `comments.dislikes_count`
- Create `src/social/comment-likes/comment-likes.controller.ts`:
  - `POST /comments/:id/likes` body `{ type }` (authenticated)
  - `DELETE /comments/:id/likes` (authenticated)

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/social/comment-likes/comment-likes.service.spec.ts` | Unit | Same patterns as video-likes |
| `test/social.e2e-spec.ts` (extend) | E2E | Comment like flow |

**Dependencies:** SI-06.3

---

### SI-06.5 — Channel Subscriptions Module

**Description:** Create the `SubscriptionsModule` for channel follow/unfollow.

**Technical actions:**

- Create `src/social/subscriptions/channel-subscription.entity.ts` — entity for `channel_subscriptions`
- Create `src/social/subscriptions/subscriptions.service.ts`:
  - `subscribe(userId, channelNickname)` — finds channel; INSERT subscription; increments `channels.subscribers_count`; throws `AlreadySubscribedException` if already subscribed
  - `unsubscribe(userId, channelNickname)` — DELETE subscription; decrements counter; throws `NotSubscribedException` if not subscribed
  - `isSubscribed(userId, channelId)` — returns boolean
  - `findUserSubscriptions(userId, page, limit)` — returns channels user is subscribed to (JOIN channels)
- Create `src/social/subscriptions/subscriptions.controller.ts`:
  - `POST /channels/:nickname/subscriptions` (authenticated) — subscribe
  - `DELETE /channels/:nickname/subscriptions` (authenticated) — unsubscribe
  - `GET /users/me/subscriptions` (authenticated) — list subscribed channels
- `GET /channels/:nickname` response includes `subscribers_count` and `is_subscribed` (if authenticated)

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/social/subscriptions/subscriptions.service.spec.ts` | Unit | Subscribe increments counter; duplicate throws; unsubscribe decrements; findUserSubscriptions paginates |
| `test/social.e2e-spec.ts` (extend) | E2E | Subscribe → 201; duplicate → 409; unsubscribe → 204; list subscriptions |

**Dependencies:** SI-06.4

---

### SI-06.6 — AppModule: Register SocialModule

**Description:** Register all social sub-modules in a `SocialModule` and add to `AppModule`.

**Technical actions:**

- Create `src/social/social.module.ts` — imports and exports `VideoLikesModule`, `CommentsModule`, `CommentLikesModule`, `SubscriptionsModule`
- Add `SocialModule` to `AppModule.imports`

**Dependencies:** SI-06.5

---

### SI-06.7 — Frontend: Like/Dislike Buttons on Watch Page

**Description:** Add like and dislike buttons to the watch page video info section.

**Technical actions:**

- Create `next-frontend/components/social/LikeDislikeButtons.tsx` (Client Component) — displays `👍 {likes_count}` and `👎 {dislikes_count}` buttons; clicking toggles vote (calls `/api/videos/:slug/likes`); optimistic UI update; shows current user's vote state
- Create BFF Route Handlers: `app/api/videos/[slug]/likes/route.ts` (POST + DELETE)
- Integrate into `VideoInfo.tsx`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `components/social/LikeDislikeButtons.test.tsx` | Unit | Renders counts; click calls correct API; optimistic state update |

**Dependencies:** SI-06.6

---

### SI-06.8 — Frontend: Comment Section on Watch Page

**Description:** Add the comment section below the video player.

**Technical actions:**

- Create `next-frontend/components/social/CommentSection.tsx` (Client Component) — loads comments from `GET /api/videos/:slug/comments`; paginated ("load more" button); shows comment count
- Create `next-frontend/components/social/CommentForm.tsx` (Client Component) — textarea + submit button; requires auth (shows "login to comment" if not authenticated); calls `POST /api/videos/:slug/comments`
- Create `next-frontend/components/social/CommentCard.tsx` — renders comment with author, timestamp, like/dislike buttons, reply count; "Reply" toggles reply form
- Create BFF Route Handlers: `app/api/videos/[slug]/comments/route.ts`, `app/api/comments/[id]/replies/route.ts`, `app/api/comments/[id]/likes/route.ts`
- Integrate `CommentSection` below `VideoInfo` in the watch page

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `components/social/CommentSection.test.tsx` | Unit | Renders comments list; "load more" calls next page; empty state shown |
| `components/social/CommentForm.test.tsx` | Unit | Authenticated: shows form; unauthenticated: shows login prompt |

**Dependencies:** SI-06.7

---

### SI-06.9 — Frontend: Subscribe Button + Followed Channels List

**Description:** Add subscription button to channel page and watch page; add followed channels list to the sidebar/navigation.

**Technical actions:**

- Create `next-frontend/components/social/SubscribeButton.tsx` (Client Component) — shows "Inscrever-se" or "Inscrito" based on `is_subscribed`; requires auth; calls `POST/DELETE /api/channels/:nickname/subscriptions`; shows `subscribers_count`
- Create `next-frontend/app/subscriptions/page.tsx` (authenticated page) — lists channels the user follows; fetches `GET /api/users/me/subscriptions`; each channel card links to `/channel/:nickname`
- Create BFF Route Handlers: `app/api/channels/[nickname]/subscriptions/route.ts`, `app/api/users/me/subscriptions/route.ts`
- Add `SubscribeButton` to the channel public page and watch page channel info section

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `components/social/SubscribeButton.test.tsx` | Unit | Shows correct state; toggles on click; shows count |
| `app/subscriptions/page.test.tsx` | Unit | Renders channel cards; empty state; link to channel page |

**Dependencies:** SI-06.8

---

### SI-06.10 — Integration + E2E Tests + Documentation

**Description:** Full test pass and documentation updates.

**Technical actions:**

- Extend `test/social.e2e-spec.ts` with all remaining flows: comment nesting enforcement, comment like toggle, subscription duplicate rejection, subscriber count accuracy
- Update `nestjs-project/CLAUDE.md`: add `social/` module tree; document all 12 new endpoints; add social table schema
- Update root `README.md`: Phase 06 status; update social interaction workflow

**Dependencies:** SI-06.9

**Acceptance criteria:**
- `npm test -- --runInBand` all green; `npm run test:e2e` all green; `tsc --noEmit` exits 0; lint exits 0

---

## Technical Specifications

### New Tables

| Table | PK | Key FKs | Purpose |
|-------|----|---------|---------|
| `video_likes` | (user_id, video_id) | users.id CASCADE, videos.id CASCADE | Like/dislike on videos |
| `comments` | id (UUID) | videos.id CASCADE, users.id CASCADE, comments.id (self) | Video comments and replies |
| `comment_likes` | (user_id, comment_id) | users.id CASCADE, comments.id CASCADE | Like/dislike on comments |
| `channel_subscriptions` | (subscriber_id, channel_id) | users.id CASCADE, channels.id CASCADE | Channel subscriptions |

### Counter Columns Added

| Table | New Columns |
|-------|------------|
| `videos` | `likes_count INTEGER DEFAULT 0`, `dislikes_count INTEGER DEFAULT 0`, `comments_count INTEGER DEFAULT 0` |
| `channels` | `subscribers_count INTEGER DEFAULT 0` |

### API Contracts

| Method | Path | Auth | Status | Description |
|--------|------|------|--------|-------------|
| POST | /videos/:slug/likes | Bearer JWT | 200 | Like or dislike video (toggle if same type) |
| DELETE | /videos/:slug/likes | Bearer JWT | 200 | Remove vote from video |
| GET | /videos/:slug/comments | Public | 200 | Paginated comments with replies |
| POST | /videos/:slug/comments | Bearer JWT | 201 | Create top-level comment |
| POST | /comments/:id/replies | Bearer JWT | 201 | Reply to a comment (max depth 1) |
| DELETE | /comments/:id | Bearer JWT | 204 | Delete own comment |
| POST | /comments/:id/likes | Bearer JWT | 200 | Like or dislike comment |
| DELETE | /comments/:id/likes | Bearer JWT | 200 | Remove vote from comment |
| POST | /channels/:nickname/subscriptions | Bearer JWT | 201 | Subscribe to channel |
| DELETE | /channels/:nickname/subscriptions | Bearer JWT | 204 | Unsubscribe from channel |
| GET | /users/me/subscriptions | Bearer JWT | 200 | List subscribed channels |

### Error Catalog Additions

| Code | HTTP | Trigger |
|------|------|---------|
| `COMMENT_NOT_FOUND` | 404 | Comment ID does not exist |
| `COMMENT_NESTING_NOT_ALLOWED` | 422 | Reply to a reply attempted |
| `ALREADY_SUBSCRIBED` | 409 | User already subscribed to channel |
| `NOT_SUBSCRIBED` | 409 | User not subscribed (on unsubscribe) |

---

## Dependency Map

```
SI-06.1 (Migration: social tables + counter columns)
└── SI-06.2 (VideoLikesModule)
    └── SI-06.3 (CommentsModule)
        └── SI-06.4 (CommentLikesModule)
            └── SI-06.5 (SubscriptionsModule)
                └── SI-06.6 (SocialModule + AppModule registration)
                    ├── SI-06.7 (Frontend: Like/Dislike buttons)
                    │   └── SI-06.8 (Frontend: Comment section)
                    │       └── SI-06.9 (Frontend: Subscribe button + subscriptions page)
                    │           └── SI-06.10 (Tests + Documentation)
```

---

## Deliverables

- [ ] Migration CreateSocialFeatures (4 new tables + 5 counter columns)
- [ ] `src/social/video-likes/` — entity, service, controller
- [ ] `src/social/comments/` — entity, service, controller
- [ ] `src/social/comment-likes/` — entity, service, controller
- [ ] `src/social/subscriptions/` — entity, service, controller
- [ ] `src/social/social.module.ts`
- [ ] Frontend: `LikeDislikeButtons`, `CommentSection`, `CommentForm`, `CommentCard`, `SubscribeButton`
- [ ] Frontend: `/subscriptions` page + all BFF Route Handlers
- [ ] `test/social.e2e-spec.ts`
- [ ] Tests: unit + integration + E2E passing
- [ ] `npx tsc --noEmit` exits 0; `npm run lint` exits 0
