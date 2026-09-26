> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/005-profile-v2-redesign/endpoints.md`.

# Tasks: Profile Module v2 Redesign

**Branch**: `005-profile-v2-redesign`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Organization**: Tasks are grouped by batch. Within each batch, tracks that can
run in parallel are clearly identified. Track A of each batch is always a blocking
prerequisite — all other tracks within that batch start only after Track A completes.

**Format**: `[ID] [P?] [Story?] Description — file path`
- `[P]`: Parallelizable within the same batch (different files, no intra-batch dependency)
- `[US#]`: Maps to a User Story in spec.md

---

## Batch 1 — Foundation, Auth Precision, Personal Info & Location

**Acceptance baseline**: Execute [EC-001–012 and EC-054–064](edge-cases.md),
[ST-001–005, ST-011–018, and ST-027–031](security-testing.md), and the applicable
controls in [security-controls.md](security-controls.md) through T027–T030. Follow
the [testing strategy](testing-strategy.md) and record any declared source-artifact gap.

**Unblocks**: US1, US9, US10 (core profile structure + completion engine)

**Review Gate**: Auth returns tokens only. `GET /profile/me` returns 8-section structure.
Personal info and location updates recalculate completion. Reference endpoints respond
without auth. `pnpm build` + `pnpm lint` + all tests pass.

---

### Track A — Schema Migration *(sequential — blocks all other tracks)*

- [ ] T001 Replace `prisma/schema.prisma` entirely with the v2.0 schema from `docx/complete-schema.md` — `prisma/schema.prisma`
- [ ] T002 Run `pnpm prisma migrate dev --name v2-profile-redesign` and verify migration succeeds with zero errors. After the migration succeeds, review the generated SQL file in prisma/migrations/ before committing it. Verify no unexpected destructive operations (DROP TABLE, DROP COLUMN) exist unless they are intentional and covered by a backup step. This review is mandatory per Constitution Principle III. — `prisma/migrations/`
- [ ] T003 Run `pnpm prisma generate` to regenerate the Prisma client — `node_modules/.prisma/client/`
- [ ] T004 Create `scripts/load-reference-data.ts` — a standalone script using `DATABASE_URL` from `.env` that fetches reference data from external URLs, drops extra fields not in schema, and inserts into tables. Fallback `nameAr = nameEn` when missing. Loading Order: Countries (JSON, `unMember: true`) → Cities (ZIP/txt, resolving `countryIsoCode2` → `countryId`) → MajorCategories (from CIP prefixes) → Majors (ZIP/xls, resolving `categoryId`) → Institutions (JSON, resolving `alpha_two_code` → `countryId` and `state_province` → `cityId`). Skip rows with unresolved countries. Set `cityId = null` if unresolved. Idempotent via upsert on `externalSourceId` (or `isoCode`). Post-seeding: log inserted/skipped counts per table, verify no duplicate `nameEn`, verify FKs (every city has `countryId`, every institution has `countryId` or `null`). Invocation: `pnpm ts-node scripts/load-reference-data.ts` — `scripts/load-reference-data.ts`
- [ ] T005 Create a Prisma seed snippet (or extend `prisma/seed.ts`) that upserts the `Roles` table with: `user`, `content_admin`, `system_admin` — `prisma/seed.ts`
- [ ] T006 Extend the seed to upsert all 16 `SystemSettings` default keys: `matching.threshold → 60`, `profile.weight_personal_identity → 18`, `profile.weight_location_origin → 15`, `profile.weight_education → 35`, `profile.weight_languages → 10`, `profile.weight_tests → 7`, `profile.weight_preferences_statuses → 15`, `profile.max_educations → 5`, `profile.max_languages → 10`, `profile.max_test_results → 10`, `profile.max_target_degrees → 5`, `profile.max_target_majors → 10`, `profile.max_target_institutions → 10`, `profile.max_bio_length → 1000`, `documents.max_size_bytes → 10485760`, `documents.allowed_mime_types → JSON array: ["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]` — `prisma/seed.ts`
- [ ] T007 Run the reference data loader and seed script. Verify all tables have data. Confirm no errors — *(shell command, no source file)*

**✅ Checkpoint A**: Schema migrated, Prisma client generated, roles and SystemSettings seeded. All other Batch 1 tracks may now start in parallel.

---

### Track B — Auth Precision Changes *(parallel after Track A; [P] with Tracks C, D, E, F)*

> ⚠️ PRECISION RULE: Only the four changes listed below are permitted. No other auth or users module code is touched.

- [ ] T008 [P] [US9] Remove `UserProfileDto` class entirely from `src/modules/auth/dto/user-response.dto.ts`. Remove the `userProfile?: UserProfileDto` field from `UserResponseDto`. Final `UserResponseDto` shape: `{ accessToken: string; refreshToken: string }` only — `src/modules/auth/dto/user-response.dto.ts`
- [ ] T009 [P] [US9] In `src/modules/auth/services/oauth-processor.service.ts`: remove all `fullName` construction logic. Remove `userProfile` from the `generateAuthResponse()` return value. On OAuth re-login: remove any `fullName`/`profileUpdateData.fullName` update call. First OAuth login still calls `userProfile.create` with `{ isMatchable: false, completionPct: 0 }` only — `src/modules/auth/services/oauth-processor.service.ts`
- [ ] T010 [P] [US9] In `src/modules/users/users.service.ts`: change `userProfile.create` block in `createUser()` to `{ isMatchable: false, completionPct: 0 }` only. Remove the `fullName` construction above it. Change `createProfile()` method signature to `createProfile(userId: string)` (remove `fullName?` parameter) — `src/modules/users/users.service.ts`
- [ ] T011 [P] [US9] In `src/modules/users/repositories/users.repository.ts`: remove `fullName` from the `USER_SELECT` constant's `userProfile` select block. Remove `isDraft` from `USER_SELECT`. Change `createProfile(userId, fullName?)` to `createProfile(userId: string)`. In the body, remove `fullName` from create data; pass only `{ userId, isMatchable: false, completionPct: 0 }` — `src/modules/users/repositories/users.repository.ts`

---

### Track C — Skills Module Deletion *(parallel after Track A; [P] with Tracks B, D, E, F)*

- [ ] T012 [P] Delete `src/modules/profile/controllers/skills.controller.ts` — `src/modules/profile/controllers/skills.controller.ts`
- [ ] T013 [P] Delete `src/modules/profile/services/skills.service.ts` — `src/modules/profile/services/skills.service.ts`
- [ ] T014 [P] Delete `src/modules/profile/services/skills.service.spec.ts` if it exists — `src/modules/profile/services/skills.service.spec.ts`
- [ ] T015 [P] Delete `src/modules/profile/dto/create-skill.dto.ts` — `src/modules/profile/dto/create-skill.dto.ts`
- [ ] T016 [P] Delete `src/modules/profile/dto/update-skill.dto.ts` — `src/modules/profile/dto/update-skill.dto.ts`
- [ ] T017 [P] Delete `src/modules/profile/guards/skill-ownership.guard.ts` — `src/modules/profile/guards/skill-ownership.guard.ts`
- [ ] T018 [P] In `src/modules/profile/profile.module.ts`: remove `SkillsController` from `controllers[]`, `SkillsService` from `providers[]`, and all `Skills*` import statements — `src/modules/profile/profile.module.ts`

---

### Track D — SystemSettingsService *(parallel after Track A; [P] with Tracks B, C, E, F)*

- [ ] T019 [P] Create `src/modules/profile/constants/system-settings.keys.ts` with exported string constants for all 16 keys: `MATCHING_THRESHOLD = 'matching.threshold'`, `WEIGHT_PERSONAL_IDENTITY = 'profile.weight_personal_identity'`, `WEIGHT_LOCATION_ORIGIN = 'profile.weight_location_origin'`, `WEIGHT_EDUCATION = 'profile.weight_education'`, `WEIGHT_LANGUAGES = 'profile.weight_languages'`, `WEIGHT_TESTS = 'profile.weight_tests'`, `WEIGHT_PREFERENCES_STATUSES = 'profile.weight_preferences_statuses'`, `MAX_EDUCATIONS = 'profile.max_educations'`, `MAX_LANGUAGES = 'profile.max_languages'`, `MAX_TEST_RESULTS = 'profile.max_test_results'`, `MAX_TARGET_DEGREES = 'profile.max_target_degrees'`, `MAX_TARGET_MAJORS = 'profile.max_target_majors'`, `MAX_TARGET_INSTITUTIONS = 'profile.max_target_institutions'`, `MAX_BIO_LENGTH = 'profile.max_bio_length'`, `MAX_DOCUMENT_SIZE_BYTES = 'documents.max_size_bytes'`, `ALLOWED_DOCUMENT_MIME_TYPES = 'documents.allowed_mime_types'` — `src/modules/profile/constants/system-settings.keys.ts`
- [ ] T020 [P] Create `src/modules/profile/services/system-settings.service.ts` with an injectable `SystemSettingsService` class. Implement two methods: `getNumber(key: string, defaultValue: number): Promise<number>` (returns a numeric setting, or defaultValue if the key is missing or unparseable) and `getJson<T>(key: string, defaultValue: T): Promise<T>` (returns a parsed JSON value of type T, or defaultValue if missing or unparseable). Both query `prisma.systemSettings.findUnique({ where: { key } })` and never throw — `src/modules/profile/services/system-settings.service.ts`
- [ ] T021 [P] Register `SystemSettingsService` in `providers[]` of `src/modules/profile/profile.module.ts` and add it to `exports[]` so other services can inject it — `src/modules/profile/profile.module.ts`

---

### Track E — ProfileService Rewrite + DTOs + Controller *(parallel after Track A; [P] with Tracks B, C, D, F)*

- [ ] **T022** — Rewrite `update-profile.dto.ts` with all 14 fields (13 original + `experiences`). `experiences?: string[]` with `@IsOptional`, `@IsArray`, `@IsString({each:true})`, `@ArrayMaxSize(10)`, `@MaxLength(500, {each:true})`, `@SanitizeString({each:true})`. — `src/modules/profile/dto/update-profile.dto.ts`
- [ ] T023 [P] [US10] Rewrite `src/modules/profile/services/profile.service.ts`. Implement: `getProfile(userId)` fetching `UserProfiles` with all 8 sub-relations (educations, languages, testResults, specialStatuses, targetDegrees, targetMajors, targetInstitutions, documents); never throws 404. `updateProfile(userId, dto)`: validate `bio` max length; `updateProfile(userId, dto)` validates `experiences.length` against `SystemSettingsService.getNumber(MAX_EXPERIENCES, 10)` and throws `400 TOO_MANY_EXPERIENCES` when exceeded; validate city-country consistency (clear `currentCityId` if mismatched with new country, throw `400 CITY_COUNTRY_MISMATCH` if explicitly mismatched city sent); update fields on `UserProfiles`; call `recalculate(userId)`. `recalculate(userId)`: re-fetch full profile with all sub-relations; validate the configured completion group weights total exactly 100; proportionally scale each documented component weight within its configured group; compute `completionPct`; compute `isMatchable = completionPct >= SystemSettingsService.getNumber("matching.threshold", 60)` so it reverts to `false` below the threshold; increment `matchingVersion` unconditionally; update `UserProfiles` with new `completionPct`, `isMatchable`, and `matchingVersion`. Private `computeCompletionPct(profile, weights)`: pure function; score all 15 fields/groups per the weight table in plan.md; all completed groups total 100. All complex public methods (recalculate, computeCompletionPct, updateProfile) MUST have JSDoc comments explaining their purpose, parameters, return values, and side effects (e.g., incrementing matchingVersion). — `src/modules/profile/services/profile.service.ts`
- [ ] T024 [P] [US8] [US9] Rewrite `src/modules/profile/controllers/profile.controller.ts`. Endpoints: `GET /profile/me` → `ProfileService.getProfile(userId)`; `PATCH /profile/personal` → `ProfileService.updateProfile(userId, dto)` with `UpdateProfileDto`. Remove `POST /profile/publish`. All endpoints require JWT. Add `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` on each method — `src/modules/profile/controllers/profile.controller.ts`

---

### Track F — Reference Endpoints (Personal Info Section) *(parallel after Track A; [P] with Tracks B, C, D, E)*

- [ ] T025 [P] [US1] In `src/modules/profile/services/reference.service.ts`: delete `getFieldsOfStudy()` method entirely. Delete `getSkillsTaxonomy()` method entirely. Add `getCountries(dto)` returning `{ data, meta }` supporting pagination, sorting, and `search`/`region` filtering. Add `getCities(dto)` returning `{ data, meta }` supporting pagination, sorting, and `countryId`/`search` filtering. Add `getMaritalStatuses()` returning `{ id, nameEn, nameAr }`. Ensure `getEducationLevels()` returns `{ id, code, nameEn, nameAr }` (update field mapping) — `src/modules/profile/services/reference.service.ts`
- [ ] T026 [P] [US1] In `src/modules/profile/controllers/reference.controller.ts`: remove `GET /reference/fields-of-study` handler. Remove `GET /reference/skills-taxonomy` handler. Add `GET /reference/countries` handler with Pagination DTO; mark `@Public()`. Add `GET /reference/cities` handler with Pagination DTO; mark `@Public()`. Add `GET /reference/marital-statuses` handler; mark `@Public()`. Add `@ApiOperation`, `@ApiResponse` on each new handler — `src/modules/profile/controllers/reference.controller.ts`

---

### Track G — Tests *(runs after all parallel tracks complete)*

- [ ] T027 [US10] Create `src/modules/profile/services/system-settings.service.spec.ts`. Tests: `get()` returns parsed value from DB; `get()` returns `defaultValue` when key absent; `get()` returns `defaultValue` when DB value is unparseable; never throws — `src/modules/profile/services/system-settings.service.spec.ts`
- [ ] T028 [US10] Rewrite `src/modules/profile/services/profile.service.spec.ts`. Tests: `getProfile()` returns 8-section structure with empty arrays for unpopulated sub-relations; `updateProfile()` saves fields and calls `recalculate()`; `recalculate()` increments `matchingVersion` unconditionally; `isMatchable` transitions both false→true and true→false at the configured threshold; `computeCompletionPct()` validates the 100% group-total invariant, proportional component scaling, and all 15 field/group combinations (all empty → 0, all filled → 100, partial combinations → correct sum) — `src/modules/profile/services/profile.service.spec.ts`
- [ ] T029 [US9] Update `test/profile.e2e-spec.ts`. Add/update E2E tests: `GET /profile/me` returns 8-section structure; empty sections return `[]` or `null` (never omitted); `PATCH /profile/personal` saves personal info and recalculates completion; `recalculate()` updates `isMatchable` automatically when completion crosses the threshold in either direction; attempts to submit `completionPct`, `isMatchable`, or `matchingVersion` return `400 UNKNOWN_FIELD`; reference endpoints `GET /reference/countries`, `/reference/cities`, `/reference/marital-statuses` return 200 without Bearer token — `test/profile.e2e-spec.ts`
- [ ] T030 [US9] Update `test/auth.e2e-spec.ts`. Add assertion: `POST /auth/login` response `data` contains only `accessToken` and `refreshToken`. Assert no `userProfile` key is present anywhere in the response — `test/auth.e2e-spec.ts`
- [ ] T031 [US1] Update `tests/levora-smoke-tests.json`. Add requests for: `GET /profile/me`, `PATCH /profile/personal` (with personal info body), `GET /reference/countries` (no auth), `GET /reference/cities?countryId=...` (no auth), `GET /reference/marital-statuses` (no auth). Each request has `Tests` script asserting status code and response shape — `tests/levora-smoke-tests.json`
- [ ] T032 [US1] Update `Levora_API.postman_collection.json` and `Levora_API_localhost.postman_collection.json`. Update `POST /auth/login` example to token-only response. Add `GET /profile/me`, `PATCH /profile/personal` with full example bodies. Add reference endpoint entries with `?search=` and `?countryId=` query examples — `Levora_API.postman_collection.json`, `Levora_API_localhost.postman_collection.json`
- [ ] T033 Verify `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` (or `@Public()`) are present on all new and modified controller methods in `profile.controller.ts` and `reference.controller.ts`. Run `pnpm build` and confirm no compile errors — *(build verification)*
- [ ] T034 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e`. All must exit 0 — *(final gate)*
- [ ] T034b [US9] Prepare a frontend coordination note documenting the 7 frontend requirements: (1) Auth returns only tokens; (2) forbidNonWhitelisted is active; (3) PATCH /profile is renamed to PATCH /profile/personal; (4) the matchable endpoint is removed; (5) City selection must be filtered and cleared on country change; (6) Reference endpoints now use pagination { data, meta }; (7) EducationLevel response shape changed to code/nameEn/nameAr. Share this note with the frontend team before Batch 1 is considered complete — *(documentation task)*

**✅ Batch 1 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 2.

---
---

## Batch 2 — Education Section

**Acceptance baseline**: Execute [EC-013–022](edge-cases.md) and
[ST-006 and ST-012–018](security-testing.md) through T043–T044. Apply the
cross-batch strategy and controls linked in [plan.md](plan.md#testing--security-acceptance-baseline).

**Prerequisite**: Batch 1 Review Gate PASSED.
**Unblocks**: US2 (education history + GPA normalization)

**Review Gate**: Education CRUD with FK-based inputs works. GPA normalization is correct
for all 3 scales. Duplicate education records rejected (409). Completion reflects 35%
education group. All tests pass.

---

### Track A — Seeding Script *(sequential — blocks Tracks B and C)*

- [ ] T035 Update `scripts/load-reference-data.ts` to support a `--sample` flag as a development-mode seeder. When run with this flag, instead of fetching from production URLs, insert a curated sample of: 20 countries, 50 cities (resolved by countryIsoCode2 → countryId lookup), 8 major categories, at least 5 majors per category (minimum 40 total), 30 institutions (with countryId and cityId resolved). All inserts use upsert on unique keys. Script must remain idempotent. Invocation: `pnpm ts-node scripts/load-reference-data.ts --sample` — `scripts/load-reference-data.ts`
- [ ] T036 Run `pnpm ts-node scripts/load-reference-data.ts --sample` and verify all sample data is present in the database. Confirm no errors — *(shell command)*

**✅ Checkpoint A**: Sample reference data seeded. Tracks B and C may start in parallel.

---

### Track B — EducationsService + DTOs + Controller *(parallel after Track A; [P] with Track C)*

- [ ] T037 [P] [US2] Rewrite `src/modules/profile/dto/create-education.dto.ts`. Required: `educationLevelId: string` (UUID), `institutionId: string` (UUID), `majorId: string` (UUID). Optional: `minorMajorId?: string` (UUID), `startDate?: string` (ISO date), `endDate?: string` (ISO date), `expectedGraduationDate?: string` (ISO date), `isCurrent?: boolean`, `gpaRaw?: number` (min 0), `gpaScale?: 'OUT_OF_4' | 'OUT_OF_5' | 'OUT_OF_100'`. Add `@ValidateIf` on `gpaScale` to require it when `gpaRaw` is provided. Add cross-field validation: `endDate` must be after `startDate` when both provided — `src/modules/profile/dto/create-education.dto.ts`
- [ ] T038 [P] [US2] Create `src/modules/profile/dto/update-education.dto.ts` as `PartialType(CreateEducationDto)` — `src/modules/profile/dto/update-education.dto.ts`
- [ ] T039 [P] [US2] Rewrite `src/modules/profile/services/educations.service.ts`. Implement: `create(userId, dto)` — validate institution, major, and education level exist in DB; check uniqueness `(userId, institutionId, majorId, educationLevelId)` and throw 409 if duplicate; enforce `MAX_EDUCATIONS` from `SystemSettings` (throw 409 if limit reached); compute `gpaNormalized` using formula (OUT_OF_4: raw; OUT_OF_5: raw×4/5; OUT_OF_100: raw×4/100); save to `UserEducations` with `userId` as FK to `UserProfiles.userId`; call `ProfileService.recalculate(userId)`. Enforce the following domain rules on both `create` and `update`: if `isCurrent = true` → forcibly set `endDate = null`; if `isCurrent = false` → forcibly set `expectedGraduationDate = null`; if `minorMajorId` equals `majorId` → throw `400 MINOR_MAJOR_EQUALS_MAJOR`; if both `endDate` and `startDate` are present and `endDate < startDate` → throw `400 INVALID_DATE_RANGE`. `findAll(userId)`: return all records with embedded educationLevel, institution, major, minorMajor objects. `findOne(userId, id)`: 404 if not found or userId mismatch. `update(userId, id, dto)`: update fields, recompute `gpaNormalized` if gpaRaw/gpaScale changed; call `recalculate`. `delete(userId, id)`: hard-delete, call `recalculate`. GPA normalization logic MUST be documented with JSDoc on the private normalizeGpa helper explaining the three supported scales and the conversion formula. — `src/modules/profile/services/educations.service.ts`
- [ ] T040 [P] [US2] Update `src/modules/profile/controllers/educations.controller.ts`. Verify it uses the updated service signatures. Add `@ApiBody`, `@ApiOperation`, `@ApiResponse` on all methods if missing. Add a new `GET /profile/educations/:id` route that calls `EducationsService.findOne(userId, id)` and returns a single record. Include the `EDUCATION_NOT_FOUND` (404) error response. — `src/modules/profile/controllers/educations.controller.ts`

---

### Track C — Reference Endpoints (Education) *(parallel after Track A; [P] with Track B)*

- [ ] T041 [P] [US2] Add to `src/modules/profile/services/reference.service.ts`: `getMajorCategories(dto)` returning `{ data, meta }` supporting pagination (`page`, `limit`), sorting (`sort`, `order`), and `search` / `isActive` filtering. `getMajors(dto)` returning `{ data, meta }` supporting pagination, sorting, and `categoryId` / `search` filtering. `getInstitutions(dto)` returning `{ data, meta }` supporting pagination, sorting, and `countryId` / `cityId` / `search` filtering — `src/modules/profile/services/reference.service.ts`
- [ ] T042 [P] [US2] Add to `src/modules/profile/controllers/reference.controller.ts`: `GET /reference/major-categories` (`@Public()`, accepts PaginationDto, returns `{ data, meta }`), `GET /reference/majors` (`@Public()`, accepts PaginationDto, returns `{ data, meta }`), `GET /reference/institutions` (`@Public()`, accepts PaginationDto, returns `{ data, meta }`). Add `@ApiOperation`, `@ApiResponse`, and `@ApiQuery` for each query parameter on each handler — `src/modules/profile/controllers/reference.controller.ts`

---

### Track D — Tests *(runs after Tracks B and C complete)*

- [ ] T043 [US2] Create `src/modules/profile/services/educations.service.spec.ts`. Tests: `create()` saves record and calls `recalculate`; GPA normalization for all 3 scales (test exact values: 85/100→3.40, 4.5/5→3.60, 3.7/4→3.70); duplicate `(userId, institutionId, majorId, educationLevelId)` → 409; `MAX_EDUCATIONS` limit → 409; `endDate` before `startDate` → 400; `findAll()` includes embedded relation objects; `delete()` calls `recalculate`. Test that `GET /:id` (via service `findOne`) returns a single record by ID and throws `404 EDUCATION_NOT_FOUND` when not found or ownership fails. Test that `isCurrent = true` clears `endDate` and `isCurrent = false` clears `expectedGraduationDate`. Test that `minorMajorId == majorId` throws `400 MINOR_MAJOR_EQUALS_MAJOR`. Test that `endDate < startDate` throws `400 INVALID_DATE_RANGE`. — `src/modules/profile/services/educations.service.spec.ts`
- [ ] T044 [US2] Update `test/profile.e2e-spec.ts`. Add E2E tests: `POST /profile/educations` creates record and completion increases by 25 points; `PATCH /profile/educations/:id` updates GPA and gpaNormalized recomputes; `DELETE /profile/educations/:id` hard-deletes and completion decreases; duplicate education record → 409; `GET /reference/major-categories`, `/reference/majors?categoryId=&search=`, `/reference/institutions?countryId=&cityId=&search=` return 200 without auth. `GET /profile/educations/:id` returns `200` for the owner and `404` for a foreign UUID. `PATCH` with `isCurrent = true` nullifies `endDate`. `POST` with `minorMajorId == majorId` returns `400`. `POST` with `endDate < startDate` returns `400`. `GET /reference/major-categories?search=Eng` returns paginated `{ data, meta }`. — `test/profile.e2e-spec.ts`
- [ ] T045 [US2] Update `tests/levora-smoke-tests.json` with education CRUD sequence and reference endpoint requests. Each request has `Tests` script assertions — `tests/levora-smoke-tests.json`
- [ ] T046 [US2] Update `Levora_API.postman_collection.json` and `Levora_API_localhost.postman_collection.json`. Add education CRUD requests with full example bodies (including GPA examples for all 3 scales: OUT_OF_4, OUT_OF_5, OUT_OF_100). Add education reference endpoint entries — `Levora_API.postman_collection.json`, `Levora_API_localhost.postman_collection.json`
- [ ] T047 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e`. All must exit 0 — *(final gate)*

**✅ Batch 2 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 3.

---
---

## Batch 3 — Languages Section

**Acceptance baseline**: Execute [EC-023–027](edge-cases.md) and
[ST-006 and ST-012–018](security-testing.md) through T054–T055. Apply the
cross-batch strategy and controls linked in [plan.md](plan.md#testing--security-acceptance-baseline).

**Prerequisite**: Batch 2 Review Gate PASSED.
**Unblocks**: US3 (language records + proficiency levels)

**Review Gate**: Language CRUD with structured proficiency IDs works. `isNative` flag
saves correctly. `nameEn`/`nameAr` returned for both language and proficiency. Completion
reflects 10% languages group. All tests pass.

---

### Track A — LanguagesService + DTOs + Controller *(parallel with Track B and C; no internal dependency)*

- [ ] T048 [P] [US3] Rewrite `src/modules/profile/dto/create-language.dto.ts`. Required: `languageId: string` (UUID, FK to `LanguagesMaster`), `proficiencyLevelId: string` (UUID, FK to `ProficiencyLevels`). Optional: `isNative?: boolean` (default false) — `src/modules/profile/dto/create-language.dto.ts`
- [ ] T049 [P] [US3] Create `src/modules/profile/dto/update-language.dto.ts` as `PartialType(CreateLanguageDto)` — `src/modules/profile/dto/update-language.dto.ts`
- [ ] T050 [P] [US3] Rewrite `src/modules/profile/services/languages.service.ts`. Implement: `create(userId, dto)` — validate language and proficiency level exist; enforce `MAX_LANGUAGES` from `SystemSettings`; unique constraint `(userId, languageId)` → 409 if duplicate; save with `userId` as FK to `UserProfiles.userId`; call `ProfileService.recalculate(userId)`. `findAll(userId)`: include `{ language: { select: { nameEn, nameAr } }, proficiencyLevel: { select: { nameEn, nameAr } } }`. `findOne(userId, languageId)`: same includes, 404 if not found. `update(userId, languageId, dto)`: update `proficiencyLevelId`, `isNative`; call `recalculate`. `delete(userId, languageId)`: hard-delete; call `recalculate` — `src/modules/profile/services/languages.service.ts`
- [ ] T051 [P] [US3] Update `src/modules/profile/controllers/languages.controller.ts`. Verify it uses updated service signatures. Add `@ApiBody`, `@ApiOperation`, `@ApiResponse` on all methods if missing — `src/modules/profile/controllers/languages.controller.ts`

---

### Track B — Reference: Languages & Proficiency Levels *(parallel with Track A and C)*

- [ ] T052 [P] [US3] Update `getLanguages()` in `src/modules/profile/services/reference.service.ts` to select `{ id, nameEn, nameAr, isoCode }` (not old `name` field). Add `getProficiencyLevels()` returning `{ id, nameEn, nameAr, sortOrder }` ordered by `sortOrder` ascending — `src/modules/profile/services/reference.service.ts`
- [ ] T053 [P] [US3] In `src/modules/profile/controllers/reference.controller.ts`: verify `GET /reference/languages` exists and is `@Public()`. Add `GET /reference/proficiency-levels` handler; mark `@Public()`. Add `@ApiOperation`, `@ApiResponse` — `src/modules/profile/controllers/reference.controller.ts`

---

### Track C — Tests *(parallel with Track A and B; writes different files)*

- [ ] T054 [P] [US3] Create `src/modules/profile/services/languages.service.spec.ts`. Tests: `create()` saves record and calls `recalculate`; `nameEn`/`nameAr` included in `findAll()` response; duplicate `(userId, languageId)` → 409; `MAX_LANGUAGES` limit → 409; `update()` changes `proficiencyLevelId` and calls `recalculate`; `delete()` calls `recalculate` — `src/modules/profile/services/languages.service.spec.ts`
- [ ] T055 [US3] Update `test/profile.e2e-spec.ts`. Add E2E tests: language CRUD full sequence; duplicate language → 409; `GET /reference/languages` and `GET /reference/proficiency-levels` return 200 without auth; proficiency levels are ordered by `sortOrder` ascending — `test/profile.e2e-spec.ts`
- [ ] T056 [US3] Update `tests/levora-smoke-tests.json` with language CRUD and reference endpoint requests. Add `Tests` script assertions — `tests/levora-smoke-tests.json`
- [ ] T057 [US3] Update `Levora_API.postman_collection.json` and `Levora_API_localhost.postman_collection.json`. Add language CRUD requests (with `proficiencyLevelId` example). Add reference endpoint entries — `Levora_API.postman_collection.json`, `Levora_API_localhost.postman_collection.json`
- [ ] T058 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e`. All must exit 0 — *(final gate)*

**✅ Batch 3 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 4.

---
---

## Batch 4 — Standardized Tests Section

**Acceptance baseline**: Execute [EC-028–034](edge-cases.md) and
[ST-007 and ST-012–018](security-testing.md) through T066–T067. Apply the
cross-batch strategy and controls linked in [plan.md](plan.md#testing--security-acceptance-baseline).

**Prerequisite**: Batch 3 Review Gate PASSED.
**Unblocks**: US5 (test scores + score range/step validation)

**Review Gate**: Test results CRUD works. Score outside min/max → 400. Score not
aligned to step → 400. Duplicate test type → 409. Completion reflects 7% tests
group. All tests pass.

---

### Track A — TestResultsService + DTOs + Controller *(parallel with Track B and C)*

- [ ] T059 [P] [US5] Create `src/modules/profile/dto/create-test-result.dto.ts`. Required: `testId: string` (UUID, FK to `StandardizedTests`), `score: number` (IsNumber). Optional: `testDate?: string` (ISO date) — `src/modules/profile/dto/create-test-result.dto.ts`
- [ ] T060 [P] [US5] Create `src/modules/profile/dto/update-test-result.dto.ts` as `PartialType(CreateTestResultDto)` — `src/modules/profile/dto/update-test-result.dto.ts`
- [ ] T061 [P] [US5] Create `src/modules/profile/services/test-results.service.ts`. Implement: `create(userId, dto)` — load `StandardizedTests` record by `testId` (404 if not found); validate `score >= minScore && score <= maxScore` → 400 if out of range; validate `(score - minScore) % scoreStep === 0` using integer arithmetic (multiply by 100 to avoid float imprecision) → 400 if off-step; unique `(userId, testId)` → 409; enforce `MAX_TEST_RESULTS` from `SystemSettings`; save with `userId` as FK to `UserProfiles.userId`; call `ProfileService.recalculate(userId)`. `findAll(userId)`: include `{ test: { select: { nameEn, nameAr, minScore, maxScore, scoreStep } } }`. `findOne(userId, id)`: 404 if not found. `update(userId, id, dto)`: re-validate score if changed; call `recalculate`. `delete(userId, id)`: hard-delete; call `recalculate`. The DTO field, service parameter, and Prisma column must all use testDate. All complex public methods MUST have JSDoc comments explaining their purpose, parameters, return values, and side effects. — `src/modules/profile/services/test-results.service.ts`
- [ ] T062 [P] [US5] Create `src/modules/profile/controllers/test-results.controller.ts` and `src/modules/profile/guards/test-result-ownership.guard.ts`. Endpoints: `POST /profile/test-results`, `GET /profile/test-results`, `GET /profile/test-results/:id`, `PATCH /profile/test-results/:id`, `DELETE /profile/test-results/:id`. All with `@UseGuards(JwtAuthGuard, TestResultOwnershipGuard)`. Add `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` on each method — `src/modules/profile/controllers/test-results.controller.ts`
- [ ] T063 [P] [US5] Register `TestResultsController` in `controllers[]` and `TestResultsService` in `providers[]` of `src/modules/profile/profile.module.ts` — `src/modules/profile/profile.module.ts`

---

### Track B — Reference: Standardized Tests *(parallel with Track A and C)*

- [ ] T064 [P] [US5] Add `getStandardizedTests()` to `src/modules/profile/services/reference.service.ts`. Returns `{ id, nameEn, nameAr, minScore, maxScore, scoreStep }` — `src/modules/profile/services/reference.service.ts`
- [ ] T065 [P] [US5] Add `GET /reference/standardized-tests` (`@Public()`) to `src/modules/profile/controllers/reference.controller.ts`. Add `@ApiOperation`, `@ApiResponse` — `src/modules/profile/controllers/reference.controller.ts`

---

### Track C — Tests *(parallel with Track A and B; writes different files)*

- [ ] T066 [P] [US5] Create `src/modules/profile/services/test-results.service.spec.ts`. Tests: `create()` saves record and calls `recalculate`; in-range and on-step score accepted; out-of-range score → 400; off-step score → 400 (test with IELTS: minScore=0, maxScore=9, scoreStep=0.5; score 7.3 rejected, 7.5 accepted); duplicate `(userId, testId)` → 409; `MAX_TEST_RESULTS` limit → 409; `delete()` calls `recalculate` — `src/modules/profile/services/test-results.service.spec.ts`
- [ ] T067 [US5] Update `test/profile.e2e-spec.ts`. Add E2E tests: test result CRUD full sequence; off-range score (400); off-step score (400); duplicate test type (409); `GET /reference/standardized-tests` returns 200 without auth — `test/profile.e2e-spec.ts`
- [ ] T068 [US5] Update `tests/levora-smoke-tests.json` with test result CRUD (IELTS, TOEFL, GRE example payloads) and reference endpoint. Add `Tests` assertions — `tests/levora-smoke-tests.json`
- [ ] T069 [US5] Update `Levora_API.postman_collection.json` and `Levora_API_localhost.postman_collection.json`. Add test result CRUD with IELTS/TOEFL/GRE example bodies. Add reference endpoint entry — `Levora_API.postman_collection.json`, `Levora_API_localhost.postman_collection.json`
- [ ] T070 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e`. All must exit 0 — *(final gate)*

**✅ Batch 4 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 5.

---
---

## Batch 5 — Special Statuses & Target Preferences

**Acceptance baseline**: Execute [EC-035–042 and EC-057–058](edge-cases.md) and
[ST-008 and ST-011–018](security-testing.md) through T081–T083. Apply the
cross-batch strategy and controls linked in [plan.md](plan.md#testing--security-acceptance-baseline).

**Prerequisite**: Batch 4 Review Gate PASSED.
**Unblocks**: US6, US7, US8 (statuses, preferences, matchability)

**Review Gate**: All preference and status endpoints work. Idempotent adds produce no
duplicates. `GET /profile/preferences` returns unified object. Completion percentage
is now accurate across all 6 groups (total reachable = 100%). All tests pass.

---

### Track A — SpecialStatusesService + Controller *(parallel with Tracks B and C)*

- [ ] T071 [P] [US6] Create `src/modules/profile/dto/create-special-status.dto.ts`. Required: `specialStatusId: string` (UUID, FK to `SpecialStatuses`) — `src/modules/profile/dto/create-special-status.dto.ts`
- [ ] T072 [P] [US6] Create `src/modules/profile/services/special-statuses.service.ts`. Implement: `add(userId, dto)` — validate status exists in `SpecialStatuses`; upsert on `(userId, specialStatusId)` (no error if already exists); call `ProfileService.recalculate(userId)`. `findAll(userId)`: return statuses with `{ specialStatus: { nameEn, nameAr } }`. `remove(userId, specialStatusId)`: hard-delete; call `recalculate` — `src/modules/profile/services/special-statuses.service.ts`
- [ ] T073 [P] [US6] Create `src/modules/profile/controllers/special-statuses.controller.ts` and `src/modules/profile/guards/special-status-ownership.guard.ts`. Endpoints: `POST /profile/special-statuses`, `GET /profile/special-statuses`, `DELETE /profile/special-statuses/:specialStatusId`. All with `@UseGuards(JwtAuthGuard, SpecialStatusOwnershipGuard)`. Add Swagger decorators — `src/modules/profile/controllers/special-statuses.controller.ts`
- [ ] T074 [P] [US6] Register `SpecialStatusesController` in `controllers[]` and `SpecialStatusesService` in `providers[]` of `src/modules/profile/profile.module.ts` — `src/modules/profile/profile.module.ts`

---

### Track B — PreferencesService + Controller *(parallel with Tracks A and C)*

- [ ] T075 [P] [US7] Create three minimal endpoint-specific DTOs: `src/modules/profile/dto/add-degree.dto.ts` (`educationLevelId: string` UUID required), `src/modules/profile/dto/add-major.dto.ts` (`majorId: string` UUID required), `src/modules/profile/dto/add-institution.dto.ts` (`institutionId: string` UUID required) — `src/modules/profile/dto/add-degree.dto.ts`, `src/modules/profile/dto/add-major.dto.ts`, `src/modules/profile/dto/add-institution.dto.ts`
- [ ] T076 [P] [US7] Create `src/modules/profile/services/preferences.service.ts`. Implement: `getAll(userId)` returning `{ targetDegrees, targetMajors, targetInstitutions }` unified object. `addDegree(userId, educationLevelId)`: upsert, enforce `MAX_TARGET_DEGREES` from `SystemSettings`, call `recalculate`. `removeDegree(userId, educationLevelId)`: hard-delete, call `recalculate`. `addMajor(userId, majorId)`: upsert, enforce `MAX_TARGET_MAJORS`, call `recalculate`. `removeMajor(userId, majorId)`: hard-delete, call `recalculate`. `addInstitution(userId, institutionId)`: upsert, enforce `MAX_TARGET_INSTITUTIONS`, call `recalculate`. `removeInstitution(userId, institutionId)`: hard-delete, call `recalculate` — `src/modules/profile/services/preferences.service.ts`
- [ ] T077 [P] [US7] Create `src/modules/profile/controllers/preferences.controller.ts` and `src/modules/profile/guards/preference-ownership.guard.ts`. Endpoints: `GET /profile/preferences`, `POST /profile/preferences/degrees`, `DELETE /profile/preferences/degrees/:educationLevelId`, `POST /profile/preferences/majors`, `DELETE /profile/preferences/majors/:majorId`, `POST /profile/preferences/institutions`, `DELETE /profile/preferences/institutions/:institutionId`. All with `@UseGuards(JwtAuthGuard, PreferenceOwnershipGuard)`. Add Swagger decorators — `src/modules/profile/controllers/preferences.controller.ts`
- [ ] T078 [P] [US8] In `src/modules/profile/profile.module.ts`: register `PreferencesController` in `controllers[]`, `PreferencesService` in `providers[]` — `src/modules/profile/profile.module.ts`

---

### Track C — Reference: Special Statuses *(parallel with Tracks A and B)*

- [ ] T079 [P] [US6] Add `getSpecialStatuses()` to `src/modules/profile/services/reference.service.ts`. Returns `{ id, nameEn, nameAr }` — `src/modules/profile/services/reference.service.ts`
- [ ] T080 [P] [US6] Add `GET /reference/special-statuses` (`@Public()`) to `src/modules/profile/controllers/reference.controller.ts`. Add `@ApiOperation`, `@ApiResponse` — `src/modules/profile/controllers/reference.controller.ts`

---

### Track D — Tests *(runs after Tracks A, B, and C complete)*

- [ ] T081 [US6] Create `src/modules/profile/services/special-statuses.service.spec.ts`. Tests: `add()` saves status and calls `recalculate`; adding same status twice (upsert) produces no duplicate and no error; unknown `specialStatusId` → 404/400; `remove()` hard-deletes and calls `recalculate` — `src/modules/profile/services/special-statuses.service.spec.ts`
- [ ] T082 [US7] Create `src/modules/profile/services/preferences.service.spec.ts`. Tests: each `add*()` method upserts and calls `recalculate`; adding same preference twice produces no duplicate and no error; limit enforcement for each category (degrees, majors, institutions) → 409; `getAll()` returns unified object structure; each `remove*()` calls `recalculate` — `src/modules/profile/services/preferences.service.spec.ts`
- [ ] T083 [US6] [US7] [US8] Update `test/profile.e2e-spec.ts`. Add E2E tests: special status add/list/delete sequence; duplicate status add → no error, no duplicate record; `GET /profile/preferences` returns `{ targetDegrees, targetMajors, targetInstitutions }`; add a degree, major, and institution, verify all appear in `getAll`; `GET /reference/special-statuses` returns 200 without auth; verify `GET /profile/me` includes non-null `specialStatuses` and preference sub-arrays after data added; full profile with all 6 groups filled → `completionPct = 100` — `test/profile.e2e-spec.ts`
- [ ] T084 [US6] [US7] Update `tests/levora-smoke-tests.json` with special status and preferences CRUD sequences. Add `Tests` assertions — `tests/levora-smoke-tests.json`
- [ ] T085 [US6] [US7] Update `Levora_API.postman_collection.json` and `Levora_API_localhost.postman_collection.json`. Add special status and preferences endpoint entries with example bodies — `Levora_API.postman_collection.json`, `Levora_API_localhost.postman_collection.json`
- [ ] T086 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e`. All must exit 0 — *(final gate)*

**✅ Batch 5 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 6.

---
---

## Batch 6 — Documents Section

**Acceptance baseline**: Execute [EC-043–053 and EC-059](edge-cases.md) and
[ST-009 and ST-016–026](security-testing.md) through T093–T094. Apply the
cross-batch strategy and controls linked in [plan.md](plan.md#testing--security-acceptance-baseline).

**Prerequisite**: Batch 5 Review Gate PASSED.
**Unblocks**: US4 (document upload, deletion, download)

**Review Gate**: Upload works with `documentTypeId` FK. Unknown MIME type or oversized
file → 400. Storage-first deletion: simulated storage failure leaves DB record intact.
Signed download URL returned. All tests pass.

---

### Track A — DocumentsService + DTO Rewrite *(parallel with Track B)*

- [ ] T087 [P] [US4] Rewrite `src/modules/profile/dto/upload-document.dto.ts`. Remove `docType` string enum field entirely. Add `documentTypeId: string` (UUID, required, FK to `DocumentTypes`) — `src/modules/profile/dto/upload-document.dto.ts`
- [ ] T088 [P] [US4] Rewrite `src/modules/profile/services/documents.service.ts`. Implement: `upload(userId, file, dto)` — load `MAX_DOCUMENT_SIZE_BYTES` using `SystemSettingsService.getNumber('documents.max_size_bytes', 10485760)`; load `ALLOWED_DOCUMENT_MIME_TYPES` using `SystemSettingsService.getJson<string[]>('documents.allowed_mime_types', ["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"])`; validate `file.size <= maxSizeBytes` → 400 if exceeded; validate `file.mimetype` in allowed list → 400 if not; validate `documentTypeId` exists in `DocumentTypes` → 400 if not found; inspect actual file content and verify it matches the declared type (MIME sniffing / content analysis) → 400 DOCUMENT_TYPE_MISMATCH if not; upload file via `StorageService`; create `Documents` record with `storagePath` (path returned by storage), `displayName` (original filename), `mimeType`, `sizeBytes`, `documentTypeId`, `userId` (FK to `UserProfiles.userId`). Do NOT call `recalculate`. `findAll(userId)`: return all documents with `{ documentType: { nameEn, nameAr } }`. `getDownloadUrl(userId, id)`: validate ownership (404 if not found or mismatch); return signed URL via `StorageService.getSignedUrl(storagePath, 900)` (15-minute expiry). `delete(userId, id)`: 1) find record → 404 if not found; 2) call `StorageService.delete(storagePath)` — if this throws, re-throw immediately (DB record preserved); 3) only on storage success, delete DB record. Do NOT call `recalculate` — `src/modules/profile/services/documents.service.ts`
- [ ] T089 [P] [US4] In `src/modules/profile/services/documents.service.ts`: remove all references to `isEncrypted` field from select/include blocks and create data. Remove all `deletedAt` handling and soft-delete logic — `src/modules/profile/services/documents.service.ts`
- [ ] T090 [P] [US4] Update `src/modules/profile/controllers/documents.controller.ts`. Verify `POST /profile/documents` accepts `multipart/form-data` with `file` and `documentTypeId`. Add `GET /profile/documents/:id/download` endpoint if missing. Add `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth`, `@ApiConsumes('multipart/form-data')` where appropriate — `src/modules/profile/controllers/documents.controller.ts`

---

### Track B — Reference: Document Types *(parallel with Track A)*

- [ ] T091 [P] [US4] Add `getDocumentTypes()` to `src/modules/profile/services/reference.service.ts`. Returns `{ id, nameEn, nameAr }` — `src/modules/profile/services/reference.service.ts`
- [ ] T092 [P] [US4] Add `GET /reference/document-types` (`@Public()`) to `src/modules/profile/controllers/reference.controller.ts`. Add `@ApiOperation`, `@ApiResponse` — `src/modules/profile/controllers/reference.controller.ts`

---

### Track C — Tests *(runs after Tracks A and B complete)*

- [ ] T093 [US4] Create `src/modules/profile/services/documents.service.spec.ts`. Tests: `upload()` — valid file (correct size, MIME, and matches declared type) succeeds; file exceeding max size → 400; disallowed MIME type → 400; unknown `documentTypeId` → 400; declared type content mismatch → 400; database record creation failure after a successful storage upload triggers an attempted storage cleanup and returns an error; upload does not call `recalculate`. `delete()` — storage success → DB record deleted; storage throws → DB record preserved and error propagated; does not call `recalculate`. `getDownloadUrl()` — returns signed URL from `StorageService`; 404 if record not found — `src/modules/profile/services/documents.service.spec.ts`
- [ ] T094 [US4] Update `test/profile.e2e-spec.ts`. Add E2E tests: full upload/list/download/delete sequence; upload with oversized file → 400; upload with invalid MIME type → 400; upload with content mismatch → 400; upload with free-text docType (not documentTypeId) → 400; simulated database-record creation failure after storage upload leaves no orphaned file; `GET /reference/document-types` returns 200 without auth. E2E test MUST include a simulated storage failure during DELETE /profile/documents/:id — use a mocked StorageService that throws on delete(). Assert the response is 5xx and the document record still exists in the database via a follow-up GET /profile/documents request. — `test/profile.e2e-spec.ts`
- [ ] T095 [US4] Update `tests/levora-smoke-tests.json` with document upload (multipart example), download URL, and delete requests. Add `Tests` assertions — `tests/levora-smoke-tests.json`
- [ ] T096 [US4] Update `Levora_API.postman_collection.json` and `Levora_API_localhost.postman_collection.json`. Add document upload entry (Content-Type: multipart/form-data, with `documentTypeId` and `file` fields). Add download URL and delete entries. Add reference endpoint entry — `Levora_API.postman_collection.json`, `Levora_API_localhost.postman_collection.json`
- [ ] T097 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e`. All must exit 0 — *(final gate)*

**✅ Batch 6 Review Gate**: Submit completion report per plan.md template. All 6 batches complete.

---
---

## Polish & Cross-Cutting Concerns

**Purpose**: Final verification pass ensuring all cross-batch invariants hold.

- [ ] T098 Verify all controller methods across all 6 batches have `@ApiOperation`, `@ApiResponse`, and `@ApiBearerAuth` (or `@Public()` for reference endpoints). No controller method is missing Swagger decorators — *(codebase audit)*
- [ ] T099 Verify `ProfileService.recalculate()` is called by every write operation across all services (educations, languages, test-results, special-statuses, preferences) except documents. Grep for `recalculate` calls in these service files — *(codebase audit)*
- [ ] T100 Verify no service files contain business logic that belongs in controllers, and no controller contains DB queries or business logic. Confirm Controller → Service flow is intact across all new files — *(codebase audit)*
- [ ] T101 Run the full quickstart validation guide (`specs/005-profile-v2-redesign/quickstart.md`). Execute each scenario and confirm expected output — *(manual validation)*
- [ ] T102 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e` one final time on a clean state. All must exit 0. Verify the frontend coordination note has been delivered and acknowledged. — *(final gate)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Batch 1 Track A** (T001–T007): No dependencies. Start immediately. **Blocks all other Batch 1 tracks**.
- **Batch 1 Tracks B–F** (T008–T026): Start in parallel after T007 (Track A complete).
- **Batch 1 Track G** (T027–T034): Start after all of Tracks B–F are complete.
- **Batch 2** (T035–T047): Starts only after Batch 1 Review Gate passes.
- **Batch 2 Track A** (T035–T036): Blocks Tracks B and C within Batch 2.
- **Batch 2 Tracks B, C** (T037–T042): Parallel after T036.
- **Batch 2 Track D** (T043–T047): After Tracks B and C complete.
- **Batch 3** (T048–T058): After Batch 2 Review Gate. Tracks A, B, C fully parallel.
- **Batch 4** (T059–T070): After Batch 3 Review Gate. Tracks A, B, C fully parallel.
- **Batch 5** (T071–T086): After Batch 4 Review Gate. Tracks A, B, C fully parallel.
- **Batch 6** (T087–T097): After Batch 5 Review Gate. Tracks A, B fully parallel.
- **Polish** (T098–T102): After all 6 batches complete.

### User Story to Batch Mapping

| User Story | Primary Batch | Supporting Batches |
|:---:|:---|:---|
| US1 — Personal Info & Location | Batch 1 | — |
| US2 — Education History | Batch 2 | Batch 1 (schema foundation) |
| US3 — Languages | Batch 3 | — |
| US4 — Documents | Batch 6 | — |
| US5 — Test Scores | Batch 4 | — |
| US6 — Special Statuses | Batch 5 | — |
| US7 — Target Preferences | Batch 5 | — |
| US8 — Automatic Matchability Determination | Batch 1 (recalculate engine) | — |
| US9 — View Complete Profile | Batch 1 | All subsequent batches add sections |
| US10 — Completion Tracking | Batch 1 (recalculate engine) | All batches call recalculate |

---

## Parallel Execution Examples

### Batch 1 (After Track A completes, T007)

```
Agent 1 (oma-editor):    T008 → T009 → T010 → T011  [Track B]
Agent 2 (oma-quick):     T012 → T013 → T014 → T015 → T016 → T017 → T018  [Track C]
Agent 3 (oma-editor):    T019 → T020 → T021  [Track D]
Agent 4 (oma-architect): T022 → T023 → T024  [Track E]
Agent 5 (oma-editor):    T025 → T026  [Track F]
→ All join → Agent 6 (oma-reviewer): T027 → T028 → T029 → T030 → T031 → T032 → T033 → T034  [Track G]
```

### Batch 3 (All tracks fully parallel)

```
Agent 1 (oma-editor):    T048 → T049 → T050 → T051  [Track A]
Agent 2 (oma-quick):     T052 → T053  [Track B]
Agent 3 (oma-reviewer):  T054  [Track C — unit test only, parallel]
→ All join → T055 → T056 → T057 → T058  [E2E + Smoke + Postman + gate]
```

---

## Implementation Strategy

### MVP: Batch 1 Only

1. Complete Batch 1 Track A (schema + seed)
2. Complete Batch 1 Tracks B–F in parallel
3. Complete Batch 1 Track G (tests)
4. **STOP and VALIDATE**: `GET /profile/me` returns 8-section structure; auth returns tokens only
5. Continue to Batch 2 after review

### Incremental Delivery

- Batch 1 → Personal info + location + auth fix (Sections 1–2) ✓
- Batch 2 → Education (Section 3, 35% completion weight) ✓
- Batch 3 → Languages (Section 4, 10% weight) ✓
- Batch 4 → Standardized tests (Section 5, 7% weight) ✓
- Batch 5 → Statuses + Preferences (Sections 6–7, 15% weight) ✓ → `completionPct = 100` achievable
- Batch 6 → Documents (Section 8) ✓ → Feature complete

---

## Notes

- Frontend coordination is mandatory before any batch is merged. Each batch with new endpoints must produce or update a frontend coordination note covering DTO field whitelists, response shape changes, and any auth-flow changes. No batch is considered complete until the note is delivered.
- All cross-batch invariants from plan.md §Cross-Batch Invariants apply unconditionally to every task.
- `[P]` tasks touch different files and have no intra-batch dependency — safe to execute concurrently.
- Every task that creates or modifies a Service must have a corresponding `.spec.ts` update in its batch's Track G/D/C.
- `pnpm lint` + `pnpm build` are mandatory gates at the end of every batch — a failing build means the batch is NOT complete.
- `--no-verify` bypass on any commit requires `hotfix-bypass:` prefix in the next commit message and a fix commit within 24 hours.
