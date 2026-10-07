# Implementation Plan: Opportunity Browser

**Branch**: `008-opportunity-browser` | **Date**: 2026-09-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-opportunity-browser/spec.md`

---

## Summary

Expose two read-only, public REST endpoints (`GET /api/v1/opportunities` and `GET /api/v1/opportunities/:id`) that query a pre-cleaned opportunity dataset maintained by an external AI service in a separate PostgreSQL database. The backend connects to that database via a second, isolated Prisma client (read-only DB user). All filtering, pagination, sorting, and field selection logic lives in the application service layer. No writes are ever issued to the external database.

---

## Technical Context

| Item | Value |
|:---|:---|
| **Language / Runtime** | TypeScript (strict mode) · Node.js LTS |
| **Framework** | NestJS |
| **Primary Database** | PostgreSQL — main app DB (Prisma, managed migrations) |
| **External Database** | PostgreSQL — AI service DB (`DATABASE_AIService_URL`, read-only, no migrations from this service) |
| **ORM / Query** | Prisma — dual-client setup (main client + AI service client with separate generated output path) |
| **Validation** | `class-validator` + `class-transformer` (Global `ValidationPipe`) |
| **Testing** | Jest (unit) · Jest + Supertest (E2E/integration) |
| **Target Platform** | Linux server |
| **Project Type** | Web service — REST API (NestJS modular) |
| **Performance Goals** | SC-001: list endpoint < 500 ms p95 · SC-002: detail endpoint < 300 ms p95 |
| **Constraints** | External DB is read-only (SELECT-only DB user) · No Prisma migrations against AI service schema · No authentication required (both endpoints public) · `limit` silently clamped to 100 |
| **Scale / Scope** | Single new NestJS module · 2 controller endpoints · 1 service · 1 infrastructure service (AiPrismaService) |

---

## Constitution Check

_GATE: Must pass before any implementation task is assigned._

| Rule (Constitution §) | Status | Notes |
|:---|:---:|:---|
| Modular architecture — Controller → Service → Repository flow | ✅ | `OpportunitiesController` → `OpportunitiesService` → `AiPrismaService` |
| No business logic in Controllers | ✅ | All query-builder logic lives in `OpportunitiesService` |
| DI via Constructor only | ✅ | All services injected via constructor |
| `ConfigService` for all env vars — no `process.env` in services | ✅ | `DATABASE_AIService_URL` read only via `ConfigService` at module init |
| Config validated at startup (fail-fast) | ✅ | `DATABASE_AIService_URL` validated in `AppConfig` validation schema |
| `class-validator` DTOs with `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`) | ✅ | `ListOpportunitiesDto` and path-param pipe for `:id` |
| UUID primary keys | ✅ | Inherited from AI service schema; enforced in ParseUUIDPipe |
| `HttpException` typed errors only — no generic `throw Error` | ✅ | `BadRequestException`, `NotFoundException`, `ServiceUnavailableException` |
| `Logger` service — no `console.log` | ✅ | `AiPrismaService` and `OpportunitiesService` use NestJS `Logger` |
| `GlobalExceptionFilter` uniform envelope | ✅ | Existing filter — no modification needed |
| Unit tests · integration tests for all endpoints | ✅ | Task 5 (Tester-owned). *Note: ≥ 80% coverage is a project goal, not a constitution rule.* |
| `pnpm build`, `pnpm lint`, `pnpm test` gates pass before task is marked done | ✅ | Coordinator verifies each gate after Executor report |
| Conventional Commits | ✅ | Enforced by Husky |
| ADR required for dual Prisma client decision | ✅ | Task 1 includes ADR entry in `docx/decisions-log.md` |
| `.env.example` updated for new env var | ✅ | Task 1 includes `.env.example` update |
| Public API endpoints decorated with `@ApiOperation`, `@ApiResponse`, `@ApiProperty` | ✅ | Task 4 |

**Constitution violations:** None. No Complexity Tracking section required.

---

## Multi-Agent Workflow

This plan is structured for **three roles** executing tasks **sequentially**. Each task passes through the following cycle before the next task begins:

```
Coordinator assigns task
      ↓
Executor implements (no tests)
      ↓
Coordinator verifies (checks files exist, build passes, lint passes)
      ↓
Tester creates tests + code review (no source modifications)
      ↓
Coordinator receives Tester report
      ↓
  ┌── Issues found? ──────────── Yes ──→ Coordinator assigns fix to Executor
  │                                              ↓
  │                                   Coordinator verifies fix
  │                                              ↓
  │                                   Tester re-verifies
  │                                              ↑
  └──────────────────────────────────────────────┘
        No issues → Coordinator closes task → next task begins
```

### Role Constraints

| Role | Can Write Source Code | Can Write Tests | Can Modify Source to Fix Bugs |
|:---:|:---:|:---:|:---:|
| **Coordinator** | ❌ | ❌ | ❌ |
| **Executor** | ✅ | ❌ | ✅ |
| **Tester** | ❌ | ✅ | ❌ |

### Agent Objectives

- **Coordinator** — Ensures complete, high-quality task delivery by delegating to Executor/Tester and verifying their work against the spec, endpoints.md, quality-and-security.md, and this plan. Closes a task only when all gates pass and the Tester confirms no issues.
- **Executor** — Implements assigned source code following AGENTS.md architecture rules, this plan's structure, and the Constitution. Submits a report listing every file created/modified and the result of `pnpm build` + `pnpm lint`.
- **Tester** — Writes unit and integration tests for assigned scope. Reviews Executor's code for correctness, security, and spec compliance. Submits a report listing all test results, any identified bugs with root-cause analysis, and references to the failing FR/EC/SC item.

> A human software engineer is monitoring all three agents' outputs and reviewing their work. Quality and spec compliance are non-negotiable.
 
### Task Mapping Reference
 
| plan.md Summary Task | tasks.md Execution Phase & Group |
|:---|:---|
| Task 1 — Infrastructure | Phase 1 (Groups 1-A, 1-B, 1-C) |
| Task 2 — DTO Layer | Phase 2 (Groups 2-A, 2-B) |
| Task 3 — Service | Phase 3 (Group 3-A) |
| Task 4 — Controller & Details | Phase 3 (Group 3-B), Phase 4 (Groups 4-A, 4-B) |
| Task 5 — Final Gate | Phase 5 (Groups 5-A, 5-B, 5-C, 5-D) |

---

## Project Structure

### Documentation (this feature)

```text
specs/008-opportunity-browser/
├── spec.md                  # Feature specification
├── endpoints.md             # Full endpoint documentation
├── quality-and-security.md  # Edge cases, testing strategy, security controls & tests
├── plan.md                  # This file
├── research.md              # Phase 0 — architectural decisions
├── data-model.md            # Phase 1 — entity model (read-only)
├── contracts/               # Phase 1 — DTO and response contracts
│   ├── list-opportunities.contract.md
│   └── opportunity-detail.contract.md
├── quickstart.md            # Phase 1 — validation run guide
└── tasks.md                 # Phase 2 (/speckit-tasks output — NOT created here)
```

### Source Code Layout (this feature)

```text
src/
├── modules/
│   ├── infrastructure/
│   │   └── ai-prisma/
│   │       ├── ai-prisma.module.ts        # Global module exporting AiPrismaService
│   │       └── ai-prisma.service.ts       # Wraps the AI Prisma client lifecycle
│   └── opportunities/
│       ├── opportunities.module.ts
│       ├── opportunities.controller.ts
│       ├── opportunities.service.ts
│       └── dto/
│           ├── list-opportunities.dto.ts
│           └── opportunity-fields.enum.ts  # Field + sort whitelists as enums/constants
├── config/
│   └── app.config.ts                      # Add DATABASE_AIService_URL validation

prisma/
├── schema.prisma                          # Main app schema (unchanged)
└── ai-schema.prisma                       # AI service schema (read-only client, new)

test/
└── opportunities.e2e-spec.ts              # E2E tests (Tester-owned, Task Groups 3-B and 4-B)

docx/
└── decisions-log.md                       # ADR entry: DEC-OPP-01 (Task 1)

.env.example                               # Add DATABASE_AIService_URL entry (Task 1)
```

---

## Tasks

> **Note**: Authoritative task detail is in `tasks.md`. The task descriptions below are a summary view for the Coordinator.
> 
> Tasks are executed sequentially. Each task must complete its full Coordinator → Executor → Tester cycle before the next begins.

---

### Task 1 — Infrastructure: Dual Prisma Client & Environment Setup

**Assigned by Coordinator to**: Executor

**Scope**:
1. Create `prisma/ai-schema.prisma` — mirrors the AI service `CleanedOpportunity` and `Source` models (read-only view; no migrations generated from this repo). Set `output` to `node_modules/@prisma/ai-client` so it does not overwrite the main client.
2. Add `generate:ai` script to `package.json`: `prisma generate --schema=prisma/ai-schema.prisma`.
3. Create `src/modules/infrastructure/ai-prisma/ai-prisma.service.ts` — wraps the generated AI Prisma client; implements `onModuleInit` (connect) and `onModuleDestroy` (disconnect); exposes the client instance. The Prisma schema's `env()` call resolves the URL at the ORM layer. `AiPrismaService` MUST NOT access `process.env` or `ConfigService` directly.
4. Create `src/modules/infrastructure/ai-prisma/ai-prisma.module.ts` — marks module as `@Global()` and exports `AiPrismaService`.
5. Add `AiPrismaModule` to `AppModule` imports.
6. Add `DATABASE_AIService_URL` to the startup config validation schema in `src/config/app.config.ts` (fail-fast if absent).
7. Add `DATABASE_AIService_URL=postgresql://user:pass@host:5432/ai_db` (with descriptive comment) to `.env.example`.
8. Write ADR entry `DEC-OPP-01` in `docx/decisions-log.md` documenting the dual Prisma client decision (rationale: separate DB user, separate lifecycle, no migration ownership).

**Executor must NOT**:
- Write any tests.
- Issue any migration commands against the AI service database.
- Write any business logic in this task.

**Coordinator Verification Checklist**:
- [ ] `prisma/ai-schema.prisma` exists and `output` path is `node_modules/@prisma/ai-client`
- [ ] `pnpm build` passes with zero TypeScript errors
- [ ] `pnpm lint` passes with zero errors
- [ ] `AiPrismaService` has both `onModuleInit` and `onModuleDestroy`
- [ ] `DATABASE_AIService_URL` validated at startup (not optional in config schema)
- [ ] `.env.example` updated
- [ ] `DEC-OPP-01` ADR entry written

**Tester Scope**:
- Unit test: `AiPrismaService` calls `$connect()` on `onModuleInit` and `$disconnect()` on `onModuleDestroy`.
- Integration test: Starting the application without `DATABASE_AIService_URL` fails descriptively (ST-003).
- Review: Confirm no `process.env` access inside the service; confirm `Logger` is used.

**Task 1 Acceptance Gate**: Coordinator receives Tester report with all tests passing and no issues found (or all issues fixed and re-verified by Tester).

---

### Task 2 — DTO Layer: Query Parameter Validation

**Assigned by Coordinator to**: Executor

**Prerequisite**: Task 1 complete.

**Scope**:
1. Create `src/modules/opportunities/dto/list-opportunities.dto.ts` — `ListOpportunitiesDto` class with all 13 query parameters from `endpoints.md §1 Query Parameters`. Apply correct `class-validator` decorators: `@IsOptional`, `@IsInt`, `@Min`, `@IsString`, `@MaxLength`, `@IsBoolean`, `@IsDateString`, `@IsUUID`, `@IsEnum`. Use `@Type(() => Number)` / `@Type(() => Boolean)` for type coercion.
2. Create `src/modules/opportunities/dto/opportunity-fields.enum.ts` — export:
   - `OPPORTUNITY_FIELD_WHITELIST`: `readonly string[]` of all 18 allowed field names (from `endpoints.md` Domain Rules table).
   - `OPPORTUNITY_SORT_WHITELIST`: `readonly string[]` of the 6 allowed sort fields.
   - `OPPORTUNITY_DEFAULT_FIELDS`: `readonly string[]` of the 7 default list fields.
3. Add custom `@IsWhitelistedFields()` validator (or inline logic in the service) to reject unknown `fields` values — this is enforced at the service layer not the DTO layer, but the DTO must accept the raw `fields` string for forwarding.
4. Add custom `@IsValidSort()` validator or document that sort validation happens in the service layer.

**Executor must NOT**:
- Write any tests.
- Write the service or controller.

**Coordinator Verification Checklist**:
- [ ] All 13 query params present in `ListOpportunitiesDto` with correct types and validators
- [ ] `OPPORTUNITY_FIELD_WHITELIST` contains exactly 18 entries matching `endpoints.md`
- [ ] `OPPORTUNITY_SORT_WHITELIST` contains exactly 6 entries matching `endpoints.md`
- [ ] `OPPORTUNITY_DEFAULT_FIELDS` contains exactly 7 entries matching `endpoints.md`
- [ ] `pnpm build` and `pnpm lint` pass

**Tester Scope**:
- Unit tests for `ListOpportunitiesDto`: valid values accepted, invalid types rejected, boolean coercion (`"true"` → `true`), integer coercion, `@IsUUID` rejection for malformed `source_id`.
- Unit tests for the whitelist constants: spot-check 5 fields present, confirm no typos.
- Review: Confirm `@Type` decorators are present for numeric and boolean fields (required for `class-transformer` coercion with `transformOptions`).

**Task 2 Acceptance Gate**: All DTO validation tests pass; Tester confirms no issues.

---

### Task 3 — Service: Query Builder & Business Logic

**Assigned by Coordinator to**: Executor

**Prerequisite**: Task 2 complete.

**Scope**:
1. Create `src/modules/opportunities/opportunities.repository.ts` — `OpportunitiesRepository` class to encapsulate Prisma queries.
   - Inject `AiPrismaService` via constructor.
   - Implement `findMany` method: performs the Prisma `count` and `findMany` operations using `Promise.all`.
   - Wrap Prisma calls in try/catch; catch `PrismaClientInitializationError` → throw `ServiceUnavailableException('SERVICE_UNAVAILABLE')` and log via `Logger.error`.
2. Create `src/modules/opportunities/opportunities.service.ts`:
   - Inject `OpportunitiesRepository` via constructor.
   - Implement `findMany(dto: ListOpportunitiesDto): Promise<{ data: Partial<CleanedOpportunity>[]; meta: PaginationMeta }>` — orchestrates validation and calls the repository.
3. Inside `OpportunitiesService.findMany`:
   - **Field selection**: Parse `dto.fields` (split by comma, trim). If `*`, use all 19 whitelist fields. If absent, use the 7 default fields. If any parsed name is not in the whitelist, throw `BadRequestException` with error key `INVALID_FIELD`.
   - **Sort parsing**: Parse `dto.sort` (`field:direction`). Validate field against sort whitelist → `BadRequestException('INVALID_SORT_FIELD')` if invalid. Validate direction → `BadRequestException('VALIDATION_ERROR')` if not `asc`/`desc`.
   - **Limit cap**: `Math.min(dto.limit ?? 20, 100)`.
   - **Pagination**: `skip = (page - 1) * limit`, `take = limit`.
   - **Where clause**: Build from optional DTO fields — `country`, `opportunity_type`, `funding_type`, `is_remote` (boolean), `deadline_from`/`deadline_to` (date range via `gte`/`lte`), `source_id` (exact UUID), `study_levels` (`hasSome`), `fields_of_study` (`hasSome`), `q` (case-insensitive `contains` on `title` OR `description`).
   - **Date validation**: If both `deadline_from` and `deadline_to` are present and `deadline_from > deadline_to`, throw `BadRequestException('INVALID_DATE_RANGE')`.
   - **Meta**: `{ page, limit, total, pages: Math.ceil(total / limit) }`.
*(Note: `findById` is deferred to Phase 4 / Task 4.)*

**Executor must NOT**:
- Write any tests.
- Modify `AiPrismaService` or DTOs.

**Coordinator Verification Checklist**:
- [ ] `OpportunitiesRepository` created and injected into `OpportunitiesService`
- [ ] `findMany` implements all 9 filter params correctly (per `endpoints.md` business rules)
- [ ] `BadRequestException` thrown with correct error keys for `INVALID_FIELD`, `INVALID_SORT_FIELD`, `INVALID_DATE_RANGE`
- [ ] `ServiceUnavailableException` thrown on Prisma connection failure
- [ ] `Promise.all` used for count + data (not sequential awaits)
- [ ] `limit` cap (100) enforced
- [ ] Public method signatures (`findMany`) have JSDoc comments covering intent, parameters, and return shape
- [ ] No `process.env` access; `Logger` used (not `console`)
- [ ] `pnpm build` and `pnpm lint` pass

**Tester Scope**:
- Unit tests with mocked `AiPrismaService` (all Prisma methods mocked):
  - Default params → correct `skip=0`, `take=20`, default select, `orderBy: { created_at: 'desc' }`.
  - `limit=9999` → clamped to 100 (EC-002).
  - `page=999` beyond last page → empty data + correct meta (EC-003).
  - `sort=invalid_field:asc` → `INVALID_SORT_FIELD` (EC-004).
  - `sort=title:sideways` → `VALIDATION_ERROR` (EC-005).
  - `fields=nonexistent` → `INVALID_FIELD` (EC-006).
  - `fields=*` → all 18 fields in select (EC-007).
  - `deadline_from` > `deadline_to` → `INVALID_DATE_RANGE` (EC-009).
  - `study_levels=Master,PhD` → `hasSome: ['Master', 'PhD']` in where (EC-012).
  - `q=master` → `contains: 'master'` on title AND description with OR (EC-014).
  - Prisma throws `PrismaClientInitializationError` → `ServiceUnavailableException` (EC-024, ST-011).
  - Non-existent ID in `findById` → `NotFoundException` (EC-020).
- Review: Confirm no SQL injection via raw query; confirm no writes.

**Task 3 Acceptance Gate**: All service unit tests pass; Tester confirms no issues in code review.

---

### Task 4 — Controller, Module & Swagger Decoration

**Assigned by Coordinator to**: Executor

**Prerequisite**: Task 3 complete.

**Scope**:
1. Create `src/modules/opportunities/opportunities.controller.ts`:
   - `@Controller('opportunities')` · `@ApiTags('Opportunities')`
   - `GET /` — `@Get()`, `@Public()` decorator (bypasses JWT guard), `@ApiOperation`, `@ApiResponse(200)`, `@ApiResponse(400)`, `@ApiResponse(503)`. Accepts `@Query() dto: ListOpportunitiesDto`. Calls `OpportunitiesService.findMany(dto)`. Returns standard response envelope.
   - `GET /:id` — `@Get(':id')`, `@Public()`, decorated. Accepts `@Param('id', ParseUUIDPipe) id: string` and `@Query('fields') fields?: string`. Calls `OpportunitiesService.findById(id, fields)`. Returns standard response envelope.
2. Create `src/modules/opportunities/opportunities.module.ts`:
   - Imports nothing extra (relies on `AiPrismaModule` being global).
   - Provides and exports `OpportunitiesService`.
   - Declares `OpportunitiesController`.
3. Register `OpportunitiesModule` in `AppModule` imports.
4. Decorate all DTO properties with `@ApiProperty` / `@ApiPropertyOptional` for Swagger documentation.

**Executor must NOT**:
- Write any tests.
- Modify service logic.

**Coordinator Verification Checklist**:
- [ ] Both endpoints decorated with `@Public()` (no JWT guard active)
- [ ] `ParseUUIDPipe` applied to `:id` parameter
- [ ] All `@ApiOperation`, `@ApiResponse`, `@ApiProperty` decorators present
- [ ] `OpportunitiesModule` registered in `AppModule`
- [ ] `pnpm build` and `pnpm lint` pass
- [ ] Swagger UI shows both endpoints at `/api/v1/opportunities`

**Tester Scope**:
- E2E tests (`test/opportunities.e2e-spec.ts`) using Supertest against the real NestJS app (AI Prisma service mocked at module level):
  - `GET /api/v1/opportunities` no params → `200`, correct envelope with `meta`.
  - `GET /api/v1/opportunities` with each filter individually → `200`, filtered data.
  - `GET /api/v1/opportunities?sort=invalid:asc` → `400 INVALID_SORT_FIELD`.
  - `GET /api/v1/opportunities?fields=forbidden` → `400 INVALID_FIELD`.
  - `GET /api/v1/opportunities?deadline_from=2027-01-01&deadline_to=2026-01-01` → `400 INVALID_DATE_RANGE`.
  - `GET /api/v1/opportunities/:id` valid UUID → `200`, full object.
  - `GET /api/v1/opportunities/not-a-uuid` → `400 VALIDATION_ERROR`.
  - `GET /api/v1/opportunities/00000000-0000-0000-0000-000000000000` (non-existent) → `404 OPPORTUNITY_NOT_FOUND`.
  - Request with valid Bearer token → `200` (token ignored, not rejected) (ST-001, EC-029).
  - Request without Authorization header → `200` (ST-001).
  - Simulate DB failure → `503 SERVICE_UNAVAILABLE` (ST-011).
  - Check response body: no raw Prisma fields, no stack trace (ST-008, ST-009).
- Review: Confirm `@Public()` present on both endpoints; confirm `ParseUUIDPipe` rejects malformed IDs before service is called.

**Task 4 Acceptance Gate**: All E2E tests pass; Tester confirms no security or spec issues.

---

### Task 5 — Final Gate: Full Test Suite, Lint, Build & Security Sweep

**Assigned by Coordinator to**: Tester

**Prerequisite**: Tasks 1–4 complete and all cycles closed.

**Scope** (Tester only — no source code modifications):
1. Run `pnpm test` — confirm all unit tests pass; confirm service coverage ≥ 80%.
2. Run `pnpm test:e2e` — confirm all E2E tests pass.
3. Run `pnpm build` — confirm zero TypeScript errors.
4. Run `pnpm lint` — confirm zero lint errors.
5. Execute the full security test register from `quality-and-security.md §4` (ST-001 through ST-011) and record each result.
6. Verify all 30 edge cases from `quality-and-security.md §1` are covered by at least one test (map EC → test name).
7. Perform static grep: confirm no `process.env` in `opportunities.service.ts` or `ai-prisma.service.ts`; confirm no `console.log`/`console.error` anywhere in the new module.
8. Submit final report to Coordinator: test counts, coverage %, security test results, EC coverage map, and any outstanding issues.

**If any issue is found in Task 5**: Coordinator re-opens the relevant task (1–4), assigns fix to Executor, and loops back through the cycle for that specific task only before returning to Task 5.

**Task 5 Acceptance Gate**: Coordinator reviews the Tester's final report. All gates listed below must be green before the feature is declared production-ready:

- [ ] `pnpm build` — zero errors
- [ ] `pnpm lint` — zero errors
- [ ] `pnpm test` — all pass, ≥ 80% service coverage
- [ ] `pnpm test:e2e` — all pass
- [ ] ST-001 through ST-011 — all pass
- [ ] EC-001 through EC-030 — all covered by at least one test
- [ ] Zero `process.env` in new module source files
- [ ] Zero `console.*` in new module source files
- [ ] No raw Prisma models in any response body
- [ ] ADR `DEC-OPP-01` written in `docx/decisions-log.md`
- [ ] `.env.example` updated

---

## Complexity Tracking

No Constitution violations. Section not applicable.
