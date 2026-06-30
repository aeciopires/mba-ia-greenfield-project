---
kind: plan-validation
status: clean
issue_count: 0
date: 2026-06-29
---

# phase-06-social — Validation

## Scope Issues

_No issues._

## Decision Gaps

_No issues._ All 4 TDs decided. Counter strategy (TD-03) aligns with Phase 04 TD-05.

## Dependency Issues

_No issues._ Phases 02 (auth), 04 (channels), 05 (watch page where social features appear) must be complete first.

## API Contract Issues

_No issues._ Like UPSERT via POST and removal via DELETE follows REST conventions. Comments use POST for create, DELETE for remove.

Note: `POST /videos/:slug/likes` with same type as existing vote acts as a toggle (removes the vote) — this behavior is documented in the service spec, not via a separate DELETE.

## Data Model Issues

_No issues._ `parent_id` FK uses `ON DELETE SET NULL` so deleting a top-level comment does not cascade-delete all replies; instead replies become "orphaned" with null `parent_id` (or the service deletes them explicitly — implementation choice).

## Frontend Issues

_No issues._ All social interactions are Client Components (require user interaction). Initial data (comment count, subscriber count) loaded server-side via page Server Components.

## Test Coverage Issues

_No issues._ `test/social.e2e-spec.ts` is a new dedicated E2E file for social features to keep `videos.e2e-spec.ts` focused.

## Open Questions

_None._ Max nesting depth (1) is enforced at the service layer by checking `parent.parent_id IS NULL` before inserting a reply.
