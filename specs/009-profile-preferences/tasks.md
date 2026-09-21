> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/009-profile-preferences/endpoints.md`.

# Tasks: Profile Preferences (Batch 5)

**Branch**: `009-profile-preferences`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Prerequisite**: `008-profile-tests` Review Gate PASSED.

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Batch 5 — Special Statuses & Target Preferences

**Unblocks**: US6, US7, US8 (statuses, preferences, matchability)

**Review Gate**: All preference and status endpoints work. Idempotent adds produce no
duplicates. `GET /profile/preferences` returns unified object. Completion percentage
is now accurate across all 6 groups (total reachable = 100%). All tests pass.

---

### Track A — SpecialStatusesService + Controller *(parallel with Tracks B and C)*

- [ ] T071 [P] [US6] Create `src/modules/profile/dto/create-special-status.dto.ts`. Required: `specialStatusId: string` (UUID, FK to `SpecialStatuses`) — `src/modules/profile/dto/create-special-status.dto.ts`
- [ ] T072 [P] [US6] Create `src/modules/profile/services/special-statuses.service.ts`. Implement: `add(userId, dto)` — validate status exists in `SpecialStatuses`; upsert on `(userId, specialStatusId)` (no error if already exists); call `ProfileService.recalculate(userId)`. `findAll(userId)`: return statuses with `{ specialStatus: { nameEn, nameAr } }`. `remove(userId, specialStatusId)`: hard-delete; call `recalculate` — `src/modules/profile/services/special-statuses.service.ts`
- [ ] T073 [P] [US6] Create `src/modules/profile/controllers/special-statuses.controller.ts`. Endpoints: `POST /profile/special-statuses`, `GET /profile/special-statuses`, `DELETE /profile/special-statuses/:specialStatusId`. All with `@UseGuards(JwtAuthGuard)`. Add Swagger decorators — `src/modules/profile/controllers/special-statuses.controller.ts`
- [ ] T074 [P] [US6] Register `SpecialStatusesController` in `controllers[]` and `SpecialStatusesService` in `providers[]` of `src/modules/profile/profile.module.ts` — `src/modules/profile/profile.module.ts`

---

### Track B — PreferencesService + Controller *(parallel with Tracks A and C)*

- [ ] T075 [P] [US7] Create three minimal endpoint-specific DTOs: `src/modules/profile/dto/add-degree.dto.ts` (`educationLevelId: string` UUID required), `src/modules/profile/dto/add-major.dto.ts` (`majorId: string` UUID required), `src/modules/profile/dto/add-institution.dto.ts` (`institutionId: string` UUID required) — `src/modules/profile/dto/add-degree.dto.ts`, `src/modules/profile/dto/add-major.dto.ts`, `src/modules/profile/dto/add-institution.dto.ts`
- [ ] T076 [P] [US7] Create `src/modules/profile/services/preferences.service.ts`. Implement: `getAll(userId)` returning `{ targetDegrees, targetMajors, targetInstitutions }` unified object. `addDegree(userId, educationLevelId)`: upsert, enforce `MAX_TARGET_DEGREES` from `SystemSettings`, call `recalculate`. `removeDegree(userId, educationLevelId)`: hard-delete, call `recalculate`. `addMajor(userId, majorId)`: upsert, enforce `MAX_TARGET_MAJORS`, call `recalculate`. `removeMajor(userId, majorId)`: hard-delete, call `recalculate`. `addInstitution(userId, institutionId)`: upsert, enforce `MAX_TARGET_INSTITUTIONS`, call `recalculate`. `removeInstitution(userId, institutionId)`: hard-delete, call `recalculate` — `src/modules/profile/services/preferences.service.ts`
- [ ] T077 [P] [US7] Create `src/modules/profile/controllers/preferences.controller.ts`. Endpoints: `GET /profile/preferences`, `POST /profile/preferences/degrees`, `DELETE /profile/preferences/degrees/:educationLevelId`, `POST /profile/preferences/majors`, `DELETE /profile/preferences/majors/:majorId`, `POST /profile/preferences/institutions`, `DELETE /profile/preferences/institutions/:institutionId`. All with `@UseGuards(JwtAuthGuard)`. Add Swagger decorators — `src/modules/profile/controllers/preferences.controller.ts`
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

**✅ Batch 5 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 6 (`010-profile-documents`).
