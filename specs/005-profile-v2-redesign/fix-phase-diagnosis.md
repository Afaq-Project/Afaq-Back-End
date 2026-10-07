# Fix Phase Diagnosis

## Failure 1: `error code is TOO_MANY_EXPERIENCES`
- **Reproduced command:** `./scripts/test-batch-1-2-3-4.sh`
- **Raw output:**
  ```
  Batch 1 — Experiences max limit (EC-007)
    ✗   error code is TOO_MANY_EXPERIENCES
        expected error 'TOO_MANY_EXPERIENCES', got 'VALIDATION_INVALID_FORMAT' — body: {"statusCode":400,"message":"Bad Request","data":null,"timestamp":"2026-09-24T17:25:32.484Z","path":"/api/profile/personal","errors":[{"field":"experiences","code":"VALIDATION_INVALID_FORMAT","message":"experiences must contain no more than 10 elements"}]}
  ```
- **Root cause:** The `UpdateProfileDto` contains `@ArrayMaxSize(10)` which triggers `class-validator` to throw `VALIDATION_INVALID_FORMAT` before the service logic can enforce the dynamic limit and throw `TOO_MANY_EXPERIENCES`.
- **Assigned owner:** Executor
- **Files to be touched:** `src/modules/profile/dto/update-profile.dto.ts` (and any other DTO using `@ArrayMaxSize(10)` for experiences). The approach chosen is to remove the `@ArrayMaxSize(10)` decorator.

## Failure 2: `error code is EDUCATION_DUPLICATE`
- **Reproduced command:** `./scripts/test-batch-1-2-3-4.sh`
- **Raw output:**
  ```
  Batch 2 — Duplicate & max limit (EC-019, EC-020)
    ✓ duplicate education → 409
    ✗   error code is EDUCATION_DUPLICATE
        expected error 'EDUCATION_DUPLICATE', got 'MAX_EDUCATIONS_REACHED' — body: {"success":false,"status":409,"message":"MAX_EDUCATIONS_REACHED","data":null,"meta":null,"errors":[{"code":"MAX_EDUCATIONS_REACHED","message":"MAX_EDUCATIONS_REACHED"}],"timestamp":"2026-09-24T14:26:14+00:00"}
  ```
- **Root cause:** The test script creates records up to `MAX_EDUCATIONS` before running the duplicate education test. As a result, the API throws `MAX_EDUCATIONS_REACHED` before it can validate and throw `EDUCATION_DUPLICATE`.
- **Assigned owner:** QA-Agent
- **Files to be touched:** `scripts/test-batch-1-2-3-4.sh`

## Failure 3: `response.data is an array`
- **Reproduced command:** `./scripts/test-batch-1-2-3-4.sh`
- **Raw output:**
  ```
  Batch 4 — Test Results CRUD lifecycle
    ✓ POST /profile/test-results → 201
    ...
    ✓ GET /profile/test-results → 200
    ✗   response.data is an array
        jq '.data | type' → expected 'array', got 'object'
  ```
- **Root cause:** `TestResultsService.findAll` returns an object `{ data: results, meta: { total, page, limit } }`. Because `meta` lacks a `pagination` key, `TransformInterceptor` does not recognize it as a paginated response and wraps the entire object in `data`, resulting in `response.data` being an object rather than an array.
- **Assigned owner:** Executor
- **Files to be touched:** `src/modules/profile/services/test-results.service.ts` and `src/modules/profile/controllers/test-results.controller.ts`. Ensure it returns a bare array to match the requested shape.
