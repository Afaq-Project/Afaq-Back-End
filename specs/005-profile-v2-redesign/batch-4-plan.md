# Batch 4 Plan: Standardized Tests Section

## Mission
Fully implement Batch 4 (Standardized Tests Section) of the 005-profile-v2-redesign feature, covering Tasks T059–T070 and Edge Cases EC-028 through EC-034.

## Task List and Dependency Graph

**Track A (Parallel with Track B — writes DTOs, Service, Controller, Guard)**
- **T059** — Create `src/modules/profile/dto/create-test-result.dto.ts`
- **T060** — Create `src/modules/profile/dto/update-test-result.dto.ts`
- **T061** — Create `src/modules/profile/services/test-results.service.ts`
- **T062** — Create `src/modules/profile/controllers/test-results.controller.ts` and `src/modules/profile/guards/test-result-ownership.guard.ts`

**Track B (Parallel with Track A — writes reference endpoint)**
- **T064** — Add `getStandardizedTests()` to `src/modules/profile/services/reference.service.ts`
- **T065** — Add `GET /reference/standardized-tests` to `src/modules/profile/controllers/reference.controller.ts`

**Track C (Sequential — must run after A and B)**
- **T063** — Ensure `TestResultsController` and `TestResultsService` are registered in `src/modules/profile/profile.module.ts`.

**Track D (Tests — run after all production code is complete)**
- **T066** — Create `src/modules/profile/services/test-results.service.spec.ts`
- **T067** — Update `test/profile.e2e-spec.ts`
- **T068** — Update `tests/levora-smoke-tests.json`
- **T069** — Update Postman collections.
- **T070** — Final validations and building.

## Files to be touched by Executor Agents
**Executor Track A**:
- `src/modules/profile/dto/create-test-result.dto.ts`
- `src/modules/profile/dto/update-test-result.dto.ts`
- `src/modules/profile/services/test-results.service.ts`
- `src/modules/profile/controllers/test-results.controller.ts`
- `src/modules/profile/guards/test-result-ownership.guard.ts`

**Executor Track B**:
- `src/modules/profile/services/reference.service.ts`
- `src/modules/profile/controllers/reference.controller.ts`

**Executor Track C**:
- `src/modules/profile/profile.module.ts`

## Acceptance Criteria per Endpoint
1. `POST /api/v1/profile/test-results`:
   - Validates missing `testId` or `score`.
   - Rejects non-existent `testId` UUID with `400 INVALID_TEST`.
   - Rejects score below `minScore` with `400 SCORE_OUT_OF_RANGE`.
   - Rejects score above `maxScore` with `400 SCORE_OUT_OF_RANGE`.
   - Rejects off-step score with `400 SCORE_NOT_ALIGNED_TO_STEP` (using exact integer arithmetic check).
   - Rejects duplicate `(userId, testId)` with `409 TEST_RESULT_DUPLICATE`.
   - Rejects > `MAX_TEST_RESULTS` with `409 MAX_TEST_RESULTS_REACHED`.
   - Returns `201` on success, correctly storing `testDate` if provided.
2. `GET /api/v1/profile/test-results`: Returns `200` with tests and embedded test info.
3. `GET /api/v1/profile/test-results/:id`: Returns `200` or `404 TEST_RESULT_NOT_FOUND`.
4. `PATCH /api/v1/profile/test-results/:id`: Re-validates score. Rejects `testId` in body with `400 UNKNOWN_FIELD`.
5. `DELETE /api/v1/profile/test-results/:id`: Hard deletes, returns `204`.
6. `GET /api/v1/reference/standardized-tests`: Returns `200` (without auth) listing all standardized tests.

## Risk Register
1. **Floating Point Imprecision**: 
   - *Risk*: `(7.3 - 0) % 0.5` might behave unexpectedly in JS due to IEEE 754 precision issues. 
   - *Mitigation*: Hard requirement to use integer arithmetic validation formula in `TestResultsService`.
2. **Missing Route Registration**:
   - *Risk*: Controllers or services aren't registered in `profile.module.ts`.
   - *Mitigation*: Mandatory Route Registration Verification via Orchestrator curl testing in Gate 6.
3. **Improper Mocking/Weak Tests**:
   - *Risk*: QA weakens tests to pass them instead of failing and reporting.
   - *Mitigation*: Explicit anti-weakening audits using `grep` for skip/ignore statements.
4. **Agent Cross-Boundary Actions**:
   - *Risk*: QA edits production code or Executor writes tests.
   - *Mitigation*: Explicit boundary checks during Gate 8.
5. **Typescript Shortcuts (`as any`)**:
   - *Risk*: Executor uses TS bypasses to achieve compilation.
   - *Mitigation*: Regex scan for prohibited TS directives in Gate 2 and 9.

## Route Registration Verification
Before Batch 4 is considered done, `TestResultsController` and `TestResultsService` must be explicitly registered in `profile.module.ts`. The Orchestrator will start the server and run `curl` checks against all new endpoints to confirm they are reachable (not returning `404 Cannot POST/GET...`).

## Step-Validation Correctness
To avoid IEEE 754 floating point issues when validating decimal score steps (e.g., IELTS `0.5`), the Executor MUST use this exact integer arithmetic formula in `test-results.service.ts`:

```typescript
const scoreCents = Math.round(score * 100);
const minCents   = Math.round(minScore * 100);
const stepCents  = Math.round(scoreStep * 100);
if ((scoreCents - minCents) % stepCents !== 0) {
  throw new BadRequestException({ message: 'Score is not aligned to the required step', code: 'SCORE_NOT_ALIGNED_TO_STEP' });
}
```

The test cases will strictly assert that:
- IELTS `7.3` is rejected.
- IELTS `7.5` is accepted.
- SAT `405` is rejected.
- SAT `410` is accepted.
