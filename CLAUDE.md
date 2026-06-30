# CLAUDE.md

## Project Overview

StreamTube — a video sharing platform (YouTube-like). Users can upload, manage, and publish videos. Anonymous users can watch freely; social features (comments, subscriptions, likes) require authentication.

More info in the project overview: [docs/project-plan.md](docs/project-plan.md)

## Repository Structure

This is a monorepo with three main areas:

- `nestjs-project/` — Backend API (NestJS 11, TypeScript, Express). Modules: `auth`, `users`, `channels`, `videos`, `categories`, `social` (video likes, comments, comment likes, subscriptions), `storage`, `queue`. Includes a separate FFmpeg video worker (`worker.ts`).
- `next-frontend/` — Frontend (Next.js 16, App Router, React 19, shadcn/ui). BFF pattern: all browser traffic routes through Next.js Route Handlers that proxy to the NestJS API.
- `docs/` — Project documentation, architecture diagrams, planning documents, and technical decisions.

## Architecture (C4 Container Diagram)

See `docs/diagrams/software-arch.mermaid` for the full diagram. Key containers:

- **Frontend** (Next.js) → calls API via BFF Route Handlers, streams video from Object Storage
- **API** (NestJS) → business rules, auth, reads/writes DB, uploads to storage, publishes jobs to queue, sends emails
- **Video Worker** (FFmpeg) → separate NestJS context (no HTTP); consumes BullMQ jobs, processes videos with ffprobe/ffmpeg, uploads thumbnails to MinIO, updates DB
- **Database** (PostgreSQL 17) → users, channels, videos, categories, comments, likes, subscriptions
- **Object Storage** (MinIO, S3-compatible) → video files and thumbnails; clients upload directly via presigned PUT URLs
- **Message Queue** (BullMQ + Redis 7.4) → video processing job queue
- **Email Service** (SMTP via Mailpit locally) → account confirmation and password recovery

## Implemented Features (Phases 01–07)

All backend phases are implemented. Frontend phases 01–02 (auth) and the video/social features are implemented.

### Backend Modules

| Module | Path | Key Responsibility |
|---|---|---|
| `AuthModule` | `src/auth/` | JWT auth, refresh token rotation, email confirm, password reset, rate limiting |
| `UsersModule` | `src/users/` | User entity and service |
| `ChannelsModule` | `src/channels/` | Channel management (1:1 with user), public page, studio endpoint |
| `VideosModule` | `src/videos/` | Video upload (presigned URL), processing, streaming, download, listing, search, publish |
| `CategoriesModule` | `src/categories/` | Video categories (seeded), `GET /categories` |
| `SocialModule` | `src/social/` | Video likes/dislikes, comments (adjacency list, depth 1), comment likes, channel subscriptions |
| `StorageModule` | `src/storage/` | AWS SDK v3 S3Client for MinIO; presigned PUT/GET URLs |
| `QueueModule` | `src/queue/` | BullMQ `video-processing` queue backed by Redis |
| `WorkerModule` | `src/worker.ts` | Separate NestJS context; `VideoProcessingProcessor` runs FFmpeg jobs |

### API Endpoints

**Auth** (`/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Register user, send confirmation email |
| GET | `/auth/confirm-email?token=` | Public | Confirm email address |
| POST | `/auth/resend-confirmation` | Public | Resend confirmation email |
| POST | `/auth/login` | Public | Login, return access + refresh tokens |
| POST | `/auth/refresh` | Public | Rotate refresh token pair |
| POST | `/auth/forgot-password` | Public | Send password reset email |
| POST | `/auth/reset-password` | Public | Reset password with token |
| POST | `/auth/logout` | JWT | Revoke all refresh tokens |
| GET | `/auth/me` | JWT | Return JWT payload |

**Channels** (`/channels`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/channels/:nickname` | Public | Public channel info + subscriber/video count |
| GET | `/channels/:nickname/videos` | Public | Paginated public ready videos for channel |
| PATCH | `/channels/:nickname` | JWT | Update own channel name/description |
| GET | `/channels/:nickname/studio/videos` | JWT (owner) | All channel videos (all statuses) |

**Videos** (`/videos`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/videos` | JWT | Initiate upload: create draft + return presigned PUT URL |
| PATCH | `/videos/:id/start-processing` | JWT (owner) | Enqueue FFmpeg job, status → processing |
| PATCH | `/videos/:id` | JWT (owner) | Update title, description, category, visibility |
| POST | `/videos/:id/thumbnail` | JWT (owner) | Return presigned PUT URL for custom thumbnail |
| PATCH | `/videos/:id/publish` | JWT (owner) | Publish ready video (status must be `ready`) |
| DELETE | `/videos/:id` | JWT (owner) | Delete video and storage objects |
| GET | `/videos` | Public | List public ready videos; supports `q`, `category_id`, `channel_id`, `page`, `limit` |
| GET | `/videos/:slug` | Public | Get video by unique slug |
| POST | `/videos/:slug/views` | Public | Atomically increment view count |
| GET | `/videos/:slug/stream` | Public | 302 redirect to presigned stream URL (Range-aware) |
| GET | `/videos/:slug/download` | Public | 302 redirect to presigned download URL |
| GET | `/videos/:slug/suggestions` | Public | Up to 10 same-category videos ordered by view count |

**Categories** (`/categories`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/categories` | Public | All categories sorted by name |
| POST | `/categories` | JWT | Create category (slug auto-generated from name) |
| GET | `/categories/:id` | Public | Get category by id |
| PATCH | `/categories/:id` | JWT | Update name (slug updated accordingly) |
| DELETE | `/categories/:id` | JWT | Delete category (videos lose category, FK SET NULL) |

**Social — Video Likes** (`/videos`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/videos/:slug/likes` | JWT | Like or dislike; toggle if same type |
| DELETE | `/videos/:slug/likes` | JWT | Remove vote |

**Social — Comments** (`/videos`, `/comments`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/videos/:slug/comments` | Public | Paginated top-level comments with replies |
| POST | `/videos/:slug/comments` | JWT | Create top-level comment |
| POST | `/comments/:id/replies` | JWT | Reply to a comment (max depth 1) |
| DELETE | `/comments/:id` | JWT (owner) | Delete own comment |

**Social — Comment Likes** (`/comments`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/comments/:id/likes` | JWT | Like or dislike a comment |
| DELETE | `/comments/:id/likes` | JWT | Remove comment vote |

**Social — Subscriptions** (`/channels`, `/users`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/channels/:nickname/subscriptions` | JWT | Subscribe to channel |
| DELETE | `/channels/:nickname/subscriptions` | JWT | Unsubscribe from channel |
| GET | `/users/me/subscriptions` | JWT | List subscribed channels |

### Video Upload Flow

1. Client calls `POST /videos` → API creates a `draft` Video record and returns a presigned PUT URL (via `StorageService.generateUploadPresignedUrl`)
2. Client uploads file directly to MinIO via the presigned URL (API never sees the bytes)
3. Client calls `PATCH /videos/:id/start-processing` → API transitions video to `processing` and enqueues a BullMQ job
4. `VideoProcessingProcessor` (in `video-worker` container) picks up the job: runs ffprobe to extract duration and metadata, runs ffmpeg to generate a thumbnail frame, uploads thumbnail to MinIO, updates video to `ready`
5. Streaming: `GET /videos/:slug/stream` → 302 redirect to a presigned GET URL; MinIO handles HTTP Range natively

### Video Status Lifecycle

`draft` → `processing` → `ready` | `error`

- `draft`: created on upload initiation; client may call start-processing only while in draft
- `processing`: FFmpeg job is running
- `ready`: processing succeeded; video is publishable and streamable
- `error`: FFmpeg job failed; `error_message` column contains the reason

## Docker Networking

This project runs entirely in Docker containers. When configuring connections between services (database, cache, queue, etc.), **always use the Docker Compose service name** as the host — never `localhost` or `127.0.0.1`.

Inside a container, `localhost` refers to the container itself, not the host machine or other containers. Services communicate through the Docker Compose network using their service names (e.g., `db`, `nestjs-api`).

- **Correct:** `DB_HOST=db` (the Compose service name)
- **Wrong:** `DB_HOST=localhost`

This applies to all environment variables, configuration files, and code that references service hosts.

## Working Principles

- **Single Responsibility:** each module, service, and function should have a clear, focused responsibility. Re-evaluate adherence at every step — when a module starts owning logic or entities that are not its own (e.g., a service creating an entity from another domain), extract it immediately into the proper module instead of deferring to a later corrective task.
- **Type Safety:** Strict TypeScript usage across all layers.
- **Testing:** Strong emphasis on pyramid testing at all levels to ensure reliability and maintainability.
- **Code Quality:** Use ESLint and Prettier for consistent code style. Code reviews should focus on readability, maintainability, and adherence to best practices.
- **Documentation:** Comprehensive docs for architecture, setup, and troubleshooting in `docs/`.

## Definition of Done (Technical)

A change is only considered complete when **all** of the following pass:

1. The relevant test suite passes (unit + integration + e2e affected by the change).
2. The full test suite passes before finishing the task.
3. TypeScript compiles cleanly: `npx tsc --noEmit` exits with code 0. Compilation errors must never be left as debt for future tasks.
4. Lint passes: `npm run lint`.

If any of these fails, the task is not done — fix the underlying issue before declaring completion.


## Git Conventions

- **Main branch:** `main` — never commit directly to it
- Branches: `feature/*`, `bugfix/*`, `hotfix/*`, `docs/*`
- **Commits:** short, descriptive messages focused on the "why" of the change
- **Workflow:** Git Flow conventions. Two long-lived branches:
  - `main` — stable, production-ready code 
  - `dev` — integration branch; all feature/bugfix/hotfix branches start from `dev` and merge back into `dev`
  - When `dev` is stable, it is merged into `main`

## Testing Policy

Every change must be tested. During development, run only the tests related to the modified code. Before finishing, always run the full test suite to ensure nothing is broken.

## Scope Limits

- Work on **one feature, fix, or refactoring at a time** — do not mix scopes
- Do not include cosmetic changes (formatting, renaming) alongside functional changes
- If something out of scope comes up during work, note it as a separate task instead of acting on it
- Focus on the defined scope for each task to ensure clarity and maintainability of the codebase.
- If you identify a necessary change that is out of scope, create a new issue or task for it instead of including it in the current work.

## Agent Skill Usage

When working on any task (planning, implementing, debugging, refactoring, 
reviewing, etc.), decompose the request into its underlying subtasks and 
concerns, then identify which available skills match any of them and activate 
those skills.

## Library Documentation Lookup

Before implementing any feature, you MUST use the **context7** MCP tool to look up the relevant library APIs and official documentation.

Always:

- Check the installed library version in the project manifest
- Retrieve the corresponding documentation using context7
- Cross-reference APIs to avoid deprecated or incompatible patterns
- Follow the official documentation over training data

Skip documentation lookup only for trivial operations such as:

- Variable declarations
- Basic control flow
- Simple CRUD using established project patterns

If a library is involved and there is uncertainty, documentation lookup is mandatory.
If the documentation returned does not match the installed version, flag the discrepancy before proceeding.