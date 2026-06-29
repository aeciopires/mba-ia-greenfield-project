---
kind: plan-validation
status: clean
issue_count: 0
date: 2026-06-29
---

# phase-07-home-search — Validation

## Scope Issues

_No issues._

## Decision Gaps

_No issues._ All 4 TDs decided. `GET /videos` already supports `page`, `limit`, `category_id` from Phase 03/04 — only `q` is new.

## Dependency Issues

_No issues._ Final phase; all prior phases (01–06) must be complete. `CategoryChips` depends on `GET /api/categories` from Phase 04. `view_count` column from Phase 05.

## API Contract Issues

_No issues._ `q` is an optional query param — backward compatible. Adding `ORDER BY view_count DESC` as default ordering changes the sort but is acceptable (previously unspecified).

## Frontend Issues

_No issues._ Home page and search page are Server Components for initial SSR. `VideoGrid` and `CategoryChips` are Client Components for interactivity. `Header` uses `useSearchParams` (Client Component) for pre-filling the search input.

## Responsive Issues

_No issues._ SI-07.6 is a dedicated responsive audit step. Tailwind CSS is already installed and configured.

## Test Coverage Issues

_No issues._ Playwright E2E added in SI-07.8 for end-to-end home/search flows. Backend E2E covers the `q` filter.

## Open Questions

_None._ Order-by: home page is `view_count DESC` by default. Search results also `view_count DESC` — most popular matching results first. This is a reasonable default for MVP.
