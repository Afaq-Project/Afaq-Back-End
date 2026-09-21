> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/005-profile-foundation/endpoints.md`.

# Tasks: Profile Module v2 Redesign

**Branch**: `005-profile-foundation`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Organization**: Tasks are grouped by batch. Within each batch, tracks that can
run in parallel are clearly identified. Track A of each batch is always a blocking
prerequisite — all other tracks within that batch start only after Track A completes.

**Format**: `[ID] [P?] [Story?] Description — file path`
- `[P]`: Parallelizable within the same batch (different files, no intra-batch dependency)
- `[US#]`: Maps to a User Story in spec.md

---

## Batch 1 — Foundation, Auth Precision, Personal Info & Location

**Unblocks**: US1, US9, US10 (core profile structure + completion engine)

**Review Gate**: Auth returns tokens only. `GET /profile/me` returns 8-section structure.
Personal info and location updates recalculate completion. Reference endpoints respond
without auth. `pnpm build` + `pnpm lint` + all tests pass.

---

### Track A — Schema Migration *(sequential — blocks all other tracks)*

- [ ] T001 Replace `prisma/schema.prisma` entirely with the v2.0 schema from `docx/complete-schema.md` — `prisma/schema.prisma`
- [ ] T002 Run `pnpm prisma migrate dev --name v2-profile-redesign` and verify migration succeeds with zero errors. After the migration succeeds, review the generated SQL file in prisma/migrations/ before committing it. Verify no unexpected destructive operations (DROP TABLE, DROP COLUMN) exist unless they are intentional and covered by a backup step. This review is mandatory per Constitution Principle III. — `prisma/migrations/`
- [ ] T003 Run `pnpm prisma generate` to regenerate the Prisma client — `node_modules/.prisma/client/`
- [ ] T004 Create `scripts/load-reference-data.ts` — the production reference data loader implementing the loading order: Countries → Cities (resolving `countryIsoCode2` → `countryId` via `Countries.isoCode2`) → MajorCategories → Majors (resolving `categoryId`) → Institutions (resolving `countryIsoCode2` → `countryId` and `cityName` → `cityId`; skip institutions whose country is not found; set `cityId = null` if city not found). Use upsert on `externalSourceId` for every table. Invocation: `pnpm ts-node scripts/load-reference-data.ts` — `scripts/load-reference-data.ts`
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
- [ ] T020 [P] Create `src/modules/profile/services/system-settings.service.ts` with an injectable `SystemSettingsService` class. Implement `get(key: string, defaultValue: number): Promise<number>` that queries `prisma.systemSettings.findUnique({ where: { key } })`, parses the JSON value as a number, and returns `defaultValue` if the key is absent, the value is null, or parsing fails. Never throws — `src/modules/profile/services/system-settings.service.ts`
- [ ] T021 [P] Register `SystemSettingsService` in `providers[]` of `src/modules/profile/profile.module.ts` and add it to `exports[]` so other services can inject it — `src/modules/profile/profile.module.ts`

---

### Track E — ProfileService Rewrite + DTOs + Controller *(parallel after Track A; [P] with Tracks B, C, D, F)*

- [ ] T022 [P] [US1] Rewrite `src/modules/profile/dto/update-profile.dto.ts`. All fields optional via `@IsOptional()`. Fields: `firstName?: string` (max 255), `lastName?: string` (max 255), `email?: string` (email format), `dateOfBirth?: string` (ISO date), `gender?: 'MALE' | 'FEMALE'` (IsEnum), `maritalStatusId?: string` (UUID), `phone?: string` (max 30), `bio?: string`, `profilePhotoUrl?: string` (IsUrl), `countryOfResidenceId?: string` (UUID), `nationalityId?: string` (UUID), `currentCityId?: string` (UUID), `educationLevelId?: string` (UUID). No `completionPct`, `isMatchable`, or `matchingVersion` fields — `src/modules/profile/dto/update-profile.dto.ts`
- [ ] T023 [P] [US10] Rewrite `src/modules/profile/services/profile.service.ts`. Implement: `getProfile(userId)` fetching `UserProfiles` with all 8 sub-relations (educations, languages, testResults, specialStatuses, targetDegrees, targetMajors, targetInstitutions, documents); never throws 404. `updateProfile(userId, dto)`: validate `bio` max length; validate city-country consistency (clear `currentCityId` if mismatched with new country, throw `400 CITY_COUNTRY_MISMATCH` if explicitly mismatched city sent); update fields on `UserProfiles`; call `recalculate(userId)`. `recalculate(userId)`: re-fetch full profile with all sub-relations; compute `completionPct` using `computeCompletionPct(profile, weights)` where weights come from `SystemSettingsService` (with fallbacks); compute `isMatchable = completionPct >= SystemSettingsService.get("matching.threshold", 60)`; increment `matchingVersion` unconditionally; update `UserProfiles` with new `completionPct`, `isMatchable`, and `matchingVersion`. Private `computeCompletionPct(profile, weights)`: pure function; score all 15 fields/groups per the weight table in plan.md; sum cannot exceed 100. All complex public methods (recalculate, computeCompletionPct, updateProfile) MUST have JSDoc comments explaining their purpose, parameters, return values, and side effects (e.g., incrementing matchingVersion). — `src/modules/profile/services/profile.service.ts`
- [ ] T024 [P] [US8] [US9] Rewrite `src/modules/profile/controllers/profile.controller.ts`. Endpoints: `GET /profile/me` → `ProfileService.getProfile(userId)`; `PATCH /profile/personal` → `ProfileService.updateProfile(userId, dto)` with `UpdateProfileDto`. Remove `POST /profile/publish`. All endpoints require JWT. Add `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` on each method — `src/modules/profile/controllers/profile.controller.ts`

---

### Track F — Reference Endpoints (Personal Info Section) *(parallel after Track A; [P] with Tracks B, C, D, E)*

- [ ] T025 [P] [US1] In `src/modules/profile/services/reference.service.ts`: delete `getFieldsOfStudy()` method entirely. Delete `getSkillsTaxonomy()` method entirely. Add `getCountries(dto)` returning `{ data, meta }` supporting pagination, sorting, and `search`/`region` filtering. Add `getCities(dto)` returning `{ data, meta }` supporting pagination, sorting, and `countryId`/`search` filtering. Add `getMaritalStatuses()` returning `{ id, nameEn, nameAr }`. Ensure `getEducationLevels()` returns `{ id, code, nameEn, nameAr }` (update field mapping) — `src/modules/profile/services/reference.service.ts`
- [ ] T026 [P] [US1] In `src/modules/profile/controllers/reference.controller.ts`: remove `GET /reference/fields-of-study` handler. Remove `GET /reference/skills-taxonomy` handler. Add `GET /reference/countries` handler with Pagination DTO; mark `@Public()`. Add `GET /reference/cities` handler with Pagination DTO; mark `@Public()`. Add `GET /reference/marital-statuses` handler; mark `@Public()`. Add `@ApiOperation`, `@ApiResponse` on each new handler — `src/modules/profile/controllers/reference.controller.ts`

---

### Track G — Tests *(runs after all parallel tracks complete)*

- [ ] T027 [US10] Create `src/modules/profile/services/system-settings.service.spec.ts`. Tests: `get()` returns parsed value from DB; `get()` returns `defaultValue` when key absent; `get()` returns `defaultValue` when DB value is unparseable; never throws — `src/modules/profile/services/system-settings.service.spec.ts`
- [ ] T028 [US10] Rewrite `src/modules/profile/services/profile.service.spec.ts`. Tests: `getProfile()` returns 8-section structure with empty arrays for unpopulated sub-relations; `updateProfile()` saves fields and calls `recalculate()`; `recalculate()` increments `matchingVersion` unconditionally; `computeCompletionPct()` accuracy tests across all 15 field/group combinations including edge cases (all empty → 0, all filled → 100, partial combos → correct sum) — `src/modules/profile/services/profile.service.spec.ts`
- [ ] T029 [US9] Update `test/profile.e2e-spec.ts`. Add/update E2E tests: `GET /profile/me` returns 8-section structure; empty sections return `[]` or `null` (never omitted); `PATCH /profile/personal` saves personal info and recalculates completion; `recalculate()` updates `isMatchable` automatically when `completionPct` crosses the threshold; reference endpoints `GET /reference/countries`, `/reference/cities`, `/reference/marital-statuses` return 200 without Bearer token — `test/profile.e2e-spec.ts`
- [ ] T030 [US9] Update `test/auth.e2e-spec.ts`. Add assertion: `POST /auth/login` response `data` contains only `accessToken` and `refreshToken`. Assert no `userProfile` key is present anywhere in the response — `test/auth.e2e-spec.ts`
- [ ] T031 [US1] Update `tests/levora-smoke-tests.json`. Add requests for: `GET /profile/me`, `PATCH /profile/personal` (with personal info body), `GET /reference/countries` (no auth), `GET /reference/cities?countryId=...` (no auth), `GET /reference/marital-statuses` (no auth). Each request has `Tests` script asserting status code and response shape — `tests/levora-smoke-tests.json`
- [ ] T032 [US1] Update `Levora_API.postman_collection.json` and `Levora_API_localhost.postman_collection.json`. Update `POST /auth/login` example to token-only response. Add `GET /profile/me`, `PATCH /profile/personal` with full example bodies. Add reference endpoint entries with `?search=` and `?countryId=` query examples — `Levora_API.postman_collection.json`, `Levora_API_localhost.postman_collection.json`
- [ ] T033 Verify `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` (or `@Public()`) are present on all new and modified controller methods in `profile.controller.ts` and `reference.controller.ts`. Run `pnpm build` and confirm no compile errors — *(build verification)*
- [ ] T034 Run `pnpm lint` and `pnpm build` and `pnpm test` and `pnpm test:e2e`. All must exit 0 — *(final gate)*
- [ ] T034b [US9] Prepare a frontend coordination note documenting the 7 frontend requirements: (1) Auth returns only tokens; (2) forbidNonWhitelisted is active; (3) PATCH /profile is renamed to PATCH /profile/personal; (4) the matchable endpoint is removed; (5) City selection must be filtered and cleared on country change; (6) Reference endpoints now use pagination { data, meta }; (7) EducationLevel response shape changed to code/nameEn/nameAr. Share this note with the frontend team before Batch 1 is considered complete — *(documentation task)*

**✅ Batch 1 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 2.

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

Batch 2 tasks (T035–T047) are in `specs/006-profile-education/tasks.md`.
