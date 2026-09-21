> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/006-profile-education/endpoints.md`.

# Tasks: Profile Education (Batch 2)

**Branch**: `006-profile-education`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Prerequisite**: `005-profile-foundation` Review Gate PASSED.

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Batch 2 — Education Section

**Unblocks**: US2 (education history + GPA normalization)

**Review Gate**: Education CRUD with FK-based inputs works. GPA normalization is correct
for all 3 scales. Duplicate education records rejected (409). Completion reflects 35%
education group. All tests pass.

---

### Track A — Seeding Script *(sequential — blocks Tracks B and C)*

- [ ] T035 Create `scripts/seed-education-data.ts` — the development-mode seeding script. Seeds a curated sample of: 20 countries, 50 cities (resolved by countryIsoCode2 → countryId lookup), 8 major categories, at least 5 majors per category (minimum 40 total), 30 institutions (with countryId and cityId resolved). All inserts use upsert on unique keys. Script must be idempotent. Invocation: `pnpm ts-node scripts/seed-education-data.ts` — `scripts/seed-education-data.ts`
- [ ] T036 Run `pnpm ts-node scripts/seed-education-data.ts` and verify all sample data is present in the database. Confirm no errors — *(shell command)*

**✅ Checkpoint A**: Sample reference data seeded. Tracks B and C may start in parallel.

---

### Track B — EducationsService + DTOs + Controller *(parallel after Track A; [P] with Track C)*

- [ ] T037 [P] [US2] Rewrite `src/modules/profile/dto/create-education.dto.ts`. Required: `educationLevelId: string` (UUID), `institutionId: string` (UUID), `majorId: string` (UUID). Optional: `minorMajorId?: string` (UUID), `startDate?: string` (ISO date), `endDate?: string` (ISO date), `expectedGraduationDate?: string` (ISO date), `isCurrent?: boolean`, `gpaRaw?: number` (min 0), `gpaScale?: 'OUT_OF_4' | 'OUT_OF_5' | 'OUT_OF_100'`. Add `@ValidateIf` on `gpaScale` to require it when `gpaRaw` is provided. Add cross-field validation: `endDate` must be after or equal to `startDate` when both provided — `src/modules/profile/dto/create-education.dto.ts`
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

**✅ Batch 2 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 3 (`007-profile-languages`).

---

## Notes

- All tasks prefixed `[P]` are parallelizable within the same track.
- T035–T036 are sequential and block all other tracks.
- T043–T047 run only after Tracks B and C are complete.
