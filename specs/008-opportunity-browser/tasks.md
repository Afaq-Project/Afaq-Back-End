# Tasks: Opportunity Browser

**Feature Branch**: `008-opportunity-browser`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)
**Contracts**: [contracts/](./contracts/) | **Quickstart**: [quickstart.md](./quickstart.md)

---

## Multi-Agent Role Legend

Every task is labelled with the agent responsible for executing it:

| Label | Role | Constraint |
|:---:|:---|:---|
| `[EXEC]` | **Executor Agent** | Writes source code only. Never creates test files. |
| `[TEST]` | **Tester Agent** | Creates tests and reviews code only. Never modifies source files. |
| `[COORD]` | **Coordinator Agent** | Assigns tasks, verifies reports, confirms gates. Never writes code or tests. |

### Cycle Definition

Every task group (Executor block → Tester block) forms one **cycle**:

```
[COORD] Assigns task to Executor
    ↓
[EXEC]  Implements. Submits report: files created/modified + pnpm build + pnpm lint results.
    ↓
[COORD] Verifies report matches reality (checks files, runs build/lint independently).
    ↓
[TEST]  Creates tests + code review. Submits report: test results, any bugs with FR/EC/SC refs.
    ↓
[COORD] Reviews Tester report.
    ↓
    ├── Issues? → [COORD] assigns fix to Executor → cycle repeats for that task
    └── Clean?  → [COORD] closes task → next task begins
```

> ⚠️ **A human software engineer is monitoring all agent outputs. Quality is non-negotiable.**

---

## Format: `[ID] [P?] [Story?] [ROLE] Description`

- **[P]**: Parallelizable — can run simultaneously with other [P] tasks in the same phase
- **[Story]**: User story label (US1–US4)
- **[ROLE]**: Agent responsible for this task (`[EXEC]`, `[TEST]`, `[COORD]`)
- Every description includes exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment, config, and infrastructure wiring that all user stories depend on.

**⚠️ CRITICAL**: No user story phase can begin until Phase 1 is complete and its Tester gate passes.

### Task Group 1-A — AI Prisma Schema & Client Generation

> [COORD] Assigns to Executor.

-[x] T001 [EXEC] Create `prisma/ai-schema.prisma` — define `CleanedOpportunity` and `Source` models mirroring the AI service schema; set `output = "../node_modules/@prisma/ai-client"` in the generator block; set `provider = "prisma-client-js"` and `url = env("DATABASE_AIService_URL")` in the datasource block
-[x] T002 [EXEC] Add `"generate:ai": "prisma generate --schema=prisma/ai-schema.prisma"` script to `package.json`

> [COORD] Verifies: `prisma/ai-schema.prisma` exists; `generate:ai` script present in `package.json`.

> [TEST] Tester gate for 1-A: Not required — no runtime logic; Coordinator visual inspection is sufficient. Proceed to 1-B.

---

### Task Group 1-B — AiPrismaService & AiPrismaModule

> [COORD] Assigns to Executor.

-[x] T003 [EXEC] Create `src/modules/infrastructure/ai-prisma/ai-prisma.service.ts` — wraps the generated AI Prisma client; implements `OnModuleInit` (`$connect()`) and `OnModuleDestroy` (`$disconnect()`); injects `Logger` (scoped to `AiPrismaService`); exposes the Prisma client instance via a typed getter. The Prisma schema's `env()` call resolves the URL at the ORM layer; `AiPrismaService` MUST NOT access `process.env` or `ConfigService` directly.
-[x] T004 [EXEC] Create `src/modules/infrastructure/ai-prisma/ai-prisma.module.ts` — `@Global()` module; provides and exports `AiPrismaService`
-[x] T005 [EXEC] Register `AiPrismaModule` in `src/app.module.ts` imports array

> [COORD] Verifies: All three files exist; `pnpm build` exits 0; `pnpm lint` exits 0; `@Global()` present on module; no `process.env` in service file.

-[x] T006 [TEST] Write unit tests for `AiPrismaService` in `src/modules/infrastructure/ai-prisma/ai-prisma.service.spec.ts`:
  - `onModuleInit` calls `$connect()` exactly once
  - `onModuleDestroy` calls `$disconnect()` exactly once
  - Client getter returns the mocked Prisma instance
-[x] T007 [TEST] Code review of `ai-prisma.service.ts` and `ai-prisma.module.ts`:
  - Confirm no `console.*` calls (Logger used)
  - Confirm no `process.env` access
  - Confirm `@Global()` on module
  - Submit report to Coordinator with test results and review findings

> [COORD] Reviews Tester report. If issues → assign fix to Executor (T003–T005) → repeat from [COORD] verify. If clean → proceed to 1-C.

---

### Task Group 1-C — Environment Config Validation & Documentation

> [COORD] Assigns to Executor.

-[x] T008 [EXEC] Add `DATABASE_AIService_URL` to the startup config validation schema in `src/config/app.config.ts` (or equivalent validation class) as a required string — application must fail to start if absent
-[x] T009 [EXEC] Add `DATABASE_AIService_URL=postgresql://user:pass@host:5432/ai_db` with the comment `# External AI service database (read-only)` to `.env.example`
-[x] T010 [EXEC] Write ADR entry `DEC-OPP-01` in `docx/decisions-log.md` documenting the dual Prisma client decision: problem, decision, rationale (separate DB user, separate lifecycle, no migration ownership), and alternatives rejected (single schema multi-datasource, raw pg, prisma queryRaw)
-[x] T010b [EXEC] [P] Update `README.md` to document `DATABASE_AIService_URL` and the `pnpm generate:ai` step in the local setup section

> [COORD] Verifies: `DATABASE_AIService_URL` in config schema; `.env.example` updated; `DEC-OPP-01` entry in decisions log; README updated; `pnpm build` and `pnpm lint` pass.

-[x] T011 [TEST] Write a Jest integration test using `Test.createTestingModule()` that attempts to initialize `AppModule` with `DATABASE_AIService_URL` absent from the environment and asserts the bootstrap throws a config validation error (maps to ST-003)
-[x] T012 [TEST] Static review: grep `src/modules/infrastructure/ai-prisma/` for `process.env` — confirm zero occurrences; submit report

> [COORD] Reviews Tester report. If issues → fix cycle. If clean → **Phase 1 complete. Phase 2 may begin.**

---

**✅ Phase 1 Checkpoint**: `AiPrismaModule` is operational, env var is validated at startup, and ADR is written. All tests pass.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DTO layer and whitelist constants — shared by all user story phases.

**⚠️ CRITICAL**: Phase 3 (US1) and Phase 4 (US2) cannot begin until Phase 2 is complete and its Tester gate passes.

### Task Group 2-A — Whitelist Constants

> [COORD] Assigns to Executor.

-[x] T013 [EXEC] Create `src/modules/opportunities/dto/opportunity-fields.enum.ts` — export three `as const` arrays:
  - `OPPORTUNITY_FIELD_WHITELIST`: 18 field names from `data-model.md §Field Whitelist`
  - `OPPORTUNITY_DEFAULT_FIELDS`: 7 field names from `data-model.md §Default Field Set`
  - `OPPORTUNITY_SORT_WHITELIST`: 6 field names from `data-model.md §Sort Whitelist`

> [COORD] Verifies: File exists; FIELD_WHITELIST has exactly 18 entries; DEFAULT_FIELDS has 7; SORT_WHITELIST has 6; entries match `data-model.md` exactly; `pnpm build` and `pnpm lint` pass.

-[x] T014 [TEST] Unit tests for constants in `src/modules/opportunities/dto/opportunity-fields.enum.spec.ts`:
  - Assert `OPPORTUNITY_FIELD_WHITELIST.length === 18`
  - Assert `OPPORTUNITY_DEFAULT_FIELDS.length === 7`
  - Assert `OPPORTUNITY_SORT_WHITELIST.length === 6`
  - Spot-check 5 specific field names exist in each whitelist
  - Confirm all `OPPORTUNITY_DEFAULT_FIELDS` entries are also in `OPPORTUNITY_FIELD_WHITELIST`
  - Submit report

> [COORD] Reviews Tester report. If issues → fix cycle. If clean → proceed to 2-B.

---

### Task Group 2-B — ListOpportunitiesDto

> [COORD] Assigns to Executor.

-[x] T015 [EXEC] Create `src/modules/opportunities/dto/list-opportunities.dto.ts` — `ListOpportunitiesDto` class with all 13 query parameters from `contracts/list-opportunities.contract.md §Request Contract §Query Parameters`; apply correct `class-validator` decorators per each field's type and constraint; apply `@Type(() => Number)` for `page` and `limit`; apply `@Type(() => Boolean)` for `is_remote`; apply `@ApiPropertyOptional` for Swagger on each field

> [COORD] Verifies: All 13 params present; `@Type` decorators on `page`, `limit`, `is_remote`; `@ApiPropertyOptional` on all fields; `pnpm build` and `pnpm lint` pass.

-[x] T016 [TEST] Unit tests for `ListOpportunitiesDto` in `src/modules/opportunities/dto/list-opportunities.dto.spec.ts`:
  - Valid default (empty object) — passes validation
  - `limit=9999` — passes DTO validation (clamping is a service concern, not DTO)
  - `page=0` — fails with `@Min(1)` error
  - `is_remote="true"` — coerced to `true` (boolean)
  - `is_remote="false"` — coerced to `false` (boolean)
  - `source_id="not-a-uuid"` — fails `@IsUUID`
  - `deadline_from="not-a-date"` — fails `@IsDateString`
  - `q` longer than 500 chars — fails `@MaxLength(500)`
  - Extra unknown field — rejected by `ValidationPipe` (`forbidNonWhitelisted`)
  - Submit report

> [COORD] Reviews Tester report. If issues → fix cycle. If clean → **Phase 2 complete. Phases 3 and 4 may begin.**

---

**✅ Phase 2 Checkpoint**: DTO and whitelist constants are validated and ready. All user story phases can now proceed.

---

## Phase 3: User Story 1 — Browse & Filter Opportunities (Priority: P1) 🎯 MVP

**Goal**: A user can request a paginated, filtered, sorted list of opportunities and receive only the correct field set.

**Spec reference**: [spec.md §User Story 1](./spec.md) (12 acceptance scenarios) + [spec.md §User Story 2](./spec.md) (4 acceptance scenarios — keyword search is integral to the browse experience). *Note: US2 is merged here because its implementation (the `q` parameter) shares the service method and where-builder with US1. They can only be independently tested, not independently deployed.*

**Independent Test**: `GET /api/v1/opportunities` with no params returns 200 with paginated data and correct `meta`. Filters, sort, `q`, and field selection all work in isolation and combination.

---

### Task Group 3-A — OpportunitiesService (Core Query Logic)

> [COORD] Assigns to Executor.

-[x] T017 [EXEC] Create `src/modules/opportunities/opportunities.repository.ts` and `src/modules/opportunities/opportunities.service.ts`:
  - **Repository**: Inject `AiPrismaService`. Implement `findMany` calling Prisma `Promise.all([count, findMany])`. Wrap Prisma calls in try/catch; catch `PrismaClientInitializationError` → throw `ServiceUnavailableException('SERVICE_UNAVAILABLE')` and log via `Logger.error`.
  - **Service**: Inject `OpportunitiesRepository` and `Logger`. Implement `findMany(dto: ListOpportunitiesDto)` with JSDoc comment explaining intent, parameters, and return shape.
  - **Field selection**: parse `dto.fields` → split/trim → validate against `OPPORTUNITY_FIELD_WHITELIST` → throw `BadRequestException` with key `INVALID_FIELD` if any entry is unknown; use `OPPORTUNITY_DEFAULT_FIELDS` when `fields` omitted; use all 18 fields when `fields=*`; build Prisma `select` object as `Record<string, true>`
  - **Sort parsing**: parse `dto.sort` (default `created_at:desc`) → validate field against `OPPORTUNITY_SORT_WHITELIST` → throw `BadRequestException('INVALID_SORT_FIELD')`; validate direction → throw `BadRequestException('VALIDATION_ERROR')`
  - **Limit cap**: `Math.min(dto.limit ?? 20, 100)`
  - **Pagination**: `skip = (page - 1) * limit`, `take = limit`
  - **Date validation**: if both `deadline_from` and `deadline_to` present and `deadline_from > deadline_to` → throw `BadRequestException('INVALID_DATE_RANGE')`
  - **Where clause**: build incrementally per the mapping in `data-model.md §Prisma where Clause Mapping` — all 9 filter params including `hasSome` for array columns and `OR` + `mode: 'insensitive'` for `q`
  - **Meta**: `{ page, limit, total, pages: Math.ceil(total / limit) }`
  - *(Note: `findById` is deferred to Phase 4 / Task Group 4-A.)*

> [COORD] Verifies: `OpportunitiesRepository` created and used; public method signatures have JSDoc comments; all 9 filter params handled; `INVALID_FIELD`, `INVALID_SORT_FIELD`, `INVALID_DATE_RANGE` thrown correctly; `Promise.all` used (not sequential); limit cap present; `ServiceUnavailableException` on connection error; no `console.*`, no `process.env`; `pnpm build` and `pnpm lint` pass.

-[x] T018 [TEST] Write unit tests for `OpportunitiesService.findMany()` in `src/modules/opportunities/opportunities.service.spec.ts` with mocked `AiPrismaService`:
  - Default params → `skip=0`, `take=20`, `orderBy: { created_at: 'desc' }`, 7-field select (EC-001)
  - `limit=9999` → Prisma receives `take=100` (EC-002)
  - `page=99999` → returns empty data array + correct meta (EC-003)
  - `sort=forbidden:asc` → throws `BadRequestException` with `INVALID_SORT_FIELD` (EC-004)
  - `sort=title:sideways` → throws `BadRequestException` with `VALIDATION_ERROR` (EC-005)
  - `fields=not_real` → throws `BadRequestException` with `INVALID_FIELD` (EC-006)
  - `fields=*` → Prisma select has exactly 18 keys (EC-007)
  - `fields` omitted → Prisma select has exactly 7 keys (EC-008)
  - `deadline_from=2027-01-01`, `deadline_to=2026-01-01` → throws `BadRequestException` with `INVALID_DATE_RANGE` (EC-009)
  - `study_levels=Master,PhD` → where clause contains `{ study_levels: { hasSome: ['Master', 'PhD'] } }` (EC-012)
  - `fields_of_study=CS,Math` → where clause contains `{ fields_of_study: { hasSome: ['CS', 'Math'] } }` (EC-012)
  - `q=master` → where clause contains `OR` with `contains: 'master'` + `mode: 'insensitive'` on title and description (EC-014)
  - `q="  master  "` → whitespace stripped before query (EC-014)
  - `q` matches nothing → returns `{ data: [], meta: { total: 0, pages: 0 } }` (EC-015)
  - `country=Egypt&opportunity_type=scholarship` → both conditions in where clause (EC-013)
  - Prisma throws `PrismaClientInitializationError` → `ServiceUnavailableException` thrown (EC-024, ST-011)
  - Submit report with all test names, results, and coverage percentage for `opportunities.service.ts`

> [COORD] Reviews Tester report. Service coverage must be ≥ 80%. If issues → fix cycle. If clean → proceed to 3-B.

---

### Task Group 3-B — OpportunitiesController (List Endpoint) & Module

> [COORD] Assigns to Executor.

-[x] T018 [EXEC] Create `src/modules/opportunities/opportunities.controller.ts` — implement `GET /` endpoint:
  - `@Get()`, `@Public()` (bypasses JWT guard), `@ApiTags('Opportunities')`, `@ApiOperation({ summary: 'List opportunities' })`
  - `@ApiResponse({ status: 200 })`, `@ApiResponse({ status: 400 })`, `@ApiResponse({ status: 503 })`
  - Accepts `@Query() dto: ListOpportunitiesDto`
  - Calls `OpportunitiesService.findMany(dto)` and returns response via existing response interceptor
-[x] T020 [EXEC] Create `src/modules/opportunities/opportunities.module.ts` — declares `OpportunitiesController`; provides and exports `OpportunitiesService`; imports nothing extra (relies on global `AiPrismaModule`)
-[x] T021 [EXEC] Register `OpportunitiesModule` in `src/app.module.ts` imports array

> [COORD] Verifies: `@Public()` present on `GET /`; no auth guard applied; `OpportunitiesModule` in `AppModule`; `pnpm build` and `pnpm lint` pass; Swagger UI shows the endpoint at `/api/v1/opportunities`.

-[x] T022 [TEST] Write E2E tests in `test/opportunities.e2e-spec.ts` for the list endpoint (AI Prisma client mocked at module level):
  - No params → `200`, response has `data: []` (fixture returns empty), `meta` object present with `page`, `limit`, `total`, `pages` (FR-001, FR-002, FR-008)
  - `fields=id,title,deadline` → each item has exactly 3 keys (FR-011, EC-007 variant)
  - `fields=*` → each item has exactly 18 keys (EC-007)
  - No `fields` → each item has exactly 7 keys (EC-008, FR-014)
  - `sort=invalid_field:asc` → `400`, `error: "INVALID_SORT_FIELD"` (EC-004)
  - `sort=title:sideways` → `400`, `error: "VALIDATION_ERROR"` (EC-005)
  - `fields=nonexistent` → `400`, `error: "INVALID_FIELD"` (EC-006)
  - `deadline_from=2027-01-01&deadline_to=2026-01-01` → `400`, `error: "INVALID_DATE_RANGE"` (EC-009)
  - `page=abc` → `400`, `error: "VALIDATION_ERROR"` (EC-018)
  - `is_remote=true` (string) → `200` (boolean coercion works) (EC-017)
  - Request **without** Authorization header → `200` (ST-001, EC-029)
  - Request **with** a valid Bearer token → `200` (token ignored, not rejected) (EC-029)
  - Mock AI DB failure → `503`, `error: "SERVICE_UNAVAILABLE"` (EC-024, ST-011)
  - Response body on any success → no `rawOpportunityId`, `status`, `errorMessage`, `contentHash` fields (ST-008)
  - Submit report with all E2E test results
-[x] T023 [TEST] [P] Code review of `opportunities.controller.ts`:
  - Confirm `@Public()` on `GET /` — no auth guard
  - Confirm all `@ApiResponse` decorators present
  - Confirm no business logic in controller (service call only)
  - Submit review findings in same report as T022

> [COORD] Reviews combined Tester report. If issues → fix cycle. If clean → **Phase 3 (US1+US2) complete.**

---

**✅ Phase 3 Checkpoint**: `GET /api/v1/opportunities` is fully functional, tested, and reviewed. US1 and US2 acceptance scenarios are covered.

---

## Phase 4: User Story 3 & 4 — Opportunity Detail & Field Selection (Priority: P2 / P3)

**Goal**: A user can view the full details of a single opportunity by ID; API consumers can limit returned fields on both endpoints.

**Spec reference**: [spec.md §User Story 3](./spec.md) (4 acceptance scenarios) + [spec.md §User Story 4](./spec.md) (4 acceptance scenarios)

**Independent Test**: `GET /api/v1/opportunities/:id` with a valid UUID returns 200 with all 18 fields. Non-existent ID returns 404. Malformed UUID returns 400. `fields` parameter works on detail endpoint with same whitelist enforcement as list.

---

### Task Group 4-A — findById Service Method

> [COORD] Assigns to Executor.

-[x] T024 [EXEC] Add `findById(id: string, fields?: string)` method to `src/modules/opportunities/opportunities.service.ts`:
  - **Field selection**: same logic as `findMany` — parse and validate `fields`; default is all 18 whitelisted fields (not the 7-field summary)
  - **Query**: `prisma.cleanedOpportunity.findUnique({ where: { id }, select })`
  - **Not found**: if result is `null` → throw `NotFoundException` with message `"Opportunity not found"` and key `OPPORTUNITY_NOT_FOUND`
  - **503 mapping**: same catch block as `findMany` — `PrismaClientInitializationError` → `ServiceUnavailableException`

> [COORD] Verifies: `findById` added (not a new file); 404 thrown on null result; `INVALID_FIELD` thrown for unknown fields; 503 mapping present; no `console.*`; `pnpm build` and `pnpm lint` pass.

-[x] T025 [TEST] Extend unit tests in `src/modules/opportunities/opportunities.service.spec.ts` for `findById()`:
  - Valid ID, Prisma returns record → record returned with all 18 fields (EC-018, FR-015)
  - Valid ID, `fields=id,title` → select has 2 keys (EC-022)
  - Valid ID, `fields=forbidden` → throws `BadRequestException` with `INVALID_FIELD` (EC-022)
  - Valid ID, `fields=*` → select has 18 keys (EC-022)
  - Prisma returns `null` → throws `NotFoundException` with `OPPORTUNITY_NOT_FOUND` (EC-020, FR-016)
  - Prisma throws `PrismaClientInitializationError` → `ServiceUnavailableException` (EC-024)
  - Re-run coverage report — confirm coverage still ≥ 80%
  - Submit report

> [COORD] Reviews Tester report. If issues → fix cycle. If clean → proceed to 4-B.

---

### Task Group 4-B — Detail Endpoint on Controller

> [COORD] Assigns to Executor.

-[x] T026 [EXEC] Add `GET /:id` endpoint to `src/modules/opportunities/opportunities.controller.ts`:
  - `@Get(':id')`, `@Public()`, `@ApiOperation({ summary: 'Get opportunity by ID' })`
  - `@ApiResponse({ status: 200 })`, `@ApiResponse({ status: 400 })`, `@ApiResponse({ status: 404 })`, `@ApiResponse({ status: 503 })`
  - `@Param('id', ParseUUIDPipe) id: string` — `ParseUUIDPipe` rejects malformed UUIDs before service is called
  - `@Query('fields') fields?: string`
  - Calls `OpportunitiesService.findById(id, fields)` and returns via response interceptor

> [COORD] Verifies: `@Public()` and `ParseUUIDPipe` present; `@ApiResponse(404)` present; `pnpm build` and `pnpm lint` pass.

-[x] T027 [TEST] Extend E2E tests in `test/opportunities.e2e-spec.ts` for the detail endpoint:
  - Valid UUID, Prisma returns fixture → `200`, `data` has 18 keys (EC-018, FR-015)
  - `fields=id,title` on detail → `200`, `data` has exactly 2 keys (EC-022)
  - `fields=forbidden` on detail → `400`, `error: "INVALID_FIELD"` (EC-022, FR-012)
  - Valid UUID not found (Prisma returns null) → `404`, `error: "OPPORTUNITY_NOT_FOUND"` (EC-020, FR-016)
  - `id="not-a-uuid"` → `400`, `error: "VALIDATION_ERROR"` (ParseUUIDPipe fires) (EC-021)
  - `id="00000000-0000-0000-0000-000000000000"` (valid UUID, not found) → `404` (EC-020)
  - Request without Authorization header → `200` (ST-001)
  - Mock AI DB failure → `503`, `error: "SERVICE_UNAVAILABLE"` (EC-024, ST-011)
  - Response body → no internal AI service fields (`rawOpportunityId`, `status`, etc.) (ST-008)
  - Submit report with all E2E results
-[x] T028 [TEST] [P] Code review of updated `opportunities.controller.ts`:
  - Confirm `ParseUUIDPipe` applied to `:id` param (not just `@IsUUID`)
  - Confirm `@Public()` on both endpoints
  - Confirm no business logic in controller
  - Submit findings in same report as T027

> [COORD] Reviews combined Tester report. If issues → fix cycle. If clean → **Phase 4 (US3+US4) complete.**

---

**✅ Phase 4 Checkpoint**: `GET /api/v1/opportunities/:id` is fully functional, tested, and reviewed. US3 and US4 acceptance scenarios are covered.

---

## Phase 5: Polish & Final Production Gate

**Purpose**: Full test suite, security sweep, documentation, and production readiness confirmation.

**⚠️ This phase is entirely Tester-owned (plus Coordinator). Executor only re-engages if the Tester finds issues.**

### Task Group 5-A — Full Test Suite Run

> [COORD] Assigns to Tester.

-[x] T029 [TEST] Run `pnpm test` — capture output; confirm all unit tests pass; confirm `opportunities.service.spec.ts` coverage ≥ 80%; save output to `test-reports/$(date +%Y-%m-%d)/unit.txt`
-[x] T030 [TEST] Run `pnpm test:e2e` — capture output; confirm all E2E tests in `test/opportunities.e2e-spec.ts` pass; save output to `test-reports/$(date +%Y-%m-%d)/e2e.txt`
-[x] T031 [TEST] Run `pnpm build` — confirm zero TypeScript errors; record result
-[x] T032 [TEST] Run `pnpm lint` — confirm zero lint errors; record result

> [COORD] Reviews build/test evidence. If any gate fails → identify which task group owns the failing code → re-open that phase's fix cycle. If all pass → proceed to 5-B.

---

### Task Group 5-B — Security & Edge Case Sweep

> [COORD] Assigns to Tester.

-[x] T033 [TEST] Execute security test register from `quality-and-security.md §4` — run ST-001 through ST-011 and record pass/fail for each
-[x] T034 [TEST] [P] Verify EC coverage — map each of the 30 edge cases (EC-001 through EC-030) from `quality-and-security.md §1` to a passing test case; produce a coverage table: `EC-ID | Test Name | Status`
-[x] T035 [TEST] [P] Static security grep across the new module:
  - `grep -r "process\.env" src/modules/opportunities/ src/modules/infrastructure/ai-prisma/` → must return zero matches
  - `grep -r "console\." src/modules/opportunities/ src/modules/infrastructure/ai-prisma/` → must return zero matches
  - `grep -r "rawOpportunityId\|errorMessage\|contentHash" src/modules/opportunities/` → must return zero matches in response-shaping code
  - Record results

> [COORD] Reviews security report and EC coverage table. If any ST or EC item fails → identify responsible task → re-open fix cycle. If all pass → proceed to 5-C.

---

### Task Group 5-C — Documentation & ADR Confirmation

> [COORD] Assigns to Executor.

-[x] T036 [COORD] Coordinator confirms `DEC-OPP-01` in `docx/decisions-log.md` contains all required fields: problem statement, decision, rationale, alternatives rejected, and date. If incomplete, re-open T010 fix cycle.
-[x] T037 [TEST] [P] Run `pnpm generate:ai` once more in CI context — confirm generated client compiles cleanly with `pnpm build`
-[x] T038 [TEST] [P] Verify `quickstart.md` Scenario 14 (startup-without-env) works as documented — run and record output

> [COORD] Verifies all three items. `pnpm build` must still pass after T037. If issues → fix cycle. If clean → proceed to 5-D.

---

### Task Group 5-D — Final Coordinator Sign-Off

> [COORD] Only.

-[x] T039 [COORD] Collect all Tester reports from Phases 1–5; confirm every item in the `plan.md §Task 5 Acceptance Gate` checklist is green:
  - `pnpm build` ✅ (T031)
  - `pnpm lint` ✅ (T032)
  - `pnpm test` — all pass, ≥ 80% service coverage ✅ (T029)
  - `pnpm test:e2e` — all pass ✅ (T030)
  - ST-001 through ST-011 — all pass ✅ (T033)
  - EC-001 through EC-030 — all covered ✅ (T034)
  - Zero `process.env` in new module source files ✅ (T035)
  - Zero `console.*` in new module source files ✅ (T035)
  - No raw Prisma internal fields in any response ✅ (T035)
  - `DEC-OPP-01` ADR written ✅ (T036)
  - `.env.example` updated ✅ (T009)
  - *(Note: Performance SC-001 and SC-002 are deferred to a future spike and are not verified in this iteration.)*
-[x] T040 [COORD] Declare feature production-ready. File a Conventional Commit message: `feat(opportunities): implement public opportunity browser module`

---

**✅ Phase 5 Checkpoint**: All gates green. Feature is production-ready.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ──────────────────────────────────────────────── Must complete first
    │
    └──► Phase 2 (Foundational) ──────────────────────────── Must complete before US phases
             │
             ├──► Phase 3 (US1+US2 — Browse & Search) P1 ── MVP: deliver here
             │
             └──► Phase 4 (US3+US4 — Detail & Fields)  P2/P3
                       │
                       └──► Phase 5 (Polish & Gate) ──────── Final gate
```

### Within-Phase Task Group Dependencies

| Task Group | Depends On |
|:---|:---|
| 1-A (Schema) | — |
| 1-B (AiPrismaService) | 1-A complete |
| 1-C (Config + ADR) | 1-B Tester gate passes |
| 2-A (Constants) | Phase 1 complete |
| 2-B (DTO) | 2-A Tester gate passes |
| 3-A (Service findMany) | Phase 2 complete |
| 3-B (Controller list + Module) | 3-A Tester gate passes |
| 4-A (Service findById) | 3-B Tester gate passes |
| 4-B (Controller detail) | 4-A Tester gate passes |
| 5-A–D (Polish) | Phase 4 complete |

### Parallel Opportunities Within Task Groups

Within each task group, tasks marked `[P]` can be executed simultaneously by the Tester agent (e.g., T022 + T023 run in parallel, T034 + T035 run in parallel).

---

## Parallel Agent Execution Example — Phase 3, Task Group 3-B

```
Tester receives Coordinator assignment for 3-B:

  Parallel stream 1: [TEST] T022 — E2E tests for list endpoint
  Parallel stream 2: [TEST] T023 [P] — Code review of controller

Both streams complete → Tester merges findings into one report → sends to Coordinator
```

---

## Implementation Strategy

### MVP First (Phase 1 + 2 + 3)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational) — foundation ready
2. Complete Phase 3 (US1+US2) — `GET /api/v1/opportunities` list is fully functional
3. **STOP and VALIDATE**: Run quickstart.md Scenarios 1–9 manually
4. Demo / integrate with frontend if ready — MVP delivered

### Incremental Delivery

1. Phase 1 + 2 → Foundation ✅
2. Phase 3 → Browse & Search live ✅
3. Phase 4 → Detail + field selection live ✅
4. Phase 5 → Production sign-off ✅

### Agent Assignment Per Phase

```
Phase 1:  Coordinator  →  Executor (T001–T005, T008–T010)  →  Tester (T006–T007, T011–T012)
Phase 2:  Coordinator  →  Executor (T013, T015)            →  Tester (T014, T016)
Phase 3:  Coordinator  →  Executor (T017, T018–T021)       →  Tester (T018, T022–T023)
Phase 4:  Coordinator  →  Executor (T024, T026)            →  Tester (T025, T027–T028)
Phase 5:  Coordinator  →  Tester   (T029–T035)             →  Executor if issues (T036–T038)  →  Coordinator (T039–T040)
```

---

## Notes

- `[P]` = different files, no intra-group dependency — safe to assign to parallel sub-streams
- `[EXEC]` tasks must never contain test files
- `[TEST]` tasks must never modify source files — only create/update `*.spec.ts` and `*.e2e-spec.ts` files
- `[COORD]` tasks produce no code or tests — only assignments, verifications, and reports
- Each Coordinator verification **independently** confirms files exist and `pnpm build`/`pnpm lint` pass — the Executor's self-reported status is not accepted as proof
- Every Tester report must reference specific FR, EC, or SC identifiers from `spec.md` and `quality-and-security.md`
- Commit after each completed and verified task group (Conventional Commits format)
- A human software engineer reviews all agent outputs — accuracy and quality take priority over speed
