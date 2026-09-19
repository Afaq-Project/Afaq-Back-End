---
description: 'Task list for Feature 004 — Profile API Enhancements & Reference Data Expansion'
---

# Tasks: Profile API Enhancements & Reference Data Expansion

**Feature**: `004-profile-api-enhancements` | **Branch**: `004-profile-api-enhancements`
**Input**: Design documents from `specs/004-profile-api-enhancements/`
**Prerequisites**: [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/api-contracts.md](./contracts/api-contracts.md) · [edge-cases.md](./edge-cases.md) · [testing-strategy.md](./testing-strategy.md) · [security-controls.md](./security-controls.md) · [security-testing.md](./security-testing.md)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies at the same execution point)
- **[Story]**: Which user story this task belongs to (US1–US6 per spec.md)
- **Agent**: Indicates which OmA agent lane this task belongs to (Agent 1–4)

## OmA Agent Lane Assignment

| Agent | Lane | Stories | Can Start |
|---|---|---|---|
| **Agent 1** | Infrastructure (Lane A) | Foundation | Immediately |
| **Agent 2** | Reference Endpoints (Lane B) | US1, US2, US5 | After Agent 1 completes |
| **Agent 3** | Profile Sub-List Pagination (Lane C) | US4 | After Agent 1 completes |
| **Agent 4** | Security & Tests (Lane D) | US6 + Polish | After Agent 1 completes |

> **Parallel Signal**: Once Phase 2 (Foundation) is complete, Agents 2, 3, and 4 operate fully independently with zero file conflicts.

---

## Phase 1: Setup

**Purpose**: Verify the repository is in a clean state and all pre-conditions are met.
**Assigned**: Agent 1 (Lane A)

- [X] T001 Verify current branch is clean and all existing tests pass by running `pnpm lint && pnpm build && pnpm test` from project root
- [X] T002 Confirm `src/common/dto/pagination.dto.ts` exists and exports `PaginationDto` with `page`, `limit`, and `skip` fields
- [X] T003 [P] Confirm `prisma/schema.prisma` contains `LanguagesMaster` model for the new reference endpoint
- [X] T004 [P] Confirm `src/modules/profile/services/reference.service.ts` exists and is injected into `reference.controller.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared infrastructure that ALL agents depend on — must be merged before Agents 2, 3, and 4 begin.
**Assigned**: Agent 1 (Lane A) — sequential

**⚠️ CRITICAL**: Agents 2, 3, and 4 MUST NOT start until this phase is merged/committed.

- [X] T005 Add `search?: string` field with `@IsOptional() @IsString() @MaxLength(100)` decorators to `PaginationDto` class in `src/common/dto/pagination.dto.ts`
- [X] T005a Add `@Min(1)` to `page` and `@Min(1)`, `@Max(100)` to `limit` in `PaginationDto` class in `src/common/dto/pagination.dto.ts` to enforce bounds
- [X] T006 Create `src/common/utils/paginate.util.ts` with exported `buildMeta(total: number, page: number, limit: number)` function that returns `{ pagination: { page, limit, total, totalPages, hasNext, hasPrev } }`
- [X] T007 Add `EducationLevel` Prisma model to `prisma/schema.prisma` with fields: `id` (UUID PK), `name` (String unique VarChar 50), `labelEn` (String VarChar 100, mapped `label_en`), `labelAr` (String VarChar 100, mapped `label_ar`), `isActive` (Boolean default true), table mapped to `education_levels`
- [X] T008 Run `npx prisma migrate dev --name add-education-levels` from project root and confirm migration file is generated without errors
- [X] T009 Add 7 `EducationLevel` upsert blocks to `prisma/seed.ts` (high_school, diploma, bachelor, master, phd, certificate, other) with English and Arabic labels, using `upsert` on `name` field — print `✔ Seeded 7 education levels` to console
- [X] T010 Run `npx prisma db seed` and confirm output contains `✔ Seeded 7 education levels`
- [X] T011 Add `@IsUUID('4')` validation decorator to the `educationLevelId?: string` field in `src/modules/profile/dto/update-profile.dto.ts`, importing `IsUUID` from `class-validator`
- [X] T012 Run `pnpm build` and confirm zero TypeScript compilation errors before proceeding

**Checkpoint**: ✅ Foundation ready — Agents 2, 3, and 4 can now start in parallel

---

## Phase 3: User Story 1 — Browse & Filter Reference Data (Priority: P1)

**Goal**: New `GET /reference/languages` endpoint + search/pagination on `GET /reference/fields-of-study` and dual-mode `GET /reference/skills-taxonomy`.
**Assigned**: Agent 2 (Lane B)

**Independent Test**:
```bash
curl "http://localhost:3000/api/v1/reference/languages?search=eng&page=1&limit=5" | jq '.meta.pagination'
# Expected: pagination object with total=1
curl "http://localhost:3000/api/v1/reference/skills-taxonomy" | jq '.meta'
# Expected: null (grouped mode preserved)
curl "http://localhost:3000/api/v1/reference/skills-taxonomy?search=java" | jq '.meta.pagination'
# Expected: pagination object
```

### Implementation for User Story 1

- [X] T013 [US1] Add `async getLanguages(dto: PaginationDto): Promise<{ data, meta }>` method to `src/modules/profile/services/reference.service.ts` — query `this.prisma.languagesMaster.findMany` with `where: { name: { contains: dto.search, mode: 'insensitive' } }`, `skip: dto.skip`, `take: dto.limit`; use `prisma.languagesMaster.count` for total; return `{ data: [{ id, name }], ...buildMeta(total, dto.page, dto.limit) }` (import `buildMeta` from `src/common/utils/paginate.util.ts`)
- [X] T014 [US1] Update `getFieldsOfStudy()` method signature in `src/modules/profile/services/reference.service.ts` to accept `dto: PaginationDto & { category?: string }` — add `where: { isActive: true, ...(dto.search && { name: { contains: dto.search, mode: 'insensitive' } }), ...(dto.category && { category: dto.category }) }`, add `skip/take`, add `count()` call, return data with `buildMeta()`
- [X] T015 [US1] Update `getSkillsTaxonomy()` method in `src/modules/profile/services/reference.service.ts` to accept `dto: PaginationDto & { category?: string }` — implement dual-mode: if `!dto.search && !dto.category && dto.page === 1 && dto.limit === 50` return existing grouped response and MUST include `meta.pagination`; otherwise return flat paginated list `[{ id, name, category }]` with `buildMeta()`
- [X] T016 [P] [US1] Add `@Get('languages')` handler to `src/modules/profile/controllers/reference.controller.ts` — decorate with `@Public()`, `@ApiOperation({ summary: 'Get master languages list' })`, accept `@Query() dto: PaginationDto`, call `this.referenceService.getLanguages(dto)`, return result wrapped in `{ statusCode: 200, message: 'Languages retrieved successfully', ...result }`
- [X] T017 [P] [US1] Update `getFieldsOfStudy()` handler in `src/modules/profile/controllers/reference.controller.ts` to accept `@Query() dto: PaginationDto` and an optional `@Query('category') category?: string`; forward both to the updated service method
- [X] T018 [P] [US1] Update `getSkillsTaxonomy()` handler in `src/modules/profile/controllers/reference.controller.ts` to accept `@Query() dto: PaginationDto` and `@Query('category') category?: string`; forward to updated service method
- [X] T019 [US1] Verify via `curl http://localhost:3000/api/v1/reference/languages` returns 200 with `meta.pagination` and verify `curl "http://localhost:3000/api/v1/reference/languages?limit=200"` returns 400

**Checkpoint**: ✅ US1 complete — `GET /reference/languages` works with search/pagination; `skills-taxonomy` and `fields-of-study` return paginated results when params are provided

---

## Phase 4: User Story 2 — Education Level Standardised List (Priority: P1)

**Goal**: New `GET /reference/education-levels` endpoint, seeded with 7 records.
**Assigned**: Agent 2 (Lane B — continues from Phase 3)

**Independent Test**:
```bash
curl http://localhost:3000/api/v1/reference/education-levels | jq '.data | length'
# Expected: 7
curl http://localhost:3000/api/v1/reference/education-levels | jq '.data[] | select(.name=="bachelor") | .labelAr'
# Expected: "بكالوريوس"
```

### Implementation for User Story 2

- [X] T020 [US2] Add `async getEducationLevels()` method to `src/modules/profile/services/reference.service.ts` — query `this.prisma.educationLevel.findMany({ where: { isActive: true }, select: { id: true, name: true, labelEn: true, labelAr: true, isActive: true }, orderBy: { name: 'asc' } })`; return array directly (no pagination needed — bounded to 7 records)
- [X] T021 [US2] Add `@Get('education-levels')` handler to `src/modules/profile/controllers/reference.controller.ts` — decorate with `@Public()`, `@ApiOperation({ summary: 'Get standardised education levels' })`, no query params, call `this.referenceService.getEducationLevels()`, return `{ statusCode: 200, message: 'Education levels retrieved successfully', data, timestamp: new Date().toISOString() }`
- [X] T022 [US2] Verify `curl http://localhost:3000/api/v1/reference/education-levels` returns 200 with exactly 7 records, each having `id`, `name`, `labelEn`, `labelAr`, `isActive: true`

**Checkpoint**: ✅ US2 complete — Education levels endpoint returns seeded data; `PATCH /profile` with `educationLevel: "invalid"` returns 400

---

## Phase 5: User Story 3 — Profile Completion Display (Priority: P1)

**Goal**: Verify `GET /profile` returns `completionPct` (already implemented — validation only).
**Assigned**: Agent 2 (Lane B — quick verification task)

**Independent Test**:
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@levora.app","password":"AdminPassword123!"}' | jq -r '.data.accessToken')
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/profile | jq '.data.completionPct'
# Expected: integer 0–100
```

### Implementation for User Story 3

- [X] T023 [US3] Verify `GET /profile` response (authenticated) includes `completionPct`, `coreFieldsComplete`, and `lastCompletedStep` fields in `src/modules/profile/services/profile.service.ts` method `getProfileWithDetails()` — read-only inspection, no code changes expected
- [X] T024 [US3] Confirm profile completion scoring in `src/modules/profile/services/profile.service.ts` `calculateCompletionPct()` method awards 15% for `educationLevel`, 15% for `fieldOfStudy`, 15% for `nationality` — if any weight is missing or incorrect, update the scoring table to match the spec
- [X] T025 [US3] Manually test: create a fresh user via `POST /auth/register`, call `GET /profile` → confirm `completionPct: 0`; then `PATCH /profile` with `educationLevelId: "<UUID>"`, `nationality: "Jordanian"`, and `fieldOfStudy: ["Computer Science"]` → call `GET /profile` → confirm `completionPct: 45` and `coreFieldsComplete: true`

**Checkpoint**: ✅ US3 complete — `completionPct` returns accurately without a separate API call

---

## Phase 6: User Story 4 — Paginated Profile Sub-Lists (Priority: P2)

**Goal**: Add pagination to `GET /profile/skills`, `GET /profile/languages`, `GET /profile/documents`, `GET /profile/educations`.
**Assigned**: Agent 3 (Lane C — runs in parallel with Agents 2 and 4)

**Independent Test**:
```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/profile/skills?page=1&limit=5" | jq '.meta.pagination'
# Expected: pagination object with total >= 0

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/profile/documents" | jq '.data[0] | has("storagePath")'
# Expected: false (storagePath never exposed)
```

### Implementation for User Story 4

- [X] T026 [P] [US4] Update `findAll(userId: string)` in `src/modules/profile/services/skills.service.ts` to `findAll(userId: string, dto: PaginationDto)` — replace bare `findMany` with `findMany({ where: { userId }, skip: dto.skip, take: dto.limit, include: { skillsMaster: { select: { name: true } } } })` and add `count({ where: { userId } })`; return `{ data: skills.map(s => ({ skillId: s.skillId, name: s.skillsMaster.name, proficiency: s.proficiency })), ...buildMeta(total, dto.page, dto.limit) }`
- [X] T027 [P] [US4] Update `getSkills()` handler in `src/modules/profile/controllers/skills.controller.ts` to accept `@Query() dto: PaginationDto` and forward to `this.skillsService.findAll(req.user.id, dto)`. Ensure any `userId` passed in query/body is explicitly rejected or ignored (IDOR protection).
- [X] T028 [P] [US4] Update `findAll(userId: string)` in `src/modules/profile/services/languages.service.ts` to accept `dto: PaginationDto` — apply `skip/take` pagination and `count()`; return `{ data: languages.map(l => ({ languageId: l.languageId, name: l.languagesMaster.name, proficiency: l.proficiency })), ...buildMeta(total, dto.page, dto.limit) }`
- [X] T029 [P] [US4] Update `getLanguages()` handler in `src/modules/profile/controllers/languages.controller.ts` to accept `@Query() dto: PaginationDto` and forward to service. Enforce `req.user.id` context strictly.
- [X] T030 [P] [US4] Update `getDocuments(userId: string)` in `src/modules/profile/services/documents.service.ts` to accept `dto: PaginationDto` — apply `skip/take`; confirm `select` block explicitly excludes `storagePath`; return paginated data with `buildMeta()`
- [X] T031 [P] [US4] Update `getDocuments()` handler in `src/modules/profile/controllers/documents.controller.ts` to accept `@Query() dto: PaginationDto` and forward to service. Enforce `req.user.id` context strictly.
- [X] T032 [P] [US4] Update `findAll(userId: string)` in `src/modules/profile/services/educations.service.ts` to accept `dto: PaginationDto` — apply `skip/take` and `count()`; return paginated data with `buildMeta()`
- [X] T033 [P] [US4] Update `findAll()` handler in `src/modules/profile/controllers/educations.controller.ts` to accept `@Query() dto: PaginationDto` and forward to service. Enforce `req.user.id` context strictly.
- [X] T034 [US4] Run `pnpm build` in project root — confirm no TypeScript errors introduced by pagination changes across all 4 controllers/services

**Checkpoint**: ✅ US4 complete — All 4 profile sub-list endpoints return paginated responses; `storagePath` is absent from document items

---

## Phase 7: User Story 5 — App UI Language List (Priority: P2)

**Goal**: New static `GET /reference/app-languages` endpoint, no DB query, includes `dir` field.
**Assigned**: Agent 2 (Lane B — continues after US1/US2)

**Independent Test**:
```bash
curl http://localhost:3000/api/v1/reference/app-languages | jq '.data[] | select(.code=="ar") | .dir'
# Expected: "rtl"
curl http://localhost:3000/api/v1/reference/app-languages | jq '.data | length'
# Expected: 6
```

### Implementation for User Story 5

- [X] T035 [P] [US5] Create `src/modules/profile/constants/app-languages.constant.ts` exporting `APP_LANGUAGES` constant array of 6 objects, each with shape `{ code: string, name: string, nativeName: string, dir: 'ltr' | 'rtl' }` — values: en/English/English/ltr, ar/Arabic/العربية/rtl, fr/French/Français/ltr, de/German/Deutsch/ltr, es/Spanish/Español/ltr, tr/Turkish/Türkçe/ltr
- [X] T036 [P] [US5] Add `getAppLanguages()` method to `src/modules/profile/services/reference.service.ts` — return `APP_LANGUAGES` constant directly (no DB call, no async needed)
- [X] T037 [US5] Add `@Get('app-languages')` handler to `src/modules/profile/controllers/reference.controller.ts` — decorate with `@Public()`, `@ApiOperation({ summary: 'Get supported application UI languages' })`, no query params, return `{ statusCode: 200, message: 'App languages retrieved successfully', data: this.referenceService.getAppLanguages(), timestamp: new Date().toISOString() }`
- [X] T038 [US5] Verify `curl http://localhost:3000/api/v1/reference/app-languages` returns 200, 6 items, Arabic entry has `dir: "rtl"`, request is served without any DB query (confirm in server logs — no Prisma query logged)

**Checkpoint**: ✅ US5 complete — `GET /reference/app-languages` returns static list without DB hit; Arabic locale has `dir: "rtl"`

---

## Phase 8: User Story 6 — Security Hardening (Priority: P1)

**Goal**: Add `ParseUUIDPipe` to all UUID route params; add `@Throttle` on auth endpoints; fix `GET /users` envelope.
**Assigned**: Agent 4 (Lane D — runs in parallel with Agents 2 and 3)

**Independent Test**:
```bash
# UUID validation
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/profile/skills/not-a-uuid | jq '.status'
# Expected: 400

# Rate limiting (run 6 times in quick succession)
for i in {1..6}; do
  curl -s -o /dev/null -w "$i: %{http_code}\n" -X POST \
    http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"bad@test.com","password":"wrong"}'
done
# Expected: 1–5: 401, 6: 429
```

### Implementation for User Story 6

- [X] T039 [P] [US6] Add `new ParseUUIDPipe({ version: '4' })` as second argument to all `@Param('skillId')` decorators in `src/modules/profile/controllers/skills.controller.ts` (affects `getSkill`, `updateSkill`, `removeSkill` handlers); also remove the redundant `@UsePipes(new ValidationPipe({ whitelist: true }))` from the `createSkill()` POST handler since the global pipe already covers it
- [X] T040 [P] [US6] Add `new ParseUUIDPipe({ version: '4' })` as second argument to all `@Param('languageId')` decorators in `src/modules/profile/controllers/languages.controller.ts` (affects `getLanguage`, `updateLanguage`, `deleteLanguage` handlers)
- [X] T041 [P] [US6] Add `new ParseUUIDPipe({ version: '4' })` to all `@Param('id')` decorators in `src/modules/profile/controllers/documents.controller.ts` (affects download and delete handlers)
- [X] T042 [P] [US6] Add `new ParseUUIDPipe({ version: '4' })` to all `@Param('id')` decorators in `src/modules/profile/controllers/educations.controller.ts` (affects get-one, update, delete handlers)
- [X] T043 [US6] Add `@Throttle({ default: { limit: 5, ttl: 60000 } })` decorator to the `login()` method in `src/modules/auth/auth.controller.ts` — import `Throttle` from `@nestjs/throttler`
- [X] T044 [US6] Add `@Throttle({ default: { limit: 5, ttl: 60000 } })` decorator to the `register()` method in `src/modules/auth/auth.controller.ts`
- [X] T044a [US6] Add `@Throttle({ default: { limit: 60, ttl: 60000 } })` to all unauthenticated endpoints in `src/modules/profile/controllers/reference.controller.ts` using Redis store, implementing a fallback to bypass rate limiting (fail open) and log a warning if Redis is unavailable.
- [X] T045 [US6] Update return value of `findAll()` in `src/modules/users/users.service.ts` — wrap existing pagination fields (`page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`) under a `pagination` key in the returned object's `meta` field, matching the shape `{ data: [...], meta: { pagination: { ... } } }` — verify `UserListResponseDto` in `src/modules/users/dto/` reflects this change
- [X] T046 [US6] Run `pnpm build` in project root — confirm no TypeScript errors from ParseUUIDPipe or Throttle imports

**Checkpoint**: ✅ US6 complete — All UUID params validated at routing layer; auth endpoints throttled; `/users` returns `meta.pagination`

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Test file updates, Postman collections, build verification, and final smoke test run.
**Assigned**: Agent 4 (Lane D — continues after US6)

- [X] T047 [P] Update `tests/levora-smoke-tests.json` — add 5 new request items: `GET /reference/languages` (assert 200 + `meta.pagination`), `GET /reference/education-levels` (assert 200 + `data.length == 7`), `GET /reference/app-languages` (assert 200 + `data[].dir exists`), `GET /reference/fields-of-study?search=comp` (assert 200 + `meta.pagination`), `GET /reference/skills-taxonomy?search=java` (assert 200 + `meta.pagination`); update existing skill/language/document/education GET tests to assert `meta.pagination` presence; add negative test cases for auth rate limiting (429), reference rate limiting (429), and cross-user IDOR access (403/404)
- [X] T048 [P] Update `Levora_API_localhost.postman_collection.json` — add 3 new requests to the "Reference Data" folder (`GET /reference/languages`, `GET /reference/education-levels`, `GET /reference/app-languages`); add `?page=1&limit=10` example query params to all existing list endpoint requests; add pre-request and test scripts asserting `meta.pagination` shape for paginated endpoints; add rate limiting and IDOR negative tests
- [X] T049 [P] Update `Levora_API.postman_collection.json` — apply same changes as T048 for the production-URL collection
- [X] T050 Run full build and lint: `pnpm lint && pnpm build` — confirm 0 errors, 0 warnings (or document any pre-existing warnings that are not regressions)
- [X] T051 Run all unit tests: `pnpm test` — confirm no regressions in existing test suites
- [X] T051a Implement missing edge cases (from `edge-cases.md`), test scenarios (from `testing-strategy.md`), and security tests (from `security-testing.md`) in the automated test suite.
- [X] T052 Execute all validation scenarios from `quickstart.md`, along with manually verifying the security controls mapped in `security-controls.md` against the local server and confirm all pass
- [X] T053 Run Newman smoke test suite: `npx newman run tests/levora-smoke-tests.json --env-var "baseUrl=http://localhost:3000/api/v1"` — confirm `0 failures`
- [X] T054 Commit all changes with message: `feat(profile): add reference data expansion, pagination, education levels, and security hardening (#004)`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundation — Agent 1)**: Depends on Phase 1 — **BLOCKS Phases 3–8**
- **Phase 3 (US1 — Agent 2)**: Depends on Phase 2
- **Phase 4 (US2 — Agent 2)**: Depends on Phase 3 (shares reference.service.ts)
- **Phase 5 (US3 — Agent 2)**: Depends on Phase 2 (verification only, no code changes expected)
- **Phase 6 (US4 — Agent 3)**: Depends on Phase 2 only — **fully parallel with Phases 3, 4, 5, 7, 8**
- **Phase 7 (US5 — Agent 2)**: Depends on Phase 2
- **Phase 8 (US6 — Agent 4)**: Depends on Phase 2 only — **fully parallel with Phases 3, 4, 5, 6, 7**
- **Phase 9 (Polish — Agent 4)**: Depends on all user story phases completing

### User Story Dependencies

- **US1 (P1)**: After Foundation — no story dependencies
- **US2 (P1)**: After US1 (same agent, same service file — sequential within Agent 2)
- **US3 (P1)**: After Foundation — no story dependencies (verification only)
- **US4 (P2)**: After Foundation — fully independent of US1/US2/US3
- **US5 (P2)**: After US2 (same agent, same controller file — sequential within Agent 2)
- **US6 (P1)**: After Foundation — fully independent of all other stories

### Within Each User Story

- Service method before controller handler
- New constant/utility before service method that uses it
- `pnpm build` verification after each story completes

---

## Parallel Execution Examples

### After Phase 2 (Foundation) — Launch 3 Agents Simultaneously

```text
Agent 2 starts: Phase 3 (US1 — T013 → T019)
  then:         Phase 4 (US2 — T020 → T022)
  then:         Phase 5 (US3 — T023 → T025)
  then:         Phase 7 (US5 — T035 → T038)

Agent 3 starts: Phase 6 (US4 — T026 → T034)     ← fully parallel with Agent 2

Agent 4 starts: Phase 8 (US6 — T039 → T046)     ← fully parallel with Agents 2 and 3
  then:         Phase 9 (Polish — T047 → T054)   ← after US6 + all other agents complete
```

### Within Phase 3 (US1 — Agent 2)

```text
# Service tasks (sequential — same file):
T013 → T014 → T015

# Controller tasks (parallel — same file but independent handlers):
T016 [P], T017 [P], T018 [P]   ← can be done together after T013–T015

T019 (verification)             ← after T016, T017, T018
```

### Within Phase 6 (US4 — Agent 3)

```text
# Service + Controller tasks per entity (fully parallel — different files):
T026 [P] skills.service.ts      ─┐
T028 [P] languages.service.ts   ├─ all parallel
T030 [P] documents.service.ts   ├─ (different service files)
T032 [P] educations.service.ts  ─┘

Then:
T027 [P] skills.controller.ts      ─┐
T029 [P] languages.controller.ts   ├─ all parallel
T031 [P] documents.controller.ts   ├─ (different controller files)
T033 [P] educations.controller.ts  ─┘

Then: T034 (build verification)
```

### Within Phase 8 (US6 — Agent 4)

```text
# All ParseUUIDPipe additions (parallel — different controller files):
T039 [P] skills.controller.ts      ─┐
T040 [P] languages.controller.ts   ├─ all parallel
T041 [P] documents.controller.ts   ├─ (different files)
T042 [P] educations.controller.ts  ─┘

Then (sequential — same file):
T043 → T044   auth.controller.ts (login then register throttle)

Then:
T045 users.service.ts (envelope fix)
T046 pnpm build verification
```

---

## Implementation Strategy

### MVP First (US1 + US6 only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundation) — Agent 1
2. Complete Phase 3 (US1: Reference Filtering) — Agent 2
3. Complete Phase 8 (US6: Security) — Agent 4 in parallel
4. **STOP and VALIDATE**: Run quickstart.md scenarios 1–2 + 8–9
5. Ready to demo: languages search, education levels, and security hardening

### Incremental Delivery

1. Foundation ready (Phase 2) → unblocks all stories
2. US1 + US6 → core reference filtering + security (**MVP**)
3. US2 + US5 → education levels + app languages list
4. US3 → profile completion validation
5. US4 → profile sub-list pagination
6. Polish (Phase 9) → full test suite green

### OmA Multi-Agent Strategy

```
Phase 1 + 2: Agent 1 (solo, blocking)
                ↓ merge/commit
Phase 3–8:  ┌── Agent 2 (US1 → US2 → US3 → US5)
            ├── Agent 3 (US4)                      ← parallel
            └── Agent 4 (US6 → Polish)             ← parallel
```

Total estimated parallelism: **3 concurrent agents** for ~60% of the implementation.

---

## Notes

- `[P]` tasks operate on different files — no merge conflicts between parallel tasks
- `[Story]` label maps each task to the user story for traceability to spec.md
- The global `ValidationPipe` in `main.ts` already has `whitelist: true, forbidNonWhitelisted: true` — no action needed (confirmed in research.md)
- Commit after each agent lane completes to unblock dependent work
- Never skip `pnpm build` verification tasks — TypeScript errors propagate silently in NestJS decorators
- The `GET /users` envelope change (T045) is a potential breaking change for admin UI consumers — coordinate with frontend team before deploying Phase 9

## Phase 10: Convergence

- [X] T055 Update `UserProfiles` model in `prisma/schema.prisma` to rename `educationLevel` to `educationLevelId` (UUID) and make it a foreign key referencing `EducationLevel(id)`. Ensure database migrations are generated and applied. per plan: A-3 (missing)
- [X] T056 Configure `ThrottlerModule` to use Redis store with a graceful fallback (fail open) on Redis failure, or implement a custom `ThrottlerGuard` for unauthenticated endpoints. per plan: D-5a (partial)
