# Implementation Plan: Profile Education (Batch 2)

**Branch**: `006-profile-education` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Prerequisite**: Batch 1 Review Gate PASSED (`005-profile-foundation`).

**Unblocks**: `007-profile-languages`

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/006-profile-education/endpoints.md`.

## Summary

Batch 2 — Education Section. See `specs/OVERVIEW.md` for the full plan.

This batch seeds reference data (institutions, majors, roles), fully rewrites
`EducationsService`, updates related DTOs and controller, adds education-related
reference endpoints, and activates the education group in `completionPct`.

**Review Gate**: Education CRUD endpoints work with structured FK-based inputs.
GPA normalization is correct. Duplicate education records are rejected.
Completion percentage reflects education group (35%) correctly. All tests pass.

---

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20 LTS

**Primary Dependencies**: NestJS 10, Prisma 5, Passport.js, class-validator,
class-transformer, pnpm, Jest, Supertest, nestjs-pino

**Storage**: PostgreSQL (primary)

**Testing**: Jest (unit + integration), Supertest (e2e), Postman (smoke)

---

## Constitution Check

| Gate | Status | Note |
|:---|:---:|:---|
| Controller → Service → Repository flow | ✅ PASS | All new controllers delegate to services |
| No business logic in Controllers | ✅ PASS | Controllers validate inputs and route only |
| Prisma-only DB access | ✅ PASS | No raw SQL planned |
| All schema changes via migrations | ✅ PASS | Schema already migrated in Batch 1 |
| DTO validation on all inputs | ✅ PASS | `class-validator` + global `ValidationPipe` |
| `forbidNonWhitelisted: true` | ✅ PASS | Already global |
| JWT auth on all non-public endpoints | ✅ PASS | `@Public()` only on reference endpoints |

---

## Reference Data Loading Strategy

Loading Order (must be strictly followed):

1. **Countries** — loaded first from `countries.json`. Direct insert; all fields align with schema.
2. **Cities** — loaded second. Each city must reference a valid `countryId`. Requires resolving `countryIsoCode2` → `countryId` via a lookup on `Countries.isoCode2`.
3. **MajorCategories** — loaded from CIP series/families, or seeded manually.
4. **Majors** — loaded from CIP data. Each major must reference a valid `categoryId`.
5. **Institutions** — loaded last. Each institution must resolve:
   - `countryIsoCode2` → `countryId` via lookup on `Countries.isoCode2`
   - `cityName` → `cityId` via lookup on `Cities.nameEn` filtered by the resolved `countryId`
   - Institutions whose `countryIsoCode2` does not match any loaded country must be skipped (not errored).
   - If `cityName` is provided but no matching city exists, `cityId` is set to null (no error).

**Loader location**: `scripts/load-reference-data.ts`
**Invocation**: `pnpm ts-node scripts/load-reference-data.ts`
**Execution**: Once, before Batch 2 tests run.
**Idempotency**: The loader uses upsert on `externalSourceId` for every table — re-running is safe.

---

## Batch 2 — Parallel Execution Plan

### Track A — Seeding Strategy (two modes)

**Agent**: `oma-quick`

**Seeding Strategy (two modes)**:
- **Development mode (default for tests)**: `scripts/seed-education-data.ts` loads a curated sample — 20 countries, 50 cities, 30 institutions, 8 major categories, minimum 5 majors per category in development sample; the full CIP dataset is loaded in production mode. Fast and sufficient for tests.
- **Production mode**: `scripts/load-reference-data.ts` loads the full datasets produced by the reference fetch scripts. Run once before going live.

Both scripts are idempotent (upsert on unique keys). Neither runs automatically — both are invoked manually.

---

### Track B — EducationsService + DTOs (parallel with C after Track A)

**Agent**: `oma-architect`

**Step B.1** — Rewrite `src/modules/profile/dto/create-education.dto.ts`:
- `educationLevelId: string` (UUID, required)
- `institutionId: string` (UUID, required)
- `majorId: string` (UUID, required)
- `minorMajorId?: string` (UUID, optional)
- `startDate?: string` (ISO date, optional)
- `endDate?: string` (ISO date, optional — must be after or equal to startDate if both present)
- `expectedGraduationDate?: string` (ISO date, optional)
- `isCurrent?: boolean` (default false)
- `gpaRaw?: number` (min 0, optional)
- `gpaScale?: 'OUT_OF_4' | 'OUT_OF_5' | 'OUT_OF_100'` (optional; required if gpaRaw provided)

`UpdateEducationDto` = `PartialType(CreateEducationDto)`.

**Step B.2** — Rewrite `src/modules/profile/services/educations.service.ts`:
- `create(userId, dto)`: Validate institution, major, and education level exist.
  Check uniqueness: `(userId, institutionId, majorId, educationLevelId)`. Enforce
  `MAX_EDUCATIONS` from `SystemSettings`. Compute `gpaNormalized` from `gpaRaw`
  + `gpaScale`. Save to `UserEducations` with `userId set to the authenticated user's ID` (FK to
  `UserProfiles.userId`). Call `ProfileService.recalculate(userId)`. Enforce the following domain rules on both `create` and `update`: if `isCurrent = true` → forcibly set `endDate = null`; if `isCurrent = false` → forcibly set `expectedGraduationDate = null`; if `minorMajorId` equals `majorId` → throw `400 MINOR_MAJOR_EQUALS_MAJOR`; if both `endDate` and `startDate` are present and `endDate < startDate` → throw `400 INVALID_DATE_RANGE`.
- `findAll(userId)`: Return all education records for the user's profile.
- `findOne(userId, id)`: Return single record, throw 404 if not found.
- `update(userId, id, dto)`: Update fields. Recompute `gpaNormalized`. Call
  `ProfileService.recalculate(userId)`.
- `delete(userId, id)`: Hard-delete. Call `ProfileService.recalculate(userId)`.

GPA normalization formula:
- `OUT_OF_4` → `gpaNormalized = gpaRaw` (already on 4.0 scale)
- `OUT_OF_5` → `gpaNormalized = (gpaRaw / 5) * 4`
- `OUT_OF_100` → `gpaNormalized = (gpaRaw / 100) * 4`

**Step B.3** — Controller `src/modules/profile/controllers/educations.controller.ts`:
No structural changes; only verify it uses updated service signature. Add
`@ApiBody`, `@ApiOperation`, and `@ApiResponse` decorators if missing.
Add a new route `GET /profile/educations/:id` that delegates to `EducationsService.findOne(userId, id)` and returns a single education record. Apply the standard error responses (`401`, `404 EDUCATION_NOT_FOUND`, `500`) and Swagger decorators.

---

### Track C — Reference Endpoints (Education) (parallel with B after Track A)

**Agent**: `oma-editor`

Add to `reference.service.ts`:
- `getMajorCategories(dto)`: returns `{ data, meta }` supporting pagination (`page`, `limit`), sorting (`sort`, `order`), and `search` / `isActive` filtering.
- `getMajors(dto)`: returns `{ data, meta }` supporting pagination, sorting, and `categoryId` / `search` filtering.
- `getInstitutions(dto)`: returns `{ data, meta }` supporting pagination, sorting, and `countryId` / `cityId` / `search` filtering.

Add to `reference.controller.ts`:
- `GET /reference/major-categories` `@Public()` — accepts a pagination DTO and returns `{ data, meta }`
- `GET /reference/majors` `@Public()` — accepts a pagination DTO and returns `{ data, meta }`
- `GET /reference/institutions` `@Public()` — accepts a pagination DTO and returns `{ data, meta }`

---

### Track D — Tests

**Agent**: `oma-reviewer`

Unit tests:
- `educations.service.spec.ts` — test all CRUD methods; test GPA normalization for
  all three scales; test duplicate rejection; test MAX_EDUCATIONS enforcement. Also test: `findOne(userId, id)` returns a single record by ID and throws `404 EDUCATION_NOT_FOUND` for a foreign UUID. Test that `isCurrent = true` clears `endDate` and `isCurrent = false` clears `expectedGraduationDate`. Test that `minorMajorId == majorId` throws `400 MINOR_MAJOR_EQUALS_MAJOR`. Test that `endDate < startDate` throws `400 INVALID_DATE_RANGE`.

E2E — add to `test/profile.e2e-spec.ts`:
- `POST /profile/educations` — creates record, completion increases.
- `PATCH /profile/educations/:id` — updates GPA, gpaNormalized recalculates.
- `DELETE /profile/educations/:id` — deletes, completion decreases.
- Duplicate education record → 409.
- Score out of GPA range → 400 (validated at DTO level).
- `GET /profile/educations/:id` — returns `200` for the owner and `404` for a foreign UUID.
- `PATCH` with `isCurrent = true` nullifies `endDate`.
- `POST` with `minorMajorId == majorId` returns `400 MINOR_MAJOR_EQUALS_MAJOR`.
- `POST` with `endDate < startDate` returns `400 INVALID_DATE_RANGE`.
- `GET /reference/major-categories?search=Eng` returns paginated `{ data, meta }`.

Smoke tests — update `tests/levora-smoke-tests.json`:
- Add CRUD sequence for education records.
- Add reference endpoint requests.

Postman — update both collections:
- Education CRUD with full example bodies (structured FK IDs, GPA examples
  for all three scales).
- Education reference endpoints.

---

## Batch 2 — Completion Report Template

**Endpoints Delivered**:

| Method | Path | Auth | Body / Params | Response |
|:---:|:---|:---:|:---|:---|
| `POST` | `/api/v1/profile/educations` | Bearer | CreateEducationDto | Education record |
| `GET` | `/api/v1/profile/educations` | Bearer | — | `[EducationRecord]` |
| `GET` | `/api/v1/profile/educations/:id` | Bearer | — | Education record |
| `PATCH` | `/api/v1/profile/educations/:id` | Bearer | UpdateEducationDto | Updated record |
| `DELETE` | `/api/v1/profile/educations/:id` | Bearer | — | 204 No Content |
| `GET` | `/api/v1/reference/major-categories` | Public | `?search=&isActive=&page=&limit=&sort=&order=` | `{ data: [...], meta: {...} }` |
| `GET` | `/api/v1/reference/majors` | Public | `?categoryId=&search=&page=&limit=&sort=&order=` | `{ data: [...], meta: {...} }` |
| `GET` | `/api/v1/reference/institutions` | Public | `?countryId=&cityId=&search=&page=&limit=&sort=&order=` | `{ data: [...], meta: {...} }` |

---

# Cross-Batch Invariants

These rules apply to every batch and every task:

1. **Lint before merge**: `pnpm lint` must pass with zero errors.
2. **Build before merge**: `pnpm build` must succeed — the TypeScript compiler is the final gate.
3. **No partial merges**: A batch is never considered done if any test in that batch's scope is failing.
4. **Recalculation contract**: Every write operation (create, update, delete) on any profile sub-section
   MUST call `ProfileService.recalculate(userId)` before returning. No exceptions.
5. **matchingVersion**: `recalculate()` increments `matchingVersion` unconditionally on every invocation,
   regardless of whether `completionPct` changed.
6. **Ownership guards** (`EducationOwnershipGuard`, `LanguageOwnershipGuard`, `DocumentOwnershipGuard`)
   require no changes and must be preserved as-is.
7. **Response shape**: All endpoints return `{ statusCode, message, data, timestamp }` via the global
   `TransformInterceptor`. Controllers never construct this shape manually.
8. **Swagger completeness**: Every controller method added or modified must have `@ApiOperation`,
   `@ApiResponse`, and `@ApiBearerAuth` (or equivalent for public endpoints).
9. **Frontend coordination**: `forbidNonWhitelisted: true` is active globally. Any new endpoint
   must have its accepted fields communicated to the frontend team before release.
10. **hotfix-bypass rule**: If `--no-verify` is used on any commit, the commit message MUST begin
    with `hotfix-bypass:` followed by the reason. A fix commit must follow within 24 hours.
