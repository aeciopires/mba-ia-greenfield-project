---
kind: phase
name: phase-06-social
sources_mtime:
  docs/project-plan.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-06-social.md: "2026-06-29T00:00:00-03:00"
  docs/phases/phase-05-video-watch/phase-05-video-watch.md: "2026-06-29T00:00:00-03:00"
  docs/decisions/technical-decisions-phase-05-video-watch.md: "2026-06-29T00:00:00-03:00"
---

# phase-06-social — Context

## Scope

**Phase name:** Fase 06 — Interações Sociais (Likes, Comentários, Inscrições)

**Capabilities**

- Like e dislike em vídeos (usuários autenticados)
- Comentários em vídeos (usuários autenticados)
- Respostas a comentários (comentários aninhados, máx. 1 nível)
- Like e dislike em comentários (usuários autenticados)
- Inscrição em canais (seguir/deixar de seguir)
- Área de canais seguidos com acesso rápido aos vídeos
- Contagem de inscritos na página do canal
- Interface completa de comentários, likes e inscrições

**Out of scope:** Notificações de novos vídeos para inscritos, sistema de moderação de comentários, denúncias, ranking de comentários, home personalizada (Fase 07).

**Deliverables:** Likes/dislikes funcionando, comentários com respostas, inscrição em canais, listagem de canais seguidos.

**Affected subprojects:** `nestjs-project/`, `next-frontend/`

**Sequencing notes:** Depends on Fase 02 (auth), Fase 04 (channels, video management), Fase 05 (watch page where these features appear). Social counters extend the denormalized columns introduced in Phase 04/05.

**Neighbors (for boundary detection only):** Fase 05 (prior), Fase 07 — Página Inicial, Busca e Finalização (next).

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|-----|--------|-------|-------|--------|----------|-----------|
| phase-06-social/TD-01 | technical-decisions-phase-06-social.md | Backend | Like/Dislike Storage Model | decided | A (Single table with `type` column) | — |
| phase-06-social/TD-02 | technical-decisions-phase-06-social.md | Backend | Comment Structure and Nesting Depth | decided | A (Max depth 1 adjacency list) | — |
| phase-06-social/TD-03 | technical-decisions-phase-06-social.md | Backend | Counter Denormalization | decided | A (Atomic UPDATE at write time) | — |
| phase-06-social/TD-04 | technical-decisions-phase-06-social.md | Backend | Channel Subscription Model | decided | A (`channel_subscriptions` join table) | — |

## Capability Coverage

| Capability | Covered by |
|------------|------------|
| Like e dislike em vídeos | phase-06-social/TD-01 |
| Comentários em vídeos | phase-06-social/TD-02 |
| Respostas a comentários (máx. 1 nível) | phase-06-social/TD-02 |
| Like e dislike em comentários | phase-06-social/TD-01 |
| Inscrição em canais | phase-06-social/TD-04 |
| Área de canais seguidos | phase-06-social/TD-04 |
| Contagem de inscritos | phase-06-social/TD-03, TD-04 |
| Interface completa | All TDs (frontend layer) |

## Decisions Detail

### phase-06-social/TD-01
**Recommendation:** Single table with `type` column — UPSERT handles all transitions (like ↔ dislike ↔ none) atomically. PK on `(user_id, video_id)` prevents duplicates.
**Libraries:** —

### phase-06-social/TD-02
**Recommendation:** Max depth 1 adjacency list — one level of nesting (comments + replies). `parent_id IS NULL` check on insert. Mirrors YouTube UX.
**Libraries:** —

### phase-06-social/TD-03
**Recommendation:** Atomic `UPDATE ... SET counter = counter ± 1` at write time for `likes_count`, `dislikes_count`, `comments_count` on `videos` and `subscribers_count` on `channels`.
**Libraries:** —

### phase-06-social/TD-04
**Recommendation:** `channel_subscriptions(subscriber_id, channel_id, created_at)` join table with composite PK and cascade FKs.
**Libraries:** —

## Inherited Decisions Detail

### phase-04-video-management/TD-05
**Recommendation:** Denormalized counter columns on `videos` — Phase 06 extends this to add `likes_count`, `dislikes_count`, `comments_count` (if not already added in Phase 04) and `subscribers_count` on `channels`.
**Libraries:** —

### phase-02-auth/TD-07
**Recommendation:** Custom Domain Exception Filter — Phase 06 adds `CommentNotFoundException`, `AlreadySubscribedException`, `NotSubscribedException`.
**Libraries:** —

## Inherited Conventions
- All write endpoints for social actions require `Bearer JWT`. _(phase 02)_
- Read endpoints for public data use `@Public()`. _(phase 02)_
- Domain errors via `DomainException` subclasses. _(phase 02)_
- Counter updates: `UPDATE ... SET col = col + 1` — never read-modify-write. _(phase 04/TD-05)_
- BFF Route Handlers in `next-frontend/app/api/`. _(phase 02)_

## Non-UI / Deferred Capabilities

| Capability | Status | Rationale |
|------------|--------|-----------|
| Notificações para inscritos | deferred | Requer sistema de notificações em tempo real (WebSockets/SSE) |
| Moderação e denúncias de comentários | deferred | Fora do escopo do projeto |
| Feed personalizado baseado em inscrições | deferred | Abordado na Fase 07 (home page) |
