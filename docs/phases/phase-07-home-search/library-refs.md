---
kind: library-refs
name: phase-07-home-search
date: 2026-06-29
---

# Library References — Phase 07

## No New Libraries Required

Phase 07 introduces no new npm packages. All capabilities use the existing stack.

| Capability | Library (already installed) | Phase added |
|------------|----------------------------|-------------|
| TypeORM ILIKE query | `typeorm` | Phase 01 |
| Next.js routing + searchParams | `next` 16 | Phase 02 |
| Tailwind responsive breakpoints | `tailwindcss` | Phase 02 |
| shadcn/ui components (chips, skeleton) | `shadcn/ui` | Phase 02 |
| Client-side navigation | `next/navigation` (`useRouter`, `useSearchParams`) | Phase 02 |

## Candidate Libraries (evaluate during implementation)

- `@next/image` — already bundled with Next.js. Use `<Image>` component for video thumbnails on VideoCard for automatic optimization. No separate install needed.
- `react-infinite-scroll-component` — optional alternative to "Load more" button for truly infinite scroll. Not recommended (adds dependency for minimal UX gain). Use the "Load more" button pattern instead.
