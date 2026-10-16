# Recommendations — Quality & Security Reference

**Feature**: Recommendations Module (Personalized Match Scores)
**Sources**: `spec.md`, `endpoints.md`

This file consolidates edge cases, testing strategy, security controls, and security test cases. The module is read-only, but unlike feature 008 it is **authenticated and returns per-user data**, so the security section focuses on identity isolation.

---

## 1. Edge Cases

### 1.1 Listing & Filtering

| ID | Scenario | Expected Behaviour | Source |
|:---|:---|:---|:---|
| EC-001 | No query parameters | Page 1, 20 results, `score_desc`, only the user's matches; `meta` incl. `synced_at` | FR-001, FR-004 |
| EC-002 | `limit` above 100 | Silently clamped to 100; no error | FR-001 |
| EC-003 | `page` beyond last page | `data: []` with correct `meta` | FR-001 |
| EC-004 | User has no matches | `data: []`, `meta.total: 0`, 200 | US1-5 |
| EC-005 | `sort` outside whitelist | `400 INVALID_SORT` | FR-004 |
| EC-006 | `min_score` < 0, > 100, or non-integer | `400 VALIDATION_ERROR` | FR-011 |
| EC-007 | `min_score` boundary (`0`, `100`) | Accepted; inclusive (`>=`) | FR-003 |
| EC-008 | `calculated_after` malformed | `400 VALIDATION_ERROR` | FR-011 |
| EC-009 | `calculated_after` in the future | `data: []`, 200 | FR-003 |
| EC-010 | `calculated_after` equals a row's `calculated_at` | Row excluded (strictly after) | FR-003 |
| EC-011 | Opportunity filter used on endpoint 1 | Result filtered; **no opportunity field present** in any item | FR-005 |
| EC-012 | `deadline_from` > `deadline_to` | `400 INVALID_DATE_RANGE` | FR-003 |
| EC-013 | All filters combined | AND logic; totals reflect filtered set | FR-003 |
| EC-014 | `study_levels` / `fields_of_study` comma lists | OR-match within each, AND across filters | FR-003 |
| EC-015 | Many rows with same `score_pct` | Deterministic order via `opportunity_id` tiebreak; no duplicates/skips across pages | FR-004 |
| EC-016 | Opportunity has `deadline = null` | Not treated as expired; visible by default | FR-003 |
| EC-017 | Opportunity expired / inactive, default request | Match hidden; excluded from `total` | FR-003 |
| EC-018 | Same request with `include_expired=true` | Match visible | FR-003 |
| EC-019 | `include_expired` sent as `"true"`/`"false"` string | Coerced to boolean | FR-011 |
| EC-020 | Match row whose opportunity no longer exists | Endpoint 1 w/o opportunity filter: still returned (id only); endpoint 2 and any opportunity-filtered query: excluded. Must never produce a 500 | Edge Cases |

### 1.2 Combined Endpoint

| ID | Scenario | Expected Behaviour | Source |
|:---|:---|:---|:---|
| EC-021 | Same inputs on both endpoints | Identical ordered set of `opportunity_id`s | FR-006, SC-004 |
| EC-022 | `fields` param sent | `400 VALIDATION_ERROR` (unknown param) | FR-007 |
| EC-023 | Opportunity has null optional fields (`organization`, `deadline`, `country`, …) | Returned as `null`, not omitted | FR-006 |
| EC-024 | Response inspected | `opportunity` has exactly 7 keys; no `description`, `eligibility`, `application_url`, etc. | FR-007 |

### 1.3 External Data Source & Cache

| ID | Scenario | Expected Behaviour | Source |
|:---|:---|:---|:---|
| EC-025 | AI database unreachable | `503 SERVICE_UNAVAILABLE`; no retry; no degraded empty list; logged with context | FR-011, FR-013 |
| EC-026 | Slow DB / timeout | 503 once timeout exceeded | FR-011 |
| EC-027 | Write attempted to AI DB | Impossible: no write code path; DB user SELECT-only | FR-009 |
| EC-028 | Repeated identical request within TTL | Served from cache | FR-010 |
| EC-029 | Request after TTL | Fresh read; new `synced_at` | FR-010 |
| EC-030 | Two users, identical filters | Separate cache entries (key includes `user_id`) | FR-002, FR-010 |
| EC-031 | Same filters in different param order / casing of whitespace | Same normalized hash → same cache entry | FR-010 |
| EC-032 | Cache backend (Redis) down | Request still served from DB; cache failure logged at `warn`; no 500 | FR-010 |
| EC-033 | Matches recalculated by Python service while cached | Stale until TTL expiry (accepted; no invalidation) | Clarification Q1 |

### 1.4 Identity & Cross-cutting

| ID | Scenario | Expected Behaviour | Source |
|:---|:---|:---|:---|
| EC-034 | No / invalid / expired JWT | `401 UNAUTHORIZED` | FR-002 |
| EC-035 | `user_id` in query or body | `400 VALIDATION_ERROR`; never used | FR-002 |
| EC-036 | Token user has no rows but other users do | Empty list; no leakage | FR-002 |
| EC-037 | Soft-deleted / inactive user with valid token | Governed by existing auth guard behaviour; module adds no extra logic | Assumptions |
| EC-038 | Envelope inspection | Success `{ statusCode, message, data, meta, timestamp }`; error `{ statusCode, message, error, timestamp }`; no raw Prisma models or stack traces | Constitution IV, IX |
| EC-039 | Malformed UUID in `source_id` | `400 VALIDATION_ERROR` | FR-011 |
| EC-040 | `q` longer than 500 chars | `400 VALIDATION_ERROR` | FR-011 |

---

## 2. Testing Strategy

### 2.1 Philosophy

Read-only, stateless module; heaviest risk is **query correctness (filters, joins, pagination)** and **user isolation**. Test pyramid is tilted toward integration/E2E for the HTTP contract and identity checks, with a focused unit layer for the shared filter builder, mappers and cache-key hashing. The AI database is always mocked; no test touches a live external DB.

### 2.2 Test Pyramid

| Layer | Scope | Tools | Doubles | When |
|:---|:---|:---|:---|:---|
| Unit | Shared filter→`where` builder, sort mapping, `limit` clamp, expired/inactive rule, match mapper, cache-key normalization, error mapping to 503 | Jest | Mock `AiPrismaService`, mock cache | `pnpm test` |
| Integration/E2E | Routes, JWT guard, `ValidationPipe`, envelope, pagination meta, both endpoints parity, `403/401` paths | Jest + Supertest | Test double for `AiPrismaService` with fixtures; real/in-memory cache | `pnpm test:e2e` |
| Smoke | Both endpoints return 200 with a valid token | `tests/levora-smoke-tests.json` | No production data | Per deployment |

`ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) and the JWT guard must be active in the E2E context.

### 2.3 Coverage Requirements

Every FR, every error key in `endpoints.md`, and every edge case above is mandatory coverage; Jest coverage ≥ 80% for new services. Specifically:

- Every query parameter tested individually and in one combination, on both endpoints.
- `sort` tested with each valid value, an invalid value.
- `min_score` boundaries (0, 100, 101, −1).
- `calculated_after` incremental-sync semantics (strictly after).
- `include_expired` default vs `true`; `deadline = null`.
- Parity test: endpoints 1 and 2 return the same ordered ids for ≥ 3 different filter sets.
- Endpoint 1 never contains opportunity keys; endpoint 2 contains exactly the 7 summary keys.
- Cross-user isolation (user A never sees user B's rows).
- Cache: hit, miss, TTL expiry, per-user key separation.
- `503` via mocked connection failure; `401` without token.

### 2.4 Test Data Management

Fixtures injected via the mocked `AiPrismaService`:

- ≥ 2 users with ≥ 25 matches each, with varied `score_pct` (including ties), `calculated_at`, and `calculation_version`.
- Linked opportunities with varied `country`, `opportunity_type`, `funding_type`, `is_remote`, `deadline`, `study_levels`, `fields_of_study`.
- At least one expired opportunity, one inactive-status opportunity, one with `deadline: null`, one with all nullable fields null.
- At least one match whose opportunity is missing (orphan).
- One user with zero matches.

### 2.5 Naming Conventions

| File | Purpose |
|:---|:---|
| `recommendations.service.spec.ts` | Unit tests for service / filter builder / cache logic |
| `recommendations.mapper.spec.ts` | Unit tests for match & combined mappers |
| `test/recommendations.e2e-spec.ts` | HTTP contract, auth, validation, parity, isolation |

`describe` names the endpoint or method; `it` uses Given-When-Then and may append `[FR-xxx]` / `[EC-xxx]`.

### 2.6 Traceability Matrix

| FR | Test File(s) | Test Cases | Layer |
|:---|:---|:---|:---|
| FR-001 | `service.spec`, `e2e-spec` | Default response shape, `meta.synced_at`, default 20 / cap 100 | Unit, E2E |
| FR-002 | `e2e-spec` | Identity from token; `user_id` param rejected; cross-user isolation | E2E |
| FR-003 | `service.spec`, `e2e-spec` | min_score, calculated_after, opportunity filters, expired default/include | Unit, E2E |
| FR-004 | `service.spec`, `e2e-spec` | Three sort orders; invalid sort; tiebreak determinism | Unit, E2E |
| FR-005 | `e2e-spec` | No opportunity keys on endpoint 1 even with filters | E2E |
| FR-006 | `mapper.spec`, `e2e-spec` | Combined item shape; same selection as endpoint 1 | Unit, E2E |
| FR-007 | `mapper.spec`, `e2e-spec` | Exactly 7 summary keys; `fields` rejected | Unit, E2E |
| FR-008 | `mapper.spec` | One shared match DTO/mapper; brief mapper reused from opportunities | Unit |
| FR-009 | Static review | No create/update/delete/executeRaw calls | Static |
| FR-010 | `service.spec`, `e2e-spec` | Hit/miss/TTL; per-user key; Redis-down fallback | Unit, E2E |
| FR-011 | `e2e-spec` | Validation errors; 401; 503 on DB failure | E2E |
| FR-012 | Swagger review | Description contains "never returns full opportunity details" | Static |
| FR-013 | `service.spec` | Failure logged without secrets | Unit |

### 2.7 Regression Policy

Every defect fix adds a failing regression test linked to the relevant FR, error key, and EC identifier before the fix (Constitution VI).

### 2.8 CI Integration

Every PR runs `pnpm build`, `pnpm lint`, `pnpm test`. `pnpm test:e2e` runs as a deployment gate. Test reports are stored under `test-reports/<date>/`. Postman collection is updated for both endpoints.

---

## 3. Security Controls

### 3.1 Control Register

| ID | Control | Enforcement Mechanism | Verification |
|:---|:---|:---|:---|
| SC-001 | Authentication required on both endpoints | Global JWT guard (`passport-jwt`); no `@Public()` on the controller | ST-001 |
| SC-002 | `user_id` only from token | Custom param decorator reading `req.user`; DTO has no `user_id`; `forbidNonWhitelisted` | ST-002, ST-003 |
| SC-003 | Every query is scoped by `user_id` | Repository method requires `userId` argument; base `where` always includes it; cache key includes it | ST-004, ST-005 |
| SC-004 | AI database is read-only | DB user SELECT-only (on limited Views where possible); no write calls in code | ST-006 |
| SC-005 | Credentials from env only | `@nestjs/config`; fail fast if `DATABASE_AIService_URL` absent; never logged | ST-007, ST-008 |
| SC-006 | Unknown/malformed params rejected | Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`); sort whitelist | ST-009–011 |
| SC-007 | No full opportunity details exposed | Fixed 7-field summary mapper; no `fields` param; response DTOs only | ST-012 |
| SC-008 | Safe error surface | `GlobalExceptionFilter`; DB failure → 503 with safe message; internals only in logs | ST-013, ST-014 |
| SC-009 | No injection | Prisma query API only; `q` through `contains`; no `$queryRaw` (if ever needed, justified in code + review per Constitution II) | ST-015 |
| SC-010 | Cache cannot leak data across users | Cache key = `user_id` + normalized-filter hash; endpoint-specific prefix | ST-005 |

### 3.2 Notes

**Authentication / Authorization**: Any authenticated user may read *their own* matches. No role is required; no admin override exists in this feature.

**Data sensitivity**: Match scores and breakdowns are user-specific and treated as personal data: never logged in full, never cached under a shared key.

**Cross-database identity**: `user_id` in the AI DB is a plain UUID without a foreign key. The module trusts only the token; it never accepts it from the client.

**Rate limiting**: The existing global throttler applies; no module-specific limits.

**Observability**: Log DB failures at `error`, cache failures at `warn`; no score payloads or credentials in logs.

---

## 4. Security Testing

| ID | Control Ref | Test Case | Expected Result | Layer |
|:---|:---|:---|:---|:---|
| ST-001 | SC-001 | Call both endpoints without / with invalid / with expired token | `401 UNAUTHORIZED` | E2E |
| ST-002 | SC-002 | Send `?user_id=<other user>` | `400 VALIDATION_ERROR`; data never for that user | E2E |
| ST-003 | SC-002 | Send `user_id` in body (GET with body) / header spoof attempts | Ignored; results belong to token user | E2E |
| ST-004 | SC-003 | Seed two users; call as user A | Only A's rows; B's `opportunity_id`/scores absent | E2E |
| ST-005 | SC-003, SC-010 | A then B call with identical filters | Different results; no cache cross-over | Integration |
| ST-006 | SC-004 | Static scan of repository/services | Zero `create`, `update`, `upsert`, `delete`, `$executeRaw` | Static |
| ST-007 | SC-005 | Start app without `DATABASE_AIService_URL` | Startup fails with descriptive error | Integration |
| ST-008 | SC-005 | Log-capture during failure | Connection string never appears in logs | Static, Integration |
| ST-009 | SC-006 | Invalid `sort` | `400 INVALID_SORT` | E2E |
| ST-010 | SC-006 | Wrong types for `page`, `limit`, `min_score`, `is_remote`, `include_expired` | `400 VALIDATION_ERROR` | E2E |
| ST-011 | SC-006 | Unknown query param (e.g. `foo=1`) | `400 VALIDATION_ERROR` | E2E |
| ST-012 | SC-007 | Inspect responses of both endpoints | Endpoint 1: only 5 match keys; endpoint 2: only 5 + `opportunity` with exactly 7 keys; `fields=*` rejected | E2E |
| ST-013 | SC-008 | Mock DB connection error | `503 SERVICE_UNAVAILABLE`; safe message; logged | Unit, E2E |
| ST-014 | SC-008 | Force a typed service error | Documented error key; no stack trace in body | Integration |
| ST-015 | SC-009 | `q` containing SQL metacharacters (`'; DROP TABLE--`, `%`, `_`) | Treated as literal; 200 with no results/err; no raw SQL used | E2E |
