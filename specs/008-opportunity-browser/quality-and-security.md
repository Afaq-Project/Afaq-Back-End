# Opportunity Browser — Quality & Security Reference

**Feature**: Opportunity Browser
**Sources**: `spec.md`, `endpoints.md`

This file consolidates edge cases, testing strategy, security controls, and security test cases into a single reference document. Given the read-only, public nature of this feature, the security surface is narrow and does not warrant the four-file separation used for write-heavy modules.

---

## 1. Edge Cases

### 1.1 Listing & Filtering

| ID | Scenario | Expected Behaviour | Source |
|:---|:---|:---|:---|
| EC-001 | No query parameters supplied | Returns page 1, 20 results, `created_at:desc`, default 7 fields; `meta` is present and correct | FR-001, FR-002, FR-014 |
| EC-002 | `limit` set to a value above 100 (e.g., `9999`) | Silently clamped to 100; response contains at most 100 records; no error | FR-009 |
| EC-003 | `page` exceeds last available page | Returns `data: []` with correct `meta.total` and `meta.pages` — never an error | FR-010 |
| EC-004 | `sort` field not in the allowed whitelist | `400 INVALID_SORT_FIELD` — no results returned | FR-007 |
| EC-005 | `sort` direction is not `asc` or `desc` | `400 VALIDATION_ERROR` | FR-007 |
| EC-006 | `fields` contains a name not in the whitelist | `400 INVALID_FIELD` identifying the offending name(s) — no partial result | FR-012 |
| EC-007 | `fields=*` | All whitelisted fields returned for each record | FR-013 |
| EC-008 | `fields` omitted on list endpoint | Exactly the 7 default summary fields returned; no extra fields leak through | FR-014 |
| EC-009 | `deadline_from` later than `deadline_to` | `400 INVALID_DATE_RANGE` | FR-005 |
| EC-010 | `deadline_from` or `deadline_to` is a non-ISO-8601 string | `400 VALIDATION_ERROR` | FR-005 |
| EC-011 | A record in the external DB has `null` deadline | Record is included in results; `deadline: null` is returned in the response; the record is excluded from any active `deadline_from`/`deadline_to` filter (treated as having no deadline) | Spec Edge Cases |
| EC-012 | `study_levels` or `fields_of_study` provided as comma-separated values | Split into array; OR-match applied against stored array column; any record containing at least one value is included | FR-004 |
| EC-013 | All active filters applied simultaneously (e.g., country + type + deadline range + study levels) | AND logic applied across all filters; only records satisfying every condition are returned | FR-003 |
| EC-014 | `q` parameter with leading/trailing whitespace | Whitespace stripped before matching; search proceeds normally | FR-006 |
| EC-015 | `q` matches no records | `data: []`, `meta.total: 0` — not an error | FR-006 |
| EC-016 | `q` combined with other filters | Both keyword match and filter conditions applied simultaneously (AND) | FR-006 |
| EC-017 | `is_remote` sent as string `"true"` or `"false"` | Transformed to boolean via `class-transformer`; accepted | FR-003 |
| EC-018 | `page` or `limit` sent as non-integer (e.g., `"abc"`) | `400 VALIDATION_ERROR` | FR-001 |

### 1.2 Detail View

| ID | Scenario | Expected Behaviour | Source |
|:---|:---|:---|:---|
| EC-019 | Valid UUID supplied for an existing record | Full opportunity object returned with all whitelisted fields | FR-015 |
| EC-020 | UUID does not exist in the external database | `404 OPPORTUNITY_NOT_FOUND` — never an empty 200 or a 500 | FR-016 |
| EC-021 | `id` path parameter is not a valid UUID format | `400 VALIDATION_ERROR` before any database lookup | endpoints §2 |
| EC-022 | `fields` supplied on detail endpoint | Only the requested whitelisted fields returned; unknown field causes `400 INVALID_FIELD` | FR-011, FR-012 |
| EC-023 | Record exists but has null values for optional fields (`description`, `eligibility`, etc.) | Null fields returned as `null` — they are not omitted from the response | Spec Key Entities |

### 1.3 External Data Source

| ID | Scenario | Expected Behaviour | Source |
|:---|:---|:---|:---|
| EC-024 | External AI database is unreachable at request time | `503 SERVICE_UNAVAILABLE` with a meaningful message; no application-level retry; failure logged with context | FR-019, SC-009 |
| EC-025 | External database connection is slow (latency spike, not full outage) | Request completes if within connection timeout; 503 if timeout threshold exceeded | FR-019 |
| EC-026 | External database user attempts a write (INSERT/UPDATE/DELETE) | Operation is impossible — DB user is provisioned with SELECT-only privileges at the PostgreSQL level; application layer performs no writes | FR-017, Assumptions |
| EC-027 | A record in the external DB has an empty string title | Record is returned as-is; no backend filtering of records based on field values is performed (AI service is responsible for data quality) | Assumptions |

### 1.4 Cross-cutting

| ID | Scenario | Expected Behaviour | Source |
|:---|:---|:---|:---|
| EC-028 | Request/response envelopes inspected | Success uses `{ statusCode, message, data, meta?, timestamp }`; error uses `{ statusCode, message, error, timestamp }`; no raw Prisma models or stack traces | endpoints conventions; Constitution IV, IX |
| EC-029 | Bearer token included in request (logged-in user) | Token is ignored — both endpoints are public and perform no auth check. No user-specific data is returned or stored | Assumptions, spec §1 |
| EC-030 | Invalid JSON in query string (e.g., malformed UUID for `source_id`) | `400 VALIDATION_ERROR` | FR-003 |

---

## 2. Testing Strategy

### 2.1 Philosophy

This module is read-only and stateless — it performs no mutations and stores no data. As a result, the test pyramid is tilted toward integration/E2E coverage (verifying the HTTP contract, query building, filter combinations, and error handling) with a focused unit layer for the query-builder logic and parameter transformation.

External services (AI database) are mocked in all unit and integration tests. No test ever connects to a live external database.

### 2.2 Test Pyramid

| Layer | Scope | Tools | Doubles | When |
|:---|:---|:---|:---|:---|
| Unit | Query-builder logic (filter-to-where mapping, sort parsing, field selection, limit clamping, `study_levels`/`fields_of_study` array splitting) | Jest | Mock `AiPrismaService`; no live DB | Local, `pnpm test` |
| Integration/E2E | HTTP routes, `ValidationPipe`, parameter transformation (`is_remote` boolean coercion, date parsing), response envelope, error keys, pagination metadata | Jest + Supertest | Test double for `AiPrismaService` returning fixture data; no live external DB | Local, CI `pnpm test:e2e` |
| Smoke | Both endpoint paths reachable and return 200 on a valid request | Existing `tests/levora-smoke-tests.json` | No production data | Per deployment |

Guards are not applicable — both endpoints are public. `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) must be active in E2E test context.

### 2.3 Coverage Requirements

Every FR, every error key in `endpoints.md`, and every edge case in Section 1 above is mandatory test coverage. Specifically:

- All 9 filter parameters tested individually and in at least one combination.
- `fields` whitelist enforcement tested with a valid, an invalid, and the `*` value on both endpoints.
- `sort` whitelist enforcement tested with a valid field, an invalid field, and an invalid direction.
- `limit` clamping verified: `limit=200` must produce a response with at most 100 records and no error.
- `deadline_from` > `deadline_to` validation verified.
- `503` path verified by mocking a database connection failure.
- `404` path verified for the detail endpoint.
- `400` for a non-UUID `:id` verified.

### 2.4 Test Data Management

Use isolated fixture data injected via the mocked `AiPrismaService`. No real external database is used. Fixtures must cover:

- At least 25 opportunity records with varied `country`, `opportunity_type`, `funding_type`, `is_remote`, `deadline`, `study_levels`, and `fields_of_study` values.
- At least one record with all nullable fields set to `null`.
- At least one record with `deadline: null`.

### 2.5 Naming Conventions

| File | Purpose |
|:---|:---|
| `opportunities.service.spec.ts` | Unit tests for query-builder and parameter transformation logic |
| `test/opportunities.e2e-spec.ts` | Integration/E2E tests for HTTP contract, filters, errors, and pagination |

`describe` names the endpoint or method. `it` states Given-When-Then behaviour and may append `[FR-xxx]` or `[EC-xxx]`.

### 2.6 Traceability Matrix

| FR | Test File(s) | Test Cases | Layer |
|:---|:---|:---|:---|
| FR-001 | `service.spec`, `e2e-spec` | Default no-params response; `meta` shape correct | Unit, E2E |
| FR-002 | `service.spec`, `e2e-spec` | Default page/limit/sort applied when absent | Unit, E2E |
| FR-003 | `service.spec`, `e2e-spec` | Each filter param individually; multi-filter AND | Unit, E2E |
| FR-004 | `service.spec` | `study_levels`/`fields_of_study` OR-match; single and multiple values | Unit |
| FR-005 | `service.spec`, `e2e-spec` | Valid date range; `deadline_from` > `deadline_to`; non-ISO string | Unit, E2E |
| FR-006 | `service.spec`, `e2e-spec` | Match in title; match in description; no match; whitespace strip; combined with filter | Unit, E2E |
| FR-007 | `service.spec`, `e2e-spec` | Valid sort field+direction; invalid field; invalid direction | Unit, E2E |
| FR-008 | `e2e-spec` | `meta` object present; `total`, `pages`, `page`, `limit` correct | E2E |
| FR-009 | `service.spec`, `e2e-spec` | `limit=50` accepted; `limit=200` clamped to 100 silently | Unit, E2E |
| FR-010 | `e2e-spec` | `page` beyond last page returns empty array with correct `meta` | E2E |
| FR-011 | `service.spec`, `e2e-spec` | `fields` on detail endpoint; partial selection; `fields=*` | Unit, E2E |
| FR-012 | `service.spec`, `e2e-spec` | Unknown field in `fields` → `400 INVALID_FIELD` on list and detail | Unit, E2E |
| FR-013 | `e2e-spec` | `fields=*` returns all whitelisted fields | E2E |
| FR-014 | `e2e-spec` | No `fields` param on list → exactly 7 default fields, no extras | E2E |
| FR-015 | `e2e-spec` | Valid ID returns full object with all whitelisted fields | E2E |
| FR-016 | `e2e-spec` | Non-existent ID returns `404 OPPORTUNITY_NOT_FOUND` | E2E |
| FR-017 | Schema / DB user policy review | No INSERT/UPDATE/DELETE issued in any code path | Static |
| FR-018 | `service.spec`, startup test | `DATABASE_AIService_URL` absent causes startup failure | Unit, Integration |
| FR-019 | `service.spec`, `e2e-spec` | DB connection failure → `503 SERVICE_UNAVAILABLE`; logged | Unit, E2E |

### 2.7 Regression Policy

Every defect fix adds a failing regression test linked to the relevant FR, error key, and EC identifier before the fix is applied. Required per Constitution VI.

### 2.8 CI Integration

Every PR runs `pnpm build`, `pnpm lint`, and `pnpm test`. The `pnpm test:e2e` suite runs as a deployment gate. No nightly-only suite is defined for this feature.

---

## 3. Security Controls

Controls are traceable to the Constitution, `spec.md`, and `endpoints.md`. This feature has a narrow security surface: it is read-only, public, and serves data from an external database.

### 3.1 Control Register

| ID | Control | Enforcement Mechanism | Verification |
|:---|:---|:---|:---|
| SC-001 | Both endpoints are public — no JWT or session required (spec Assumptions; FR confirmed by clarification) | No auth guard applied to the `OpportunitiesController`; `@Public()` decorator or equivalent | ST-001 |
| SC-002 | External database is read-only — no writes permitted under any circumstance (FR-017) | DB user provisioned with `SELECT`-only privileges at the PostgreSQL level; no `INSERT`/`UPDATE`/`DELETE` issued in any service method | ST-002 |
| SC-003 | External database credentials sourced exclusively from environment (FR-018; Constitution X) | `ConfigService` backed by `@nestjs/config`; startup validation fails fast if `DATABASE_AIService_URL` is absent | ST-003 |
| SC-004 | Unknown and malformed request parameters rejected (Constitution IV; FR-007, FR-009, FR-012) | Global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`); field whitelist enforced in service layer | ST-004–007 |
| SC-005 | All responses and errors use the documented envelope; no raw Prisma models or stack traces exposed (Constitution IV, IX) | `GlobalExceptionFilter`; DTOs shape all responses; error messages are user-facing strings only | ST-008–009 |
| SC-006 | Secrets and configuration kept out of source and logs (Constitution V, X) | No `process.env` access inside Controllers or Services; no credentials logged at any level | ST-010 |
| SC-007 | External database failure surfaced as `503`, not as an unhandled crash revealing internals (FR-019) | Caught at the service/repository layer; mapped to `503 SERVICE_UNAVAILABLE` with a safe user-facing message; full context logged internally | ST-011 |

### 3.2 Notes

**Authentication**: No JWT guard is applied. Both endpoints are unconditionally public per the confirmed clarification (Q1, Session 2026-09-30).

**Authorization**: No per-user data is returned. No ownership logic exists. No cross-user access risk.

**Input validation**: The primary risks are injection via `q`, invalid type coercion, and unrecognised field names. SC-004 and the `ValidationPipe` address all three. The `q` value is passed to Prisma's `contains` operator — never interpolated into raw SQL.

**Rate limiting**: No rate limit is declared for this feature. The endpoints are read-only and public; if abuse becomes a concern it is an infrastructure/gateway concern, not an application-layer specification item.

**Data exposure**: All data is from the AI service's `cleaned_opportunities` table, which is not PII. No user data, credentials, or internal identifiers are included in any response.

**CORS**: Not declared in this spec. Treated as a cross-cutting infrastructure concern.

---

## 4. Security Testing

| ID | Control Ref | Test Case | Expected Result | Layer |
|:---|:---|:---|:---|:---|
| ST-001 | SC-001 | Send requests to both endpoints without any Authorization header | `200 OK` — no token required, no `401` | E2E |
| ST-002 | SC-002 | Inspect all service methods and generated Prisma calls | Zero `create`, `update`, `upsert`, `delete`, `executeRaw` calls in any code path | Static |
| ST-003 | SC-003 | Start application with `DATABASE_AIService_URL` absent from environment | Application startup fails with a descriptive error; does not start silently misconfigured | Integration |
| ST-004 | SC-004 | Send `fields` with a value not in the whitelist (e.g., `fields=password`) | `400 INVALID_FIELD` on both endpoints | E2E |
| ST-005 | SC-004 | Send `sort` with a field not in the sort whitelist | `400 INVALID_SORT_FIELD` | E2E |
| ST-006 | SC-004 | Send `limit`, `page`, or `is_remote` with a wrong type | `400 VALIDATION_ERROR` | E2E |
| ST-007 | SC-004 | Send `deadline_from` with a non-ISO-8601 string | `400 VALIDATION_ERROR` | E2E |
| ST-008 | SC-005 | Inspect `200` success responses on both endpoints | No raw Prisma `_count`, `@@map` internals, or `password` field in any response | E2E |
| ST-009 | SC-005 | Force a typed service error | Response contains documented error key and user-facing message; no stack trace in body | Integration |
| ST-010 | SC-006 | Static grep / log-capture test | `DATABASE_AIService_URL` value never appears in application logs or emitted log payloads | Static, Integration |
| ST-011 | SC-007 | Mock AI database connection to throw a connection error | Both endpoints return `503 SERVICE_UNAVAILABLE` with a safe message; error is logged with context; no 500 or crash | Unit, E2E |
