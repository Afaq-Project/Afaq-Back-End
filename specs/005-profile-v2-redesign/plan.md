# Implementation Plan: Profile Module v2 Redesign

**Branch**: `005-profile-v2-redesign` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

---

> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/005-profile-v2-redesign/endpoints.md`.

## Summary

This plan migrates the Profile Module from v1.3 (free-text, flat data) to v2.0
(structured, relation-driven, matchability-aware). The work is divided into **six
self-contained batches**, each covering one logical profile section. Each batch
is independently deployable and testable. Execution pauses after every batch for
review before the next begins.

Parallelism: within each batch, independent task tracks are assigned to separate
OmA sub-agents and executed concurrently. Tasks with dependencies (e.g., DTO
before Service) remain sequential within their track.

---

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
specs/005-profile-v2-redesign/
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
        ├── education-ownership.guard.ts      ← NO CHANGE
        ├── language-ownership.guard.ts       ← NO CHANGE
        ├── document-ownership.guard.ts       ← NO CHANGE
        ├── test-result-ownership.guard.ts    ← NEW (Batch 4 / Batch 5)
        ├── special-status-ownership.guard.ts ← NEW (Batch 4 / Batch 5)
        ├── preference-ownership.guard.ts     ← NEW (Batch 4 / Batch 5)
        └── skill-ownership.guard.ts          ← DELETE (Batch 1)

prisma/
└── schema.prisma                        ← REPLACE (Batch 1, migration)

scripts/
└── load-reference-data.ts               ← NEW (Batch 1)

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

## Testing & Security Acceptance Baseline

The following documents are binding execution inputs for their mapped batch, not
post-implementation documentation. A batch review gate cannot pass until its mapped
edge cases and security tests are implemented or explicitly recorded as a source-artifact
gap in the completion report.

| Batch | Acceptance edge cases | Security verification | Planned test tasks |
|:---:|:---|:---|:---|
| 1 | [EC-001–012, EC-054–064](edge-cases.md) | [ST-001–005, ST-011–018, ST-027–031](security-testing.md) | [T027–T030](tasks.md#track-g--tests-runs-after-all-parallel-tracks-complete) |
| 2 | [EC-013–022](edge-cases.md) | [ST-006, ST-012–018](security-testing.md) | [T043–T044](tasks.md#track-d--tests-runs-after-tracks-b-and-c-complete) |
| 3 | [EC-023–027](edge-cases.md) | [ST-006, ST-012–018](security-testing.md) | [T054–T055](tasks.md#track-c--tests-parallel-with-track-a-and-b-writes-different-files) |
| 4 | [EC-028–034](edge-cases.md) | [ST-007, ST-012–018](security-testing.md) | [T066–T067](tasks.md#track-c--tests-parallel-with-a-and-b) |
| 5 | [EC-035–042, EC-057–058](edge-cases.md) | [ST-008, ST-011–018](security-testing.md) | [T081–T083](tasks.md#track-d--tests-runs-after-tracks-a-b-and-c-complete) |
| 6 | [EC-043–053, EC-059](edge-cases.md) | [ST-009, ST-016–026](security-testing.md) | [T093–T094](tasks.md#track-c--tests-runs-after-tracks-a-and-b-complete) |

Cross-batch execution must also follow [testing-strategy.md](testing-strategy.md),
particularly its traceability matrix and regression policy, and
[security-controls.md](security-controls.md). The source-artifact gaps documented in
those files are not implementation requirements unless the specification is amended.

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

## Reference Data Loading Strategy

**Loader location**: `scripts/load-reference-data.ts`
**Invocation**: `pnpm ts-node scripts/load-reference-data.ts`
**Execution**: Once, before Batch 1 finishes.
**Idempotency**: The loader uses upsert on `externalSourceId` (or `isoCode` for countries) for every table — re-running is safe. It uses `DATABASE_URL` from `.env`.

**Sources:**
| Table | URL | Notes |
|:---|:---|:---|
| **Countries** | `https://raw.githubusercontent.com/mledoze/countries/master/countries.json` | Use `unMember: true` filter. Arabic names via `translations.ara.common`. |
| **Cities** | `https://download.geonames.org/export/dump/cities1000.zip` | Extract `cities1000.txt` (tab-separated). Country code in col 9, name in col 2. |
| **Institutions** | `https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json` | Fallback `nameAr = nameEn`. |
| **Majors** | `https://nces.ed.gov/pubs2002/cip2000/xls/cip.zip` | Extract `.xls`. Fallback `nameAr = nameEn`. Category from first 2 digits of CIP code. |

**Loading Order (must be strictly followed):**
1. **Countries**
2. **Cities** (requires resolved `countryId`)
3. **MajorCategories** (derived from CIP code prefixes, e.g., `11` → Computer Science)
4. **Majors** (requires resolved `categoryId`)
5. **Institutions** (requires resolved `countryId` + optional `cityId`)

**Transform Rules:**
- **Drop source fields not present in our schema.** Never modify our schema to accommodate the source.
- **Arabic name fallback:** if `translations.ara.common` (or equivalent) is missing, set `nameAr = nameEn`.
- **Cities:** resolve `countryIsoCode2` → `countryId` via `Countries.isoCode2`. Skip cities whose country is not found.
- **Majors:** derive `categoryId` from the CIP code prefix. Create `MajorCategories` rows as needed.
- **Institutions:** resolve `alpha_two_code` → `countryId`; resolve `state_province` → `cityId` when a matching city exists (else set `cityId = null`). Skip institutions whose country is not found.

**Post-Seeding Verification:**
- Count inserted rows per table and log them.
- Verify no duplicate `nameEn` in reference tables with a `@unique` constraint.
- Verify every city has a valid `countryId`.
- Verify every institution has either a valid `countryId` or `null`.
- Log any skipped records with reasons.

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

This service provides two methods:
- `getNumber(key: string, defaultValue: number): Promise<number>`: Returns a numeric setting, or defaultValue if the key is missing or unparseable.
- `getJson<T>(key: string, defaultValue: T): Promise<T>`: Returns a parsed JSON value of type T, or defaultValue if the key is missing or unparseable.

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
  Validate that the configured group weights total exactly 100; derive each
  component weight by proportionally scaling its documented default within its
  configured group.
  Compute `isMatchable` as `completionPct >= SystemSettingsService.getNumber("matching.threshold", 60)`.
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
  - Sum equals 100 when all weighted fields and groups are present.

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
| `GET` | `/api/v1/reference/countries` | Public | `?search=string&page=number&limit=number` | `{ data: [...], meta: {...} }` |
| `GET` | `/api/v1/reference/cities` | Public | `?countryId=uuid&search=string&page=number&limit=number` | `{ data: [...], meta: {...} }` |
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

# BATCH 2 — Education Section

**Goal**: Seed reference data (institutions, majors, roles), fully rewrite
`EducationsService`, update related DTOs and controller, add education-related
reference endpoints, and activate the education group in `completionPct`.

**Prerequisite**: Batch 1 Review Gate PASSED.

**Review Gate**: Education CRUD endpoints work with structured FK-based inputs.
GPA normalization is correct. Duplicate education records are rejected.
Completion percentage reflects education group (35%) correctly. All tests pass.

---

## Batch 2 — Parallel Execution Plan

### Track A — Seeding Strategy (two modes)

**Agent**: `oma-quick`

**Seeding Strategy (two modes)**:
- **Development mode (default for tests)**: `scripts/load-reference-data.ts --sample` loads a curated sample — 20 countries, 50 cities, 30 institutions, 8 major categories, minimum 5 majors per category. Fast and sufficient for tests.
- **Production mode**: `scripts/load-reference-data.ts` fetches and loads the full datasets from external URLs. Run once before going live.

The script is idempotent (upsert on unique keys) and is invoked manually.

---

### Track B — EducationsService + DTOs (parallel with C after Track A)

**Agent**: `oma-architect`

**Step B.1** — Rewrite `src/modules/profile/dto/create-education.dto.ts`:
- `educationLevelId: string` (UUID, required)
- `institutionId: string` (UUID, required)
- `majorId: string` (UUID, required)
- `minorMajorId?: string` (UUID, optional)
- `startDate?: string` (ISO date, optional)
- `endDate?: string` (ISO date, optional — must be after startDate if both present)
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
  all three scales; test duplicate rejection; test MAX_EDUCATIONS enforcement.

E2E — add to `test/profile.e2e-spec.ts`:
- `POST /profile/educations` — creates record, completion increases.
- `PATCH /profile/educations/:id` — updates GPA, gpaNormalized recalculates.
- `DELETE /profile/educations/:id` — deletes, completion decreases.
- Duplicate education record → 409.
- Score out of GPA range → 400 (validated at DTO level).

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
---

# BATCH 3 — Languages Section

**Goal**: Rewrite `LanguagesService`, update DTOs, add proficiency levels
reference endpoint. Update completion engine to include languages group.

**Prerequisite**: Batch 2 Review Gate PASSED.

**Review Gate**: Language CRUD works with structured proficiency level IDs. `isNative`
flag saves correctly. `nameEn`/`nameAr` are returned (not old `name`). Completion
reflects 10% language group. All tests pass.

---

## Batch 3 — Parallel Execution Plan

### Track A — LanguagesService + DTOs

**Agent**: `oma-editor`

**Step A.1** — Rewrite `src/modules/profile/dto/create-language.dto.ts`:
- `languageId: string` (UUID, required) — FK to `LanguagesMaster`
- `proficiencyLevelId: string` (UUID, required) — FK to `ProficiencyLevels`
- `isNative?: boolean` (default false)

`UpdateLanguageDto` = `PartialType(CreateLanguageDto)`.

**Step A.2** — Rewrite `src/modules/profile/services/languages.service.ts`:
- `create(userId, dto)`: Validate language and proficiency level exist. Enforce
  `MAX_LANGUAGES`. Unique constraint: `(userId, languageId)`. Save with
  `userId set to the authenticated user's ID`. Call `ProfileService.recalculate(userId)`.
- `findAll(userId)`: Include `{ language: { select: { nameEn, nameAr } }, proficiencyLevel: { select: { nameEn, nameAr } } }`.
- `findOne(userId, languageId)`: Same includes. 404 if not found.
- `update(userId, languageId, dto)`: Update `proficiencyLevelId`, `isNative`. Call
  `ProfileService.recalculate(userId)`.
- `delete(userId, languageId)`: Hard-delete. Call `ProfileService.recalculate(userId)`.

---

### Track B — Reference: Languages + Proficiency Levels (parallel with A)

**Agent**: `oma-quick`

Update `reference.service.ts`:
- Update `getLanguages()` — select `{ nameEn, nameAr }` instead of `{ name }`.
- Add `getProficiencyLevels()`: returns `{ id, nameEn, nameAr, sortOrder }` ordered by sortOrder ascending.

Update `reference.controller.ts`:
- Verify `GET /reference/languages` is `@Public()` ✅
- Add `GET /reference/proficiency-levels` `@Public()`

---

### Track C — Tests (parallel with A and B)

**Agent**: `oma-reviewer`

Unit: `languages.service.spec.ts` — CRUD, uniqueness, MAX_LANGUAGES, `nameEn/nameAr` in return.

E2E: language CRUD, duplicate rejection (409), proficiency level reference.

Smoke + Postman: language records with `proficiencyLevelId`, show `nameEn/nameAr` in response.

---

## Batch 3 — Completion Report Template

| Method | Path | Auth | Body / Params | Response |
|:---:|:---|:---:|:---|:---|
| `POST` | `/api/v1/profile/languages` | Bearer | `{languageId, proficiencyLevelId, isNative?}` | Language record |
| `GET` | `/api/v1/profile/languages` | Bearer | — | `[LanguageRecord]` |
| `GET` | `/api/v1/profile/languages/:languageId` | Bearer | — | LanguageRecord |
| `PATCH` | `/api/v1/profile/languages/:languageId` | Bearer | UpdateLanguageDto | Updated record |
| `DELETE` | `/api/v1/profile/languages/:languageId` | Bearer | — | 204 |
| `GET` | `/api/v1/reference/languages` | Public | — | `[{ id, nameEn, nameAr }]` |
| `GET` | `/api/v1/reference/proficiency-levels` | Public | — | `[{id, nameEn, nameAr, sortOrder}]` |

---
---

# BATCH 4 — Standardized Tests Section

**Goal**: Create `TestResultsService` and `TestResultsController`, validate score
against min/max/step, add `GET /reference/standardized-tests`, update completion.

**Prerequisite**: Batch 3 Review Gate PASSED.

**Review Gate**: Test results CRUD works. Score outside min/max or not aligned to
step is rejected (400). Duplicate test type is rejected (409). Completion reflects
7% tests group. All tests pass.

---

## Batch 4 — Parallel Execution Plan

### Track A — TestResultsService + DTOs + Controller

**Agent**: `oma-editor`

**DTOs** — `src/modules/profile/dto/create-test-result.dto.ts`:
- `testId: string` (UUID, required) — FK to `StandardizedTests`
- `score: number` (required)
- `testDate?: string` (ISO date, optional)

`UpdateTestResultDto` = `PartialType(CreateTestResultDto)`.

**Service** — `src/modules/profile/services/test-results.service.ts`:
- `create(userId, dto)`: Load `StandardizedTests` record by `testId`. Validate:
  - `score >= minScore && score <= maxScore` — reject 400 if not.
  - `(score - minScore) % scoreStep === 0` — reject 400 if not aligned to step.
  - Unique: `(userId, testId)` — reject 409 if duplicate.
  - `MAX_TEST_RESULTS` from `SystemSettings`.
  - Save with `userId set to the authenticated user's ID`. Call `ProfileService.recalculate(userId)`.
- `findAll(userId)`: Include `{ test: { select: { nameEn, nameAr, minScore, maxScore, scoreStep } } }`.
- `findOne(userId, id)`: 404 if not found.
- `update(userId, id, dto)`: Re-validate score if changed. Call `recalculate`.
- `delete(userId, id)`: Hard-delete. Call `recalculate`.

**Controller** — `src/modules/profile/controllers/test-results.controller.ts`:
- `POST /profile/test-results`
- `GET /profile/test-results`
- `GET /profile/test-results/:id`
- `PATCH /profile/test-results/:id`
- `DELETE /profile/test-results/:id`

All with `@UseGuards(JwtAuthGuard)` (and `TestResultOwnershipGuard` for `:id` routes) and standard Swagger decorators.

---

### Track B — Reference: Standardized Tests (parallel with A)

**Agent**: `oma-quick`

Add `getStandardizedTests()` to `reference.service.ts`:
Returns `{ id, nameEn, nameAr, minScore, maxScore, scoreStep }`.

Add `GET /reference/standardized-tests` `@Public()` to `reference.controller.ts`.

---

### Track C — Tests (parallel with A and B)

**Agent**: `oma-reviewer`

Unit: `test-results.service.spec.ts` — all CRUD, score range validation, step
validation (off-step score rejected), duplicate rejection, MAX_TEST_RESULTS.

E2E: full CRUD, off-range score (400), off-step score (400), duplicate (409),
reference endpoint.

Smoke + Postman: test result CRUD with IELTS/TOEFL/GRE example payloads.

---

## Batch 4 — Completion Report Template

| Method | Path | Auth | Body / Params | Response |
|:---:|:---|:---:|:---|:---|
| `POST` | `/api/v1/profile/test-results` | Bearer | `{testId, score, testDate?}` | TestResult |
| `GET` | `/api/v1/profile/test-results` | Bearer | — | `[TestResult]` |
| `GET` | `/api/v1/profile/test-results/:id` | Bearer | — | TestResult |
| `PATCH` | `/api/v1/profile/test-results/:id` | Bearer | UpdateTestResultDto | Updated |
| `DELETE` | `/api/v1/profile/test-results/:id` | Bearer | — | 204 |
| `GET` | `/api/v1/reference/standardized-tests` | Public | — | `[{id, nameEn, nameAr, min, max, step}]` |

---
---

# BATCH 5 — Special Statuses + Target Preferences

**Goal**: Create `SpecialStatusesService`, `PreferencesService`, their controllers,
add special statuses and preferences reference endpoints, complete the completion
engine (all 6 groups now active).

**Prerequisite**: Batch 4 Review Gate PASSED.

**Review Gate**: All preference and status endpoints work. Deduplication is silent.
Completion percentage is now accurate across all 6 groups (total 100%). All tests pass.

---

## Batch 5 — Parallel Execution Plan

### Track A — SpecialStatusesService + Controller (parallel with B, C)

**Agent**: `oma-editor`

**DTO** — `src/modules/profile/dto/create-special-status.dto.ts`:
- `specialStatusId: string` (UUID, required)

**Service** — `src/modules/profile/services/special-statuses.service.ts`:
- `add(userId, dto)`: Validate status exists. Check uniqueness `(userId, specialStatusId)` — silently `upsert` (no duplicate). Save. Call `recalculate`.
- `findAll(userId)`: Return user's statuses with `{ specialStatus: { nameEn, nameAr } }`.
- `remove(userId, specialStatusId)`: Hard-delete. Call `recalculate`.

**Controller** — `src/modules/profile/controllers/special-statuses.controller.ts`:
- `POST /profile/special-statuses`
- `GET /profile/special-statuses`
- `DELETE /profile/special-statuses/:specialStatusId`

---

### Track B — PreferencesService + Controller (parallel with A, C)

**Agent**: `oma-editor` (second instance)

**DTO** — `src/modules/profile/dto/add-preference.dto.ts`:
- `educationLevelId?: string` (UUID) — for target degrees
- `majorId?: string` (UUID) — for target majors
- `institutionId?: string` (UUID) — for target institutions

Three separate endpoint-specific DTOs inherit from this or are minimal single-field DTOs.

**Service** — `src/modules/profile/services/preferences.service.ts`:
- `getAll(userId)`: Returns `{ targetDegrees, targetMajors, targetInstitutions }` as
  a unified object.
- `addDegree(userId, educationLevelId)`: Upsert. Enforce `MAX_TARGET_DEGREES`. Call `recalculate`.
- `removeDegree(userId, educationLevelId)`: Hard-delete. Call `recalculate`.
- `addMajor(userId, majorId)`: Upsert. Enforce `MAX_TARGET_MAJORS`. Call `recalculate`.
- `removeMajor(userId, majorId)`: Hard-delete. Call `recalculate`.
- `addInstitution(userId, institutionId)`: Upsert. Enforce `MAX_TARGET_INSTITUTIONS`. Call `recalculate`.
- `removeInstitution(userId, institutionId)`: Hard-delete. Call `recalculate`.

**Controller** — `src/modules/profile/controllers/preferences.controller.ts`:
- `GET /profile/preferences`
- `POST /profile/preferences/degrees`
- `DELETE /profile/preferences/degrees/:educationLevelId`
- `POST /profile/preferences/majors`
- `DELETE /profile/preferences/majors/:majorId`
- `POST /profile/preferences/institutions`
- `DELETE /profile/preferences/institutions/:institutionId`

---

### Track C — Reference: Special Statuses (parallel with A, B)

**Agent**: `oma-quick`

Add `getSpecialStatuses()` to `reference.service.ts`:
Returns `{ id, nameEn, nameAr }`.

Add `GET /reference/special-statuses` `@Public()`.

---

### Track D — Tests

**Agent**: `oma-reviewer`

Unit: `special-statuses.service.spec.ts`, `preferences.service.spec.ts` — all
operations, deduplication, limit enforcement.

E2E: full sequence; verify deduplication (same add twice → no error, no duplicate);
verify `GET /profile/preferences` returns unified object.

Also: verify `GET /profile/me` now returns non-null `specialStatuses` and
`targetPreferences` sub-arrays after data added.

Completion accuracy test: user with all groups filled → `completionPct = 100`.

Smoke + Postman: preferences and statuses with example payloads.

---

## Batch 5 — Completion Report Template

| Method | Path | Auth | Body / Params | Response |
|:---:|:---|:---:|:---|:---|
| `POST` | `/api/v1/profile/special-statuses` | Bearer | `{specialStatusId}` | Status record |
| `GET` | `/api/v1/profile/special-statuses` | Bearer | — | `[SpecialStatus]` |
| `DELETE` | `/api/v1/profile/special-statuses/:specialStatusId` | Bearer | — | 204 |
| `GET` | `/api/v1/profile/preferences` | Bearer | — | `{targetDegrees, targetMajors, targetInstitutions}` |
| `POST` | `/api/v1/profile/preferences/degrees` | Bearer | `{educationLevelId}` | Record |
| `DELETE` | `/api/v1/profile/preferences/degrees/:educationLevelId` | Bearer | — | 204 |
| `POST` | `/api/v1/profile/preferences/majors` | Bearer | `{majorId}` | Record |
| `DELETE` | `/api/v1/profile/preferences/majors/:majorId` | Bearer | — | 204 |
| `POST` | `/api/v1/profile/preferences/institutions` | Bearer | `{institutionId}` | Record |
| `DELETE` | `/api/v1/profile/preferences/institutions/:institutionId` | Bearer | — | 204 |
| `GET` | `/api/v1/reference/special-statuses` | Public | — | `[{ id, nameEn, nameAr }]` |

---
---

# BATCH 6 — Documents Section

**Goal**: Rewrite `DocumentsService` with storage-first deletion, replace `docType`
string with `documentTypeId` FK, enforce file size and MIME type from
`SystemSettings`, add document types reference endpoint.

**Prerequisite**: Batch 5 Review Gate PASSED.

**Review Gate**: Upload works with `documentTypeId`. Unknown MIME type or oversized
file is rejected (400). Deletion is storage-first — a simulated storage failure
leaves the DB record intact. Signed download URLs work. All tests pass.

---

## Batch 6 — Parallel Execution Plan

### Track A — DocumentsService + DTO Rewrite

**Agent**: `oma-architect`

**Step A.1** — Rewrite `src/modules/profile/dto/upload-document.dto.ts`:
- Remove `docType` string enum field entirely.
- Add `documentTypeId: string` (UUID, required) — FK to `DocumentTypes`.

**Step A.2** — Rewrite `src/modules/profile/services/documents.service.ts`:
- `upload(userId, file, dto)`:
  - Load max file size using `SystemSettingsService.getNumber('documents.max_size_bytes', 10485760)`.
  - Load allowed MIME types using `SystemSettingsService.getJson<string[]>('documents.allowed_mime_types', ["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"])`.
  - Validate file size ≤ max. Reject 400 if exceeded.
  - Validate `file.mimetype` is in allowed list. Reject 400 if not.
  - Validate `documentTypeId` exists in `DocumentTypes`. Reject 400 if not.
  - Upload to storage provider via `StorageService`.
  - Create `Documents` record with `storageKey`, `fileName`, `mimeType`, `fileSize`,
    `documentTypeId`, `userId set to the authenticated user's ID`.
  - If record creation fails after storage upload, immediately attempt to delete the
    uploaded storage object, then return the error. Do not call `recalculate()`;
    documents do not affect matching state.
- `findAll(userId)`: Return all documents with `{ documentType: { nameEn, nameAr } }`.
- `getDownloadUrl(userId, id)`: Generate signed URL via `StorageService`. 404 if not found.
- `delete(userId, id)`:
  1. Find document record. 404 if not found.
  2. Call `StorageService.delete(storageKey)`.
  3. **Only if step 2 succeeds**: delete DB record.
  4. Do not call `ProfileService.recalculate()`; documents do not affect matching state.
  5. If step 2 throws: re-throw error; DB record is preserved.

**Step A.3** — Remove `isEncrypted` from all select/include blocks and DB writes.
Remove `deletedAt` handling — no soft-delete.

---

### Track B — Reference: Document Types (parallel with A)

**Agent**: `oma-quick`

Add `getDocumentTypes()` to `reference.service.ts`:
Returns `{ id, nameEn, nameAr }`.

Add `GET /reference/document-types` `@Public()`.

---

### Track C — Tests

**Agent**: `oma-reviewer`

Unit: `documents.service.spec.ts` — test upload (valid file passes, oversized
fails, disallowed MIME fails, database-write failure after storage upload → attempted
storage cleanup), test storage-first deletion (storage success →
DB deleted; storage throws → DB record retained and error propagated), test
download URL generation.

E2E: full upload/list/download/delete sequence; upload with oversized file (400);
upload with invalid MIME (400); simulated record-creation failure after upload → no
orphaned file; simulated storage failure on delete → record persists.

Smoke + Postman: document upload (multipart/form-data example with `documentTypeId`),
download URL, delete.

---

## Batch 6 — Completion Report Template

| Method | Path | Auth | Body / Params | Response |
|:---:|:---|:---:|:---|:---|
| `POST` | `/api/v1/profile/documents` | Bearer | `multipart/form-data: file, documentTypeId` | Document record |
| `GET` | `/api/v1/profile/documents` | Bearer | — | `[DocumentRecord]` |
| `GET` | `/api/v1/profile/documents/:id/download` | Bearer | — | `{ signedUrl }` |
| `DELETE` | `/api/v1/profile/documents/:id` | Bearer | — | 204 |
| `GET` | `/api/v1/reference/document-types` | Public | — | `[{ id, nameEn, nameAr }]` |

---
---

# Cross-Batch Invariants

These rules apply to every batch and every task:

1. **Lint before merge**: `pnpm lint` must pass with zero errors.
2. **Build before merge**: `pnpm build` must succeed — the TypeScript compiler is the final gate.
3. **No partial merges**: A batch is never considered done if any test in that batch's scope is failing.
4. **Recalculation contract**: Every write operation (create, update, delete) on any profile sub-section
   MUST call `ProfileService.recalculate(userId)` before returning. Document upload
   and deletion are the exception because documents do not affect completion or
   matching state.
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
