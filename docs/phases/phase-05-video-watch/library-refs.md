---
kind: library-refs
name: phase-05-video-watch
date: 2026-06-29
---

# Library References — Phase 05

## No New Libraries Required

Phase 05 introduces no new npm packages. The native HTML5 `<video>` element covers all player requirements (TD-01).

| Capability | Library (already installed) | Phase added |
|------------|----------------------------|-------------|
| Video streaming (302 redirect) | Native browser `<video>` + MinIO S3 | Phase 03 |
| Server Component data fetching | Next.js 16 App Router | Phase 02 |
| UI components (sidebar cards) | `shadcn/ui`, `tailwindcss` | Phase 02 |
| API proxy (BFF) | Next.js Route Handlers | Phase 02 |
| TypeORM DB update | `typeorm` | Phase 01 |

## Candidate Libraries (evaluate during implementation)

- `clsx` / `tailwind-merge` — already available via shadcn; use for conditional video player styles
- Custom `useVideoPlayer` hook — implement in-house for play/pause/volume/seek state (no library needed)
