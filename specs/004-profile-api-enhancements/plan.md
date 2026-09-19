# Implementation Plan: Profile API Enhancements & Reference Data Expansion

**Branch**: `004-profile-api-enhancements` | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

---

## Summary

Extend the Levora backend API with five new reference data endpoints (languages, education levels, app UI languages, and enhanced filtering on skills/fields-of-study), retrofit all profile sub-list endpoints with standard pagination, harden route security with UUID validation and auth rate limiting, and standardise the pagination response envelope across all list endpoints. All work is driven by the sprint analysis documented in the [Research](./research.md) and [Contracts](./contracts/api-contracts.md) documents.

---

## Technical Context

| Property | Value |
|---|---|
| **Language/Version** | TypeScript 5.9 / Node.js 22 |
| **Framework** | NestJS 10 |
| **Primary Dependencies** | `@nestjs/common`, `@nestjs/throttler`, `class-validator`, `class-transformer`, `@nestjs/swagger` |
| **ORM** | Prisma 6 (PostgreSQL) |
| **Storage** | PostgreSQL (local dev: `localhost:5432/mydb`) |
| **Testing** | Jest (unit), Newman (smoke/e2e) |
| **Target Platform** | Linux server (NestJS REST API) |
| **Performance Goals** | Reference endpoints < 500ms; Profile sub-lists < 300ms |
| **Constraints** | Pagination max `limit=100`; search max 100 chars; no breaking changes to existing response shapes (except `GET /users` envelope, coordinated with frontend) |
| **Scale/Scope** | 10 modified + 3 new endpoints across 4 controllers and 4 services |

---

## Constitution Check

_Constitution file contains only placeholder content — no project-specific principles are enforced._

- ✅ Modular Architecture preserved — all work stays within existing module boundaries
- ✅ Controller → Service → Repository flow maintained
- ✅ No business logic added to controllers
- ✅ New DTOs use class-validator for input validation
- ✅ All secrets remain in environment variables (no new hardcoded values)
- ✅ Migrations required for schema changes — no manual DB edits
- ✅ No implementation spills into the spec document

_Gate: PASS. Proceed to execution._

---

## Project Structure

### Documentation (this feature)

```text
specs/004-profile-api-enhancements/
├── plan.md              ← This file
├── research.md          ← Phase 0 decisions (all clarifications resolved)
├── data-model.md        ← Phase 1 entity definitions and file map
├── quickstart.md        ← Phase 1 validation guide (10 runnable scenarios)
├── edge-cases.md        ← Phase 1 edge case documentation
├── testing-strategy.md  ← Phase 1 comprehensive test strategy
├── security-controls.md ← Phase 1 security controls and vulnerabilities mapping
├── security-testing.md  ← Phase 1 security test specifications
├── checklists/
│   └── requirements.md  ← Spec quality checklist (all 16 items pass)
├── contracts/
│   └── api-contracts.md ← Full request/response shapes for 11 endpoints
└── tasks.md             ← Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code — Agent Lane Map

```text
src/
├── common/
│   ├── dto/
│   │   └── pagination.dto.ts         ← LANE A: add `search` field
│   └── utils/
│       └── paginate.util.ts          ← LANE A: new file — buildMeta()
│
├── modules/
│   ├── auth/
│   │   └── auth.controller.ts        ← LANE D: add @Throttle() on login/register
│   │
│   ├── users/
│   │   └── users.service.ts          ← LANE D: nest pagination under meta.pagination
│   │
│   └── profile/
│       ├── constants/
│       │   └── app-languages.constant.ts   ← LANE B: new file
│       ├── controllers/
│       │   ├── reference.controller.ts     ← LANE B: 3 new endpoints + 2 modified
│       │   ├── skills.controller.ts        ← LANE C+D: pagination + ParseUUIDPipe
│       │   ├── languages.controller.ts     ← LANE C+D: pagination + ParseUUIDPipe
│       │   ├── documents.controller.ts     ← LANE C+D: pagination + ParseUUIDPipe
│       │   └── educations.controller.ts    ← LANE C+D: pagination + ParseUUIDPipe
│       ├── dto/
│       │   └── update-profile.dto.ts       ← LANE A: add @IsIn() on educationLevel
│       └── services/
│           ├── reference.service.ts        ← LANE B: 3 new methods + 2 enhanced
│           ├── skills.service.ts           ← LANE C: add pagination to findAll()
│           ├── languages.service.ts        ← LANE C: add pagination to findAll()
│           ├── documents.service.ts        ← LANE C: add pagination to getDocuments()
│           └── educations.service.ts       ← LANE C: add pagination to findAll()
│
prisma/
├── schema.prisma                     ← LANE A: add EducationLevel model
└── seed.ts                           ← LANE A: add 7 EducationLevel rows
│
tests/
└── levora-smoke-tests.json           ← LANE D: add assertions for 5 new endpoints

Levora_API.postman_collection.json    ← LANE D: add new endpoints + pagination examples
Levora_API_localhost.postman_collection.json  ← LANE D: same
```

---

## Multi-Agent Execution Plan

> The work is split into **4 agent lanes** designed for maximum parallelism.
> Lanes B, C, and D are **fully independent** of each other and can run concurrently
> after Lane A is complete and committed.

### Dependency Graph

```
LANE A (Infrastructure) — must complete FIRST
   ├── creates: PaginationDto.search, buildMeta(), EducationLevel schema+seed, @IsIn() DTO
   └── unblocks:
         ├── LANE B (Reference Endpoints)    ─┐
         ├── LANE C (Profile Pagination)      ├─ all run in PARALLEL
         └── LANE D (Security & Tests)       ─┘
```

---

### Lane A — Shared Infrastructure

**Agent**: `oma-executor` (sequential, must finish before B/C/D)
**Estimated scope**: ~4 files

| Task | File | Action |
|---|---|---|
| A-1 | `src/common/dto/pagination.dto.ts` | Add `search?: string` with `@IsOptional() @IsString() @MaxLength(100)`, and add `@Min(1)` to `page`, and `@Min(1)`, `@Max(100)` to `limit`. Configure explicit default limits per endpoint. |
| A-2 | `src/common/utils/paginate.util.ts` | Create new file with `buildMeta(total, page, limit)` returning `{ pagination: { page, limit, total, totalPages, hasNext, hasPrev } }` |
| A-3 | `prisma/schema.prisma` | Add `EducationLevel` model and update `UserProfiles` to use `educationLevelId` as a foreign key to `EducationLevel` (see [data-model.md](./data-model.md)) |
| A-4 | `prisma/seed.ts` | Add 7 `EducationLevel` upsert rows |
| A-5 | `src/modules/profile/dto/update-profile.dto.ts` | Add `@IsUUID('4')` on `educationLevelId` field |
| A-6 | _(shell)_ | Run `npx prisma migrate dev --name add-education-levels` + `npx prisma db seed` |

**Gate**: Run `npx prisma db seed` — must print `✔ Seeded 7 education levels`. Run `pnpm build` — must succeed with 0 TypeScript errors.

---

### Lane B — Reference Data Endpoints

**Agent**: `oma-executor` (parallel with C and D, after A)
**Estimated scope**: ~3 files

| Task | File | Action |
|---|---|---|
| B-1 | `src/modules/profile/constants/app-languages.constant.ts` | Create constant array of 6 `AppLanguage` objects with `code`, `name`, `nativeName`, `dir` |
| B-2 | `src/modules/profile/services/reference.service.ts` | Add `getLanguages(dto: PaginationDto)` — paginated+searched `LanguagesMaster` query using `buildMeta()`; add `getEducationLevels()` — `findMany({ where: { isActive: true } })`; add `getAppLanguages()` — return constant; update `getFieldsOfStudy()` to accept `PaginationDto` + optional `category` filter; update `getSkillsTaxonomy()` for dual-mode response (both with `meta.pagination`) |
| B-3 | `src/modules/profile/controllers/reference.controller.ts` | Add `GET /reference/languages` with `@Query() dto: PaginationDto`; add `GET /reference/education-levels`; add `GET /reference/app-languages` with `@Public()`; update existing `GET /reference/fields-of-study` and `GET /reference/skills-taxonomy` to accept query DTO |

**Gate**: `curl http://localhost:3000/api/v1/reference/languages` → 200 + `meta.pagination`. `curl http://localhost:3000/api/v1/reference/education-levels` → 200 + 7 records. `curl http://localhost:3000/api/v1/reference/app-languages | jq '.data[] | select(.code=="ar") | .dir'` → `"rtl"`.

---

### Lane C — Profile Sub-List Pagination

**Agent**: `oma-executor` (parallel with B and D, after A)
**Estimated scope**: ~8 files (4 controllers + 4 services)

| Task | Files | Action |
|---|---|---|
| C-1 | `skills.service.ts` | Update `findAll(userId, dto: PaginationDto)` to use `findMany({ skip, take })` + `count()` and return `{ data, ...buildMeta() }`. Enforce `req.user.id` extraction. |
| C-2 | `skills.controller.ts` | Add `@Query() dto: PaginationDto` to `getSkills()`; forward to service with `req.user.id` |
| C-3 | `languages.service.ts` | Same pattern as C-1 for `findAll()` |
| C-4 | `languages.controller.ts` | Same pattern as C-2 for `getLanguages()` |
| C-5 | `documents.service.ts` | Update `getDocuments(userId, dto: PaginationDto)` with pagination; ensure `storagePath` is excluded from `select` |
| C-6 | `documents.controller.ts` | Add `@Query() dto: PaginationDto` to `getDocuments()` |
| C-7 | `educations.service.ts` | Update `findAll(userId, dto: PaginationDto)` with pagination |
| C-8 | `educations.controller.ts` | Add `@Query() dto: PaginationDto` to `findAll()` |

**Gate**: `curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/v1/profile/skills?page=1&limit=5"` → 200 + `meta.pagination`. `curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/v1/profile/documents" | jq '.data[0] | has("storagePath")'` → `false`.

---

### Lane D — Security Hardening & Test Updates

**Agent**: `oma-executor` (parallel with B and C, after A)
**Estimated scope**: ~5 source files + 3 test/config files

| Task | File | Action |
|---|---|---|
| D-1 | `skills.controller.ts` | Add `new ParseUUIDPipe({ version: '4' })` to all `@Param('skillId')` decorators; remove redundant local `@UsePipes(new ValidationPipe())` from POST |
| D-2 | `languages.controller.ts` | Add `new ParseUUIDPipe({ version: '4' })` to all `@Param('languageId')` decorators |
| D-3 | `documents.controller.ts` | Add `ParseUUIDPipe` to `:id` params |
| D-4 | `educations.controller.ts` | Add `ParseUUIDPipe` to `:id` params |
| D-5 | `auth.controller.ts` | Add `@Throttle({ default: { limit: 5, ttl: 60000 } })` to `login()` and `register()` methods |
| D-5a | `reference.controller.ts` | Add `@Throttle({ default: { limit: 60, ttl: 60000 } })` to all endpoints using a Redis store, with graceful fallback (bypass rate limiting/fail open and log a warning on Redis failure). |
| D-6 | `users.service.ts` | Wrap pagination return fields in `{ pagination: { page, limit, total, totalPages, hasNext, hasPrev } }` to match standard `meta` shape |
| D-7 | `tests/levora-smoke-tests.json` | Add smoke test requests for 5 new endpoints; update existing paginated endpoint checks to assert `meta.pagination` presence; add negative test cases for auth rate limiting (expecting 429), reference rate limiting (expecting 429), and cross-user IDOR access (expecting 403/404). |
| D-8 | `Levora_API_localhost.postman_collection.json` | Add 3 new reference endpoints; add pagination examples to all list endpoints; add rate limiting negative tests and IDOR checks. |
| D-9 | `Levora_API.postman_collection.json` | Same as D-8 |

**Gate**: `curl http://localhost:3000/api/v1/profile/skills/not-a-uuid` → 400. Six rapid login attempts → 5th returns 401, 6th returns 429. `npx newman run tests/levora-smoke-tests.json` → 0 failures.

---

## Verification Checklist (all lanes)

Reference the 16 Acceptance Criteria in [spec.md](./spec.md) and the [quickstart.md](./quickstart.md) scenarios.

| AC | Description | Lane |
|---|---|---|
| AC-01 | `GET /reference/languages?search=eng` → paginated | B |
| AC-02 | `GET /reference/fields-of-study?category=STEM` → filtered + paginated | B |
| AC-03 | `GET /reference/skills-taxonomy` (no params) → grouped, `meta.pagination` present | B |
| AC-04 | `GET /reference/skills-taxonomy?search=java` → flat paginated | B |
| AC-05 | `GET /profile/skills?page=1&limit=20` → paginated (auth) | C |
| AC-06 | `GET /profile/languages?page=1&limit=20` → paginated (auth) | C |
| AC-07 | `GET /profile/documents` → `storagePath` absent | C |
| AC-08 | `GET /profile/educations?page=1&limit=10` → paginated (auth) | C |
| AC-09 | `GET /users?page=1` → `meta.pagination` nested | D |
| AC-10 | `GET /profile` → `completionPct` integer 0–100 | _(already exists — verify only)_ |
| AC-11 | `GET /reference/app-languages` → no auth, includes `dir` | B |
| AC-12 | `GET /reference/education-levels` → 7 rows, no auth | A+B |
| AC-13 | `PATCH /profile` with invalid `educationLevelId` → 400 | A |
| AC-14 | Paginated endpoints reject `page=0` or `limit=0` → 400 | A (DTO) |
| AC-15 | Authenticated endpoints without JWT → 401 | _(existing guards — verify only)_ |
| AC-16 | `GET /profile/skills/not-a-uuid` → 400 | D |

---

## Complexity Tracking

_No constitution violations. No complexity justification required._
