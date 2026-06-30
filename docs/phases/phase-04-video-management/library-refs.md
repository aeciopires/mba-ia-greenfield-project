---
kind: library-refs
name: phase-04-video-management
date: 2026-06-29
---

# Library References — Phase 04

## No New Libraries

Phase 04 introduces no new npm packages. All required capabilities are covered by libraries already installed in Phase 01–03:

| Capability | Library (already installed) | Phase added |
|------------|----------------------------|-------------|
| S3 presigned URLs for thumbnail | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | Phase 03 |
| TypeORM entity + FK + enum | `typeorm` | Phase 01 |
| JWT auth, guards | `@nestjs/jwt`, `@nestjs/passport` | Phase 02 |
| DTO validation | `class-validator`, `class-transformer` | Phase 01 |
| Config namespaces | `@nestjs/config`, `joi` | Phase 01 |

## Frontend — No New Libraries

| Capability | Library (already installed) | Phase added |
|------------|----------------------------|-------------|
| Form handling | `react-hook-form`, `zod` | Phase 02 |
| API typing | `openapi-fetch` | Phase 02 |
| UI components | `shadcn/ui`, `tailwindcss` | Phase 02 |

## Candidate Libraries (if needed during implementation)

- `@tanstack/react-table` — for the admin panel video table with sorting/pagination (optional; evaluate during implementation)
