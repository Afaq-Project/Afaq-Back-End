# Research: Recommendations Module

**Branch**: `009-recommendations-matches` | **Date**: 2026-10-07

All Technical Context unknowns are resolved below.

---

## Decision 1: Sharing opportunity filter logic

**Decision**: Refactor the inline `where` construction in `OpportunitiesService` into a public method `buildWhere(filters: OpportunityFilterInput)`. `RecommendationsService` calls it and passes the result to `RecommendationsRepository`, which wraps it as `opportunity: { is: where }`. `ListMatchesDto` declares its own decorated filter fields (same names and validation) and is passed structurally as `OpportunityFilterInput`.

**Rationale**: FR-008 requires filter logic written once and the same semantics as `GET /opportunities`. Exposing it as a public `OpportunitiesService` method satisfies Constitution XI (cross-module calls go through exported services, no DTO/repository reach-in) with no circularity (`recommendations → opportunities`, never the reverse).

**Alternatives**: Re-implement in recommendations (violates DRY, drift risk) — rejected. Call `OpportunitiesService` per page and merge in memory — breaks pagination/totals and adds N queries — rejected.

---

## Decision 2: Brief opportunity mapper

**Decision**: Add public `OpportunitiesService.getBriefSelect()` (7-field Prisma `select`) and `OpportunitiesService.toBrief()` (snake_case output). Endpoint 2 uses them verbatim.

**Rationale**: FR-006/FR-008; the 7 fields equal the default list fields of 008, so one definition serves both.

**Alternatives**: Redefine in recommendations — rejected (spec §7.3).

---

## Decision 3: Query shape

**Decision**: Prisma `matchScore.findMany` with `where: { userId, ...(scoreFilters), opportunity: { is: opportunityWhere } }`. Endpoint 1 uses `select` of the 5 match columns only (no relation selected). Endpoint 2 adds `opportunity: { select: BRIEF_SELECT }`. `count` runs in parallel with the same `where`. `orderBy` always ends with `{ opportunityId: 'asc' }` as tiebreaker.

**Rationale**: Prisma emits a join for relation filters, so filtering needs no extra query and returns no opportunity columns; one query shape per endpoint satisfies "single query with a real join" for endpoint 2.

**Alternatives**: `$queryRaw` joins — rejected (Constitution II). Two queries + in-memory merge — rejected (pagination).

---

## Decision 4: Expired / inactive definition

**Decision**: Unless `include_expired=true`, add to the opportunity relation filter: `AND (deadline IS NULL OR deadline >= now)` and `status NOT IN INACTIVE_OPPORTUNITY_STATUSES` (nullable status counts as active). `INACTIVE_OPPORTUNITY_STATUSES` is a constant in `recommendations.constants.ts` (initial list: `expired`, `closed`, `inactive`, `archived`, `error`, `failed`).

**Rationale**: Spec clarification Q3. `deadline = null` is "rolling", so not expired (EC-016). Actual status values are owned by the Python service → marked as an open item to confirm.

**Alternatives**: Env-configurable list — deferred (YAGNI). Deadline-only rule — misses inactive records.

---

## Decision 5: Caching

**Decision**: Service-level caching with the global `CACHE_MANAGER`. Key: `rec:matches:{userId}:{hash}` / `rec:combined:{userId}:{hash}` where `hash = sha1(JSON of normalized, key-sorted, defined-only query)`. TTLs from config: `RECOMMENDATIONS_MATCHES_CACHE_TTL_SEC` (default 1800 = "medium") and `RECOMMENDATIONS_COMBINED_CACHE_TTL_SEC` (default 300 = "short"). `include_expired` and pagination are part of the hash. Cache read/write errors are logged at `warn` and ignored (EC-032). No invalidation. TTLs are deployment/environment settings, deliberately kept in environment config and not in the administrative `SystemSettings` table.

**Rationale**: `CacheInterceptor` keys by URL, not user — unsafe for per-user data (SC-010). Matches Clarification Q1.

**Alternatives**: Event-based invalidation — rejected by clarification.

---

## Decision 6: Identity

**Decision**: `@CurrentUser('id')` supplies `userId`. `ListMatchesDto` declares no `user_id`; global `forbidNonWhitelisted` rejects it with 400. Repository methods take `userId` as a required first argument.

**Rationale**: Spec FR-002; makes an unscoped query impossible by construction.

---

## Decision 7: Pagination, limit, sort

**Decision**: `page` ≥ 1, `limit` default 20, silently clamped to 100 (same as 008). `sort`: `score_desc` (default) → `{scorePct:'desc'}`; `score_asc` → `{scorePct:'asc'}`; `calculated_at_desc` → `{calculatedAt:'desc'}`; invalid value → `400 INVALID_SORT`. `meta = { page, limit, total, pages, synced_at }` where `synced_at` is server time captured **before** the query (so a client using it as `calculated_after` never misses rows).

**Rationale**: Consistency with 008; safe incremental sync.

---

## Decision 8: Schema mirroring

**Decision**: Add `MatchScore` (camelCase fields with `@map`) and `matchScores MatchScore[]` on `CleanedOpportunity` in `prisma/ai-schema.prisma`; only `pnpm generate:ai`. `RawOpportunity`, `Conversation*`, `ApiKey` are not mirrored (unused).

**Rationale**: Constitution III / spec §1.3: Python DB is not managed by this repo's migrations.

---

## Decision 9: Error mapping

**Decision**: Reuse the pattern in `OpportunitiesRepository`: Prisma initialization/`P1xxx` errors → `ServiceUnavailableException('SERVICE_UNAVAILABLE')`, logged with context; others rethrown to `GlobalExceptionFilter`. To avoid duplicating the try/catch, the mapping is placed in a small shared helper used by the new repository.

---

## Decision 10: Performance

**Decision**: Rely on the Python DB's unique index `(user_id, opportunity_id)` (leading `user_id`) for user scoping; request additional indexes `(user_id, score_pct)` and `(user_id, calculated_at)` from the AI team. 5,000 rows/user keeps count+page queries well under SC-001 even without them.

---

## Open Items

- Confirm real `status` vocabulary of `cleaned_opportunities` (Decision 4).
- AI team: indexes (Decision 10) and `SELECT` grant on `match_scores`.
- Separate task: batch `GET /opportunities?ids=`.
