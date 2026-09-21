> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/007-profile-languages/endpoints.md`.

# Tasks: Profile Languages (Batch 3)

**Branch**: `007-profile-languages`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Prerequisite**: `006-profile-education` Review Gate PASSED.

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Batch 3 — Languages Section

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

**✅ Batch 3 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 4 (`008-profile-tests`).
