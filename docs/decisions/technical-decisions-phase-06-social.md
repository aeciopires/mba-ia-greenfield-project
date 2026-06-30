---
scope_type: phase
related_phases: [6]
status: decided
date: 2026-06-29
scope_description: "Likes and dislikes on videos and comments, threaded comments (single nesting level), channel subscriptions, counter columns, and the corresponding API and frontend."
---

# Technical Decisions — Phase 06: Interações Sociais

_Subprojects in scope:_

- `nestjs-project/` — video likes/dislikes, comments with replies, comment likes, channel subscriptions, counter maintenance.
- `next-frontend/` — like/dislike buttons, comment section, subscription button, followed channels list.

---

## TD-01: Like/Dislike Storage Model

**Scope:** Backend

**Capability:** Like e dislike em vídeos; like e dislike em comentários

**Context:** Users can like or dislike a video (and a comment). A user can only have one vote per item (like OR dislike, not both). The vote can be removed. This requires tracking which user voted and what type of vote they cast.

**Options:**

### Option A: Single table with `type` column (`like | dislike`)
- `video_likes(user_id UUID, video_id UUID, type VARCHAR CHECK(type IN ('like','dislike')), created_at TIMESTAMP)` — PK on `(user_id, video_id)`.
- When a user clicks "like": UPSERT with `type = 'like'`. When clicking "dislike": UPSERT with `type = 'dislike'`. Removing: DELETE row.
- Same pattern for `comment_likes(user_id UUID, comment_id UUID, type VARCHAR, created_at TIMESTAMP)`.
- **Pros:** Single table covers both like and dislike. UPSERT handles switching from like to dislike atomically. Simple FK structure. Easy to query user's current vote.
- **Cons:** `type` is a string check constraint rather than a typed enum (minor).

### Option B: Separate tables for likes and dislikes
- Two tables: `video_likes` and `video_dislikes`, each with `(user_id, video_id)` composite PK.
- **Pros:** Slightly simpler queries for "did user like?".
- **Cons:** Switching from like to dislike requires two operations (INSERT + DELETE in two tables). Does not add meaningful benefit over Option A.

### Option C: Signed integer per user (not stored per-user)
- Store only the total counts (no per-user rows). Anonymous voting.
- **Pros:** No user-vote table.
- **Cons:** Cannot prevent duplicate votes. Cannot show which option the user selected (button state). Contradicts the authenticated-user requirement.

**Recommendation:** **Option A (Single table with `type` column)** — UPSERT handles all transitions in one statement. Clean, normalized, auditable. Used by Reddit and similar platforms.

**Decision:** A — `video_likes(user_id, video_id, type, created_at)` + `comment_likes(user_id, comment_id, type, created_at)`

---

## TD-02: Comment Structure and Nesting Depth

**Scope:** Backend

**Capability:** Comentários em vídeos; respostas a comentários (comentários aninhados)

**Context:** Comments can have replies. The project plan mentions "comentários aninhados" but does not specify depth. A decision on max nesting depth and storage model is required.

**Options:**

### Option A: Flat adjacency list with max depth = 1 (top-level comments + replies)
- `comments(id, video_id, user_id, parent_id nullable FK → comments.id, content, created_at, updated_at)`. Replies reference a top-level comment via `parent_id`. Replies to replies are disallowed — `parent_id` must point to a root comment (`parent_id IS NULL`).
- **Pros:** Simple schema. One JOIN to load a video's comments with their replies. Mirrors YouTube's UX (only one level of nesting). Easy to enforce: validate that `parent.parent_id IS NULL` on insert.
- **Cons:** Cannot support deeper nesting without schema changes.

### Option B: Unlimited adjacency list
- Same schema but replies-to-replies allowed.
- **Pros:** Flexible depth.
- **Cons:** Recursive queries needed (`WITH RECURSIVE`). Rendering deeply nested threads is complex. Project plan only mentions "respostas a comentários" — no indication of deep nesting.

### Option C: Closure table
- Separate `comment_paths(ancestor_id, descendant_id, depth)` for efficient subtree queries.
- **Pros:** Very fast subtree retrieval.
- **Cons:** Significant complexity. Overkill for max depth 1.

**Recommendation:** **Option A (Max depth = 1 adjacency list)** — Covers the project requirement, mirrors industry UX (YouTube), and is trivially efficient. Future phases can increase the depth limit without schema changes.

**Decision:** A — Max depth 1 (comments + replies), adjacency list with `parent_id`

---

## TD-03: Counter Denormalization

**Scope:** Backend

**Capability:** Painel de gerenciamento; contagem de inscritos; likes/dislikes na página de watch

**Context:** Phase 04 decided to use denormalized counter columns on `videos` (TD-05). Phase 06 expands this to channels (subscriber count) and comments (likes/dislikes count). This TD documents the implementation strategy for maintaining these counters.

**Options:**

### Option A: Atomic UPDATE at write time (increment/decrement on each action)
- On `video_like INSERT`: `UPDATE videos SET likes_count = likes_count + 1 WHERE id = ?`. On `DELETE`: `likes_count = likes_count - 1`.
- On `subscription INSERT`: `UPDATE channels SET subscribers_count = subscribers_count + 1`.
- **Pros:** Always current. O(1) query for the count. No background job needed.
- **Cons:** One extra UPDATE per social action (acceptable — these are low-frequency writes compared to reads).

### Option B: Background recalculation job
- Periodically recalculate all counters via COUNT queries and update the columns.
- **Pros:** Simple write path.
- **Cons:** Counts are stale between jobs. Requires scheduling infrastructure. Incorrect counts visible to users.

**Recommendation:** **Option A (Atomic increment/decrement at write time)** — Counters are always current, no infrastructure overhead, and the write frequency is manageable.

**Decision:** A — Atomic `UPDATE ... SET counter = counter ± 1` at write time for all counter columns

---

## TD-04: Channel Subscription Model

**Scope:** Backend

**Capability:** Inscrição em canais; área de canais seguidos; contagem de inscritos

**Context:** Authenticated users can subscribe to (follow) a channel. The platform needs to track subscriptions, count subscribers per channel, and list a user's subscribed channels.

**Options:**

### Option A: `channel_subscriptions(subscriber_id, channel_id, created_at)` table
- Composite PK `(subscriber_id, channel_id)`. FK: `subscriber_id → users.id`, `channel_id → channels.id`. Both FKs ON DELETE CASCADE.
- `POST /channels/:nickname/subscriptions` → INSERT; `DELETE /channels/:nickname/subscriptions` → DELETE.
- `GET /users/me/subscriptions` → JOIN channels with subscriptions for the user.
- `channels.subscribers_count` maintained atomically per TD-03.
- **Pros:** Standard follower/following model. Clean PK prevents duplicates. Cascade delete handles user/channel removal cleanly.
- **Cons:** Adds a join table.

### Option B: Array of channel IDs on the user record
- `users.subscribed_channel_ids UUID[]`.
- **Pros:** No join table.
- **Cons:** PostgreSQL array operations for add/remove are complex. No FK enforcement on array elements. Cannot index efficiently. Cannot store `created_at`. Wrong choice for a relational system.

**Recommendation:** **Option A (`channel_subscriptions` table)** — Correct relational model. Scales well. Allows querying "is this user subscribed?" efficiently with the composite PK.

**Decision:** A — `channel_subscriptions(subscriber_id, channel_id, created_at)` join table
