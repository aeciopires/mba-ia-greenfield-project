---
kind: library-refs
name: phase-06-social
date: 2026-06-29
---

# Library References — Phase 06

## No New Libraries Required

Phase 06 introduces no new npm packages. All social interaction logic uses TypeORM for DB operations, existing NestJS modules, and existing frontend stack.

| Capability | Library (already installed) | Phase added |
|------------|----------------------------|-------------|
| DB upsert / atomic counter | `typeorm` | Phase 01 |
| JWT auth, guards | `@nestjs/jwt`, `@nestjs/passport` | Phase 02 |
| DTO validation | `class-validator`, `class-transformer` | Phase 01 |
| React state (optimistic UI) | React 19 | Phase 02 |
| UI components | `shadcn/ui`, `tailwindcss` | Phase 02 |

## Candidate Libraries (evaluate during implementation)

- `swr` or `@tanstack/react-query` — if real-time comment updates or polling are needed. Evaluate during SI-06.8. Not required for initial implementation.
