> **Endpoint Reference**: The definitive endpoint specifications are available in `specs/008-profile-tests/endpoints.md`.

# Tasks: Profile Tests (Batch 4)

**Branch**: `008-profile-tests`
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**Prerequisite**: `007-profile-languages` Review Gate PASSED.

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Batch 4 — Standardized Tests Section

**Unblocks**: US5 (test scores + score range/step validation)

**Review Gate**: Test results CRUD works. Score outside min/max → 400. Score not
aligned to step → 400. Duplicate test type → 409. Completion reflects 7% tests
group. All tests pass.

---

### Track A — TestResultsService + DTOs + Controller *(parallel with Track B and C)*

- [ ] T059 [P] [US5] Create `src/modules/profile/dto/create-test-result.dto.ts`. Required: `testId: string` (UUID, FK to `StandardizedTests`), `score: number` (IsNumber). Optional: `testDate?: string` (ISO date) — `src/modules/profile/dto/create-test-result.dto.ts`
- [ ] T060 [P] [US5] Create `src/modules/profile/dto/update-test-result.dto.ts` as `PartialType(CreateTestResultDto)` — `src/modules/profile/dto/update-test-result.dto.ts`
- [ ] T061 [P] [US5] Create `src/modules/profile/services/test-results.service.ts`. Implement: `create(userId, dto)` — load `StandardizedTests` record by `testId` (404 if not found); validate `score >= minScore && score <= maxScore` → 400 if out of range; validate `(score - minScore) % scoreStep === 0` using integer arithmetic (multiply by 100 to avoid float imprecision) → 400 if off-step; unique `(userId, testId)` → 409; enforce `MAX_TEST_RESULTS` from `SystemSettings`; save with `userId` as FK to `UserProfiles.userId`; call `ProfileService.recalculate(userId)`. `findAll(userId)`: include `{ test: { select: { nameEn, nameAr, minScore, maxScore, scoreStep } } }`. `findOne(userId, id)`: 404 if not found. `update(userId, id, dto)`: re-validate score if changed; call `recalculate`. `delete(userId, id)`: hard-delete; call `recalculate`. The DTO field, service parameter, and Prisma column must all use testDate. All complex public methods MUST have JSDoc comments explaining their purpose, parameters, return values, and side effects. — `src/modules/profile/services/test-results.service.ts`
- [ ] T062 [P] [US5] Create `src/modules/profile/controllers/test-results.controller.ts`. Endpoints: `POST /profile/test-results`, `GET /profile/test-results`, `PATCH /profile/test-results/:id`, `DELETE /profile/test-results/:id`. All with `@UseGuards(JwtAuthGuard)`. Add `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` on each method — `src/modules/profile/controllers/test-results.controller.ts`
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

**✅ Batch 4 Review Gate**: Submit completion report per plan.md template before proceeding to Batch 5 (`009-profile-preferences`).
