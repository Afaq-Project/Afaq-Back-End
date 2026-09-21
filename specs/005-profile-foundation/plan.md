# Implementation Plan: Profile Module v2 Redesign

**Branch**: `005-profile-foundation` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

---

> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/005-profile-foundation/endpoints.md`.

## Summary

This spec covers Batch 1 only. See `specs/OVERVIEW.md` for the full plan.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20 LTS

**Primary Dependencies**: NestJS 10, Prisma 5, Passport.js, class-validator,
class-transformer, pnpm, Jest, Supertest, nestjs-pino

**Storage**: PostgreSQL (primary), S3-compatible (documents)

**Testing**: Jest (unit + integration), Supertest (e2e), Postman (smoke)

**Target Platform**: Linux server, API-only (no SSR/frontend)

**Performance Goals**: p95 < 300ms for all profile endpoints under normal load

**Constraints**: No breaking changes to unrelated modules; auth token format
unchanged; migration must be reversible before deployment

**Scale/Scope**: Profile per user (1:1); up to 5 education records, 10 language
records, 10 test results per profile

---

## Constitution Check

| Gate | Status | Note |
|:---|:---:|:---|
| Controller → Service → Repository flow | ✅ PASS | All new controllers delegate to services |
| No business logic in Controllers | ✅ PASS | Controllers validate inputs and route only |
| Prisma-only DB access | ✅ PASS | No raw SQL planned |
| All schema changes via migrations | ✅ PASS | `prisma migrate dev` per batch |
| DTO validation on all inputs | ✅ PASS | `class-validator` + global `ValidationPipe` |
| `forbidNonWhitelisted: true` | ✅ PASS | Already global; frontend must be informed of strict field whitelist |
| JWT auth on all non-public endpoints | ✅ PASS | `@Public()` only on reference endpoints |
| Secrets via `process.env` only | ✅ PASS | No keys in code |
| Unit tests for every new Service | ✅ PASS | Batch-level requirement enforced |
| `SystemSettingsService` fallbacks | ✅ PASS | Hardcoded defaults in all setting reads |

---

## Project Structure

### Documentation (this feature)

```text
specs/005-profile-foundation/
├── plan.md              ← this file
├── research.md          ← technical decisions
├── data-model.md        ← entity definitions
├── quickstart.md        ← validation guide
├── contracts/           ← API contracts per batch
│   ├── batch-1-core.md
│   ├── batch-2-education.md
│   ├── batch-3-languages.md
│   ├── batch-4-tests.md
│   ├── batch-5-preferences.md
│   └── batch-6-documents.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/modules/
├── auth/
│   ├── dto/user-response.dto.ts        ← MODIFY (Batch 1)
│   └── services/oauth-processor.service.ts ← MODIFY (Batch 1)
├── users/
│   ├── users.service.ts                ← MODIFY (Batch 1)
│   └── repositories/users.repository.ts ← MODIFY (Batch 1)
└── profile/
    ├── profile.module.ts               ← MODIFY (every batch)
    ├── controllers/
    │   ├── profile.controller.ts       ← MODIFY (Batch 1)
    │   ├── reference.controller.ts     ← MODIFY (every batch)
    │   ├── educations.controller.ts    ← MODIFY (Batch 2)
    │   ├── languages.controller.ts     ← MODIFY (Batch 3)
    │   ├── test-results.controller.ts  ← NEW (Batch 4)
    │   ├── special-statuses.controller.ts ← NEW (Batch 5)
    │   ├── preferences.controller.ts   ← NEW (Batch 5)
    │   ├── documents.controller.ts     ← MODIFY (Batch 6)
    │   ├── skills.controller.ts        ← DELETE (Batch 1)
    │   └── local-storage.controller.ts ← review/keep
    ├── services/
    │   ├── profile.service.ts          ← REWRITE (Batch 1)
    │   ├── reference.service.ts        ← PARTIAL REWRITE (every batch)
    │   ├── educations.service.ts       ← REWRITE (Batch 2)
    │   ├── languages.service.ts        ← REWRITE (Batch 3)
    │   ├── test-results.service.ts     ← NEW (Batch 4)
    │   ├── special-statuses.service.ts ← NEW (Batch 5)
    │   ├── preferences.service.ts      ← NEW (Batch 5)
    │   ├── system-settings.service.ts  ← NEW (Batch 1)
    │   ├── documents.service.ts        ← REWRITE (Batch 6)
    │   └── skills.service.ts           ← DELETE (Batch 1)
    ├── dto/
    │   ├── update-profile.dto.ts       ← REWRITE (Batch 1)
    │   ├── create-education.dto.ts     ← REWRITE (Batch 2)
    │   ├── update-education.dto.ts     ← REWRITE (Batch 2)
    │   ├── create-language.dto.ts      ← REWRITE (Batch 3)
    │   ├── update-language.dto.ts      ← REWRITE (Batch 3)
    │   ├── create-test-result.dto.ts   ← NEW (Batch 4)
    │   ├── update-test-result.dto.ts   ← NEW (Batch 4)
    │   ├── create-special-status.dto.ts ← NEW (Batch 5)
    │   ├── add-preference.dto.ts       ← NEW (Batch 5)
    │   ├── upload-document.dto.ts      ← REWRITE (Batch 6)
    │   ├── create-skill.dto.ts         ← DELETE (Batch 1)
    │   └── update-skill.dto.ts         ← DELETE (Batch 1)
    └── guards/
        ├── education-ownership.guard.ts ← NO CHANGE
        ├── language-ownership.guard.ts  ← NO CHANGE
        ├── document-ownership.guard.ts  ← NO CHANGE
        └── skill-ownership.guard.ts     ← DELETE (Batch 1)

prisma/
└── schema.prisma                        ← REPLACE (Batch 1, migration)

scripts/
└── seed-education-data.ts               ← NEW (Batch 2)

test/
├── profile.e2e-spec.ts                  ← UPDATE (every batch)
└── auth.e2e-spec.ts                     ← UPDATE (Batch 1, verify token-only)

tests/
└── levora-smoke-tests.json              ← UPDATE (every batch)
```

---

## Batch Structure Overview

| Batch | Scope | Profile Section | Seeding |
|:---:|:---|:---|:---:|
| 1 | Foundation + Auth + Personal Info + Location | Sections 1 & 2 | Yes — roles, SystemSettings |
| 2 | Education | Section 3 | Yes — countries, cities, institutions, majors |
| 3 | Languages | Section 4 | No (education levels exist) |
| 4 | Standardized Tests | Section 5 | No |
| 5 | Special Statuses + Target Preferences | Sections 6 & 7 | No |
| 6 | Documents | Section 8 | No |

Each batch ends with a **Review Gate** before the next batch begins.

---

---

# BATCH 1 — Foundation, Auth Precision Changes, Personal Info & Location

**Goal**: Replace the Prisma schema, apply the four precise auth-module changes,
delete the skills module, create `SystemSettingsService`, rewrite `ProfileService`
for the personal info and location sections, expose the profile and reference
endpoints for those sections, and achieve a fully working and tested Batch 1 state.

**Review Gate**: All endpoints in Section A and the personal-info/location reference
endpoints respond correctly. Auth endpoints return tokens only. Build passes. All
tests pass.

---

## Batch 1 — Parallel Execution Plan

### Track A — Schema Migration (sequential, must finish before any other track)

**Agent**: `oma-architect`

**Step A.1** — Replace `prisma/schema.prisma` entirely with the v2.0 schema from
`docx/complete-schema.md`. This is a wholesale replacement; the entire file
changes.

**Step A.2** — Run the migration:
```bash
pnpm prisma migrate dev --name v2-profile-redesign
```
Verify the migration succeeds with zero errors before signalling readiness.

**Step A.3** — Regenerate Prisma client:
```bash
pnpm prisma generate
```

**Step A.4** — Reference Loader & Initial Seed:
- Run the reference data loader:
  ```bash
  pnpm ts-node scripts/load-reference-data.ts
  ```
- Seed `Roles` table with: `user`, `content_admin`, `system_admin`. Use upsert on name.
- Seed `SystemSettings` with all default keys (upsert on key):
  - `profile.weight_personal_identity` → 18
  - `profile.weight_location_origin` → 15
  - `profile.weight_education` → 35
  - `profile.weight_languages` → 10
  - `profile.weight_tests` → 7
  - `profile.weight_preferences_statuses` → 15
  - `profile.max_educations` → 5
  - `profile.max_languages` → 10
  - `profile.max_test_results` → 10
  - `profile.max_target_degrees` → 5
  - `profile.max_target_majors` → 10
  - `profile.max_target_institutions` → 10
  - `profile.max_bio_length` → 1000
  - `documents.max_size_bytes` → 10485760
  - `documents.allowed_mime_types` → JSON array `["application/pdf","image/jpeg","image/png","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"]`

**Dependency**: All other tracks depend on **A.3 and A.4** completing successfully.

---

### Track B — Auth Precision Changes (sequential within track; parallel with Tracks C–F after Track A completes)

**Agent**: `oma-editor`

> ⚠️ **PRECISION RULE**: Only the four changes listed below are permitted. No
> other auth or users module code is touched. If a change is ambiguous, stop and
> raise a blocker.

**Step B.1** — `src/modules/auth/dto/user-response.dto.ts`

Remove `UserProfileDto` class entirely. Remove the `userProfile?: UserProfileDto`
field from `UserResponseDto`. `UserResponseDto` MUST contain only:
`{ accessToken: string; refreshToken: string }`.

**Step B.2** — `src/modules/auth/services/oauth-processor.service.ts`

- Remove all `fullName` construction (searching for `fullName`, `full_name`, any
  field built from first+last name to pass into `userProfile`).
- Remove `userProfile` from `generateAuthResponse()` return value.
- On OAuth re-login: remove any `fullName`/`profileUpdateData.fullName` update call.
- The profile is touched only to call `userProfile.create` with
  `{ isMatchable: false, completionPct: 0 }` on first OAuth login — nothing else.

**Step B.3** — `src/modules/users/users.service.ts`

In `createUser()`, change the `userProfile.create` block to:
```ts
userProfile: {
  create: {
    isMatchable: false,
    completionPct: 0,
  },
},
```
Remove the `fullName` construction above it. Remove the standalone `createProfile()`
method's `fullName?` parameter — change signature to `createProfile(userId: string)`.

**Step B.4** — `src/modules/users/repositories/users.repository.ts`

- Remove `fullName` from the `USER_SELECT` constant's `userProfile` select block.
- Remove `isDraft` from `USER_SELECT` if present.
- In `createProfile(userId, fullName?)` → change to `createProfile(userId: string)`.
  In the body, remove `fullName` from the create data; only pass
  `{ userId, isMatchable: false, completionPct: 0 }`.

---

### Track C — Skills Module Deletion (parallel with B, D, E, F after Track A)

**Agent**: `oma-quick`

Delete the following files entirely:
- `src/modules/profile/controllers/skills.controller.ts`
- `src/modules/profile/services/skills.service.ts`
- `src/modules/profile/services/skills.service.spec.ts`
- `src/modules/profile/dto/create-skill.dto.ts`
- `src/modules/profile/dto/update-skill.dto.ts`
- `src/modules/profile/guards/skill-ownership.guard.ts`

In `src/modules/profile/profile.module.ts`:
- Remove `SkillsController` from `controllers` array.
- Remove `SkillsService` from `providers` array.
- Remove all `Skills*` imports.

---

### Track D — SystemSettingsService (parallel with B, C, E, F after Track A)

**Agent**: `oma-editor`

Create `src/modules/profile/services/system-settings.service.ts`.

This service provides a `get(key: string, defaultValue: number): Promise<number>`
method that queries `SystemSettings` by key and returns the parsed value, or
`defaultValue` if the key is absent or the value is unparseable.

Also create a constants file
`src/modules/profile/constants/system-settings.keys.ts` with string constants for
all known keys:
- `MATCHING_THRESHOLD` (default: 60)
- `WEIGHT_PERSONAL_IDENTITY` (default: 18)
- `WEIGHT_LOCATION_ORIGIN` (default: 15)
- `WEIGHT_EDUCATION` (default: 35)
- `WEIGHT_LANGUAGES` (default: 10)
- `WEIGHT_TESTS` (default: 7)
- `WEIGHT_PREFERENCES_STATUSES` (default: 15)
- `MAX_EDUCATIONS` (default: 5)
- `MAX_LANGUAGES` (default: 10)
- `MAX_TEST_RESULTS` (default: 10)
- `MAX_TARGET_DEGREES` (default: 5)
- `MAX_TARGET_MAJORS` (default: 10)
- `MAX_TARGET_INSTITUTIONS` (default: 10)
- `MAX_BIO_LENGTH (default 1000)
- `MAX_DOCUMENT_SIZE_BYTES` (default: 10485760)  ← 10 MB
- `ALLOWED_DOCUMENT_MIME_TYPES` (default JSON array, handled separately)

Register `SystemSettingsService` in `profile.module.ts`.

---

### Track E — ProfileService Rewrite + DTOs + Controller (parallel with B, C, D, F after Track A)

**Agent**: `oma-architect` (or dedicate a second instance)

> This is the largest task in Batch 1. The agent rewrites the profile service for
> sections 1 and 2 only. Section 3 (education level on `UserProfiles`) is included
> here because `educationLevelId` is a field on the profile record itself.

**Step E.1** — Rewrite `src/modules/profile/dto/update-profile.dto.ts`

Fields (all optional):
- `firstName?: string` (max 255 chars)
- `lastName?: string` (max 255 chars)
- `email?: string` (email format)
- `dateOfBirth?: string` (ISO date)
- `gender?: 'MALE' | 'FEMALE'` (enum)
- `maritalStatusId?: string` (UUID)
- `phone?: string` (max 30 chars)
- `bio?: string` (max validated dynamically against SystemSettings)
- `profilePhotoUrl?: string` (URL)
- `countryOfResidenceId?: string` (UUID)
- `nationalityId?: string` (UUID)
- `currentCityId?: string` (UUID)
- `educationLevelId?: string` (UUID)

**Step E.2** — Rewrite `src/modules/profile/services/profile.service.ts`

Implement the following methods:
- `getProfile(userId: string)`: Fetch `UserProfiles` with all 8 sub-relations
  (educations, languages, testResults, specialStatuses, targetDegrees, targetMajors,
  targetInstitutions, documents). Sub-relations are empty arrays when not yet
  populated. Never throws 404 — profile always exists (created at signup).
- `updateProfile(userId: string, dto: UpdateProfileDto)`: Update personal info and
  location fields on `UserProfiles`. Validate `bio` length against
  `SystemSettings.MAX_BIO_LENGTH`. After updating, call `recalculate(userId)`.
- `recalculate(userId: string)`: Re-read all profile sub-relations. Compute
  `completionPct` using the weight table from `SystemSettings` (with fallbacks).
  Compute `isMatchable` as `completionPct >= matching.threshold`.
  Increment `matchingVersion` unconditionally. Update `UserProfiles` with the new
  values. Returns `void`.
- Private helper `computeCompletionPct(profile, weights)`: Pure function. Scores:
  - `firstName` present → weight.firstName (3)
  - `lastName` present → weight.lastName (3)
  - `dateOfBirth` present → weight.dateOfBirth (5)
  - `gender` present → weight.gender (4)
  - `maritalStatusId` present → weight.maritalStatusId (3)
  - `countryOfResidenceId` present → weight.countryOfResidenceId (8)
  - `nationalityId` present → weight.nationalityId (7)
  - `educationLevelId` present → weight.educationLevelId (10)
  - `userEducations.length > 0` → weight.hasEducationRecord (25)
  - `userLanguages.length > 0` → weight.hasLanguageRecord (10)
  - `userTestResults.length > 0` → weight.hasTestRecord (7)
  - `userTargetMajors.length > 0` → weight.hasTargetMajor (5)
  - `userTargetDegrees.length > 0` → weight.hasTargetDegree (4)
  - `userTargetInstitutions.length > 0` → weight.hasTargetInstitution (3)
  - `userSpecialStatuses.length > 0` → weight.hasSpecialStatus (3)
  - Sum cannot exceed 100.

**Step E.3** — Rewrite `src/modules/profile/controllers/profile.controller.ts`

Endpoints:
- `GET /profile/me` → calls `ProfileService.getProfile(userId)` — returns full profile
- `PATCH /profile/personal` → calls `ProfileService.updateProfile(userId, dto)`
- Remove `POST /profile/publish`

All endpoints require JWT. Response follows global `{ statusCode, message, data, timestamp }` wrapper.

---

### Track F — Reference Endpoints (personal info section) (parallel with B–E after Track A)

**Agent**: `oma-editor`

Update `src/modules/profile/services/reference.service.ts`:
- Delete `getFieldsOfStudy()` method entirely.
- Delete `getSkillsTaxonomy()` method entirely.
- `getCountries(dto)`: returns `{ data, meta }` supporting pagination, sorting, and search/region filtering.
- `getCities(dto)`: returns `{ data, meta }` supporting pagination, sorting, and countryId/search filtering.
- Add `getMaritalStatuses()`: returns `{ id, nameEn, nameAr }` list.
- Keep `getEducationLevels()` — returns `{ id, code, nameEn, nameAr }`. ✅
- Keep `getAppLanguages()` ✅

Update `src/modules/profile/controllers/reference.controller.ts`:
- Remove `GET /reference/fields-of-study`.
- Remove `GET /reference/skills-taxonomy`.
- Add `GET /reference/countries` (`?search=`) `@Public()`.
- Add `GET /reference/cities` (`?countryId=&search=`) `@Public()`.
- Add `GET /reference/marital-statuses` `@Public()`.

---

### Track G — Tests (runs after all parallel tracks complete)

**Agent**: `oma-reviewer`

**Unit tests** (one `.spec.ts` file per new/rewritten service):
- `system-settings.service.spec.ts` — test get() returns value, returns default on
  missing key, does not throw on DB error.
- `profile.service.spec.ts` — rewrite: test `getProfile`, `updateProfile`,
  `recalculate` with mocked Prisma; test completion percentage
  accuracy across all group combinations.

**Integration tests** (update `test/profile.e2e-spec.ts`):
- `GET /profile/me` — returns 8-section structure, empty sections are `[]`/`null`.
- `PATCH /profile/personal` — personal info updates saved, completion recalculated.
- Auth test: `POST /auth/login` — response contains only `accessToken` and
  `refreshToken`; no `userProfile` key present.
- Reference: `GET /reference/countries`, `GET /reference/cities`,
  `GET /reference/marital-statuses` — return 200 without Bearer token.

**Smoke tests** — Update `tests/levora-smoke-tests.json`:
- Add requests for all Batch 1 endpoints with correct Bearer token usage.
- Add reference endpoint requests (no auth header).
- Each request has `Tests` script asserting status 200/201 and response structure.

**Postman** — Update `Levora_API.postman_collection.json` and
`Levora_API_localhost.postman_collection.json`:
- Update `POST /auth/login` and OAuth callback examples to show token-only response.
- Add `GET /profile/me`, `PATCH /profile/personal` with full
  example request bodies and expected responses.
- Add reference endpoints with `?search=` and `?countryId=` query examples.

**Swagger** — Swagger is auto-generated from decorators. Verify `@ApiTags`,
`@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`, and `@ApiBody` are present on
all new and modified controller methods. Run `pnpm build` to confirm no compile errors.

---

## Batch 1 — Completion Report Template

> To be filled and submitted by the executing agent after all tracks complete.

**Status**: [ ] PASS / [ ] FAIL (with blockers listed)

**Auth Response Change**: Auth endpoints now return only `{ accessToken, refreshToken }`.
No profile data is included in the auth response. Frontend must call
`GET /api/v1/profile/me` to retrieve profile data after login.

**Endpoints Delivered**:

| Method | Path | Auth | Body / Params | Response |
|:---:|:---|:---:|:---|:---|
| `GET` | `/api/v1/profile/me` | Bearer | — | Full profile (8 sections) |
| `PATCH` | `/api/v1/profile/personal` | Bearer | See UpdateProfileDto | Updated profile |
| `GET` | `/api/v1/reference/countries` | Public | `?search=string` | `[{ id, nameEn, nameAr, isoCode, isoCode2 }]` |
| `GET` | `/api/v1/reference/cities` | Public | `?countryId=uuid&search=string` | `[{ id, nameEn, nameAr }]` |
| `GET` | `/api/v1/reference/marital-statuses` | Public | — | `[{ id, nameEn, nameAr }]` |
| `GET` | `/api/v1/reference/education-levels` | Public | — | `[{ id, code, nameEn, nameAr }]` |
| `GET` | `/api/v1/reference/app-languages` | Public | — | `[{code, nameEn, nameAr}]` |

**Matchability**: `isMatchable` is computed automatically inside `recalculate()` as
`completionPct >= matching.threshold` (default 60). There is no user-facing endpoint
for matchability. The frontend must read `isMatchable` from `GET /profile/me`; it
cannot set it.

**Build**: `pnpm build` PASS

**Lint**: `pnpm lint` PASS

**Unit Tests**: `pnpm test` PASS (profile.service, system-settings.service)

**E2E Tests**: `pnpm test:e2e` PASS

---
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
