# Implementation Plan: Profile Tests (Batch 4)

**Branch**: `008-profile-tests` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Prerequisite**: Batch 3 Review Gate PASSED (`007-profile-languages`).

**Unblocks**: `009-profile-preferences`

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Summary

Batch 4 — Standardized Tests Section. Create `TestResultsService` and
`TestResultsController`, validate score against min/max/step, add
`GET /reference/standardized-tests`, update completion.

**Review Gate**: Test results CRUD works. Score outside min/max → 400. Score not
aligned to step → 400. Duplicate test type → 409. Completion reflects 7% tests
group. All tests pass.

---

## Batch 4 — Parallel Execution Plan

### Track A — TestResultsService + DTOs + Controller

**Agent**: `oma-editor`

**DTOs** — `src/modules/profile/dto/create-test-result.dto.ts`:
- `testId: string` (UUID, required) — FK to `StandardizedTests`
- `score: number` (required)
- `takenAt?: string` (ISO date, optional)

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
- `PATCH /profile/test-results/:id`
- `DELETE /profile/test-results/:id`

All with `@UseGuards(JwtAuthGuard)` and standard Swagger decorators.

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
| `POST` | `/api/v1/profile/test-results` | Bearer | `{testId, score, takenAt?}` | TestResult |
| `GET` | `/api/v1/profile/test-results` | Bearer | — | `[TestResult]` |
| `PATCH` | `/api/v1/profile/test-results/:id` | Bearer | UpdateTestResultDto | Updated |
| `DELETE` | `/api/v1/profile/test-results/:id` | Bearer | — | 204 |
| `GET` | `/api/v1/reference/standardized-tests` | Public | — | `[{id, nameEn, nameAr, min, max, step}]` |
