# Quickstart Validation Guide — Recommendations Module

**Branch**: `009-recommendations-matches` | **Date**: 2026-10-07

How to validate the feature end-to-end after implementation. Details live in `plan.md`, `data-model.md`, and `contracts/`.

---

## Prerequisites

| Requirement | Details |
|:---|:---|
| Node.js / pnpm | per `package.json` |
| PostgreSQL (main) | running, migrated, seeded (a user you can log in with) |
| PostgreSQL (AI service) | populated with `cleaned_opportunities` and `match_scores` rows for that user's `id` |
| Redis | running (cache) |
| `.env` | `DATABASE_URL`, `DATABASE_AIService_URL`, `RECOMMENDATIONS_MATCHES_CACHE_TTL_SEC`, `RECOMMENDATIONS_COMBINED_CACHE_TTL_SEC` |
| DB grant | AI DB user has `SELECT` on `match_scores` |

```bash
pnpm install
pnpm generate:ai
pnpm start:dev
```

Obtain a token (existing login endpoint) and export it: `TOKEN=<jwt>`.

---

## Validation Scenarios

### 1. Default matches
`curl -H "Authorization: Bearer $TOKEN" localhost:3000/api/v1/recommendations/matches`
**Expect**: 200; items have exactly 5 keys; `meta` has `page=1, limit=20, total, pages, synced_at`; sorted by `score_pct` desc. *(FR-001, FR-005)*

### 2. Auth required
Same call without token. **Expect**: 401. *(FR-002)*

### 3. Identity cannot be spoofed
`...matches?user_id=<other-user-uuid>` **Expect**: 400 `VALIDATION_ERROR`. *(FR-002)*

### 4. Score, sort, incremental sync
- `?min_score=70` → all `score_pct >= 70`.
- `?sort=score_asc` → ascending; `?sort=bogus` → 400 `INVALID_SORT`.
- `?calculated_after=<meta.synced_at of previous call>` → only newer rows (likely empty). *(FR-003, FR-004)*

### 5. Opportunity filters without leakage
`?country=Egypt&opportunity_type=scholarship` **Expect**: filtered set; still no opportunity keys. *(FR-003, FR-005)*

### 6. Expired visibility
Default hides expired/inactive; `?include_expired=true` returns more (or equal) rows. *(FR-003)*

### 7. Combined endpoint parity
Call `matches-with-opportunities` with the same query as scenario 5. **Expect**: same ordered `opportunity_id`s; each item has `opportunity` with exactly 7 keys; `?fields=*` → 400. *(FR-006, FR-007)*

### 8. Limit clamp & empty pages
`?limit=500` → at most 100 items, no error; `?page=9999` → `data: []`, correct `meta`. *(FR-001)*

### 9. Cache
Repeat an identical request twice: second is served from cache (check debug log / lower latency). A different user with the same query gets different data. *(FR-010)*

### 10. AI DB down
Stop the AI DB (or use a wrong `DATABASE_AIService_URL` in a throwaway env). **Expect**: 503 `SERVICE_UNAVAILABLE`, error logged, no crash. *(FR-011)*

---

## Automated Gates

```bash
pnpm build && pnpm lint && pnpm test && pnpm test:e2e
```
All must pass; feature 008 tests must remain green after the filter/mapper extraction.
