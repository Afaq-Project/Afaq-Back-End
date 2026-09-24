# Fix Phase Completion

## 1. Failure 1: `error code is TOO_MANY_EXPERIENCES`
- **Root cause:** The `UpdateProfileDto` contains `@ArrayMaxSize(10)` which triggers `class-validator` to throw `VALIDATION_INVALID_FORMAT` before the service logic can enforce the dynamic limit and throw `TOO_MANY_EXPERIENCES`.
- **Chosen fix:** Removed `@ArrayMaxSize(10)` from `UpdateProfileDto` to rely entirely on `ProfileService.updateProfile` for length validation.
- **Files changed:** `src/modules/profile/dto/update-profile.dto.ts`
- **Output Before:**
  ```
  ✗   error code is TOO_MANY_EXPERIENCES
      expected error 'TOO_MANY_EXPERIENCES', got 'VALIDATION_INVALID_FORMAT'
  ```
- **Output After:**
  ```
  ✓   error code is TOO_MANY_EXPERIENCES (error=TOO_MANY_EXPERIENCES)
  ```

## 2. Failure 2: `error code is EDUCATION_DUPLICATE`
- **Root cause:** The test script creates records up to `MAX_EDUCATIONS` before running the duplicate education test, throwing `MAX_EDUCATIONS_REACHED` first.
- **Chosen fix:** Modified the test script to dynamically check and delete an existing education record (if at the limit) before running the duplicate test. Similar fix applied for the GPA orphaned-raw test skip.
- **Files changed:** `scripts/test-batch-1-2-3-4.sh`
- **Output Before:**
  ```
  ✗   error code is EDUCATION_DUPLICATE
      expected error 'EDUCATION_DUPLICATE', got 'MAX_EDUCATIONS_REACHED'
  ```
- **Output After:**
  ```
  ✓   error code is EDUCATION_DUPLICATE (error=EDUCATION_DUPLICATE)
  ```

## 3. Failure 3: `response.data is an array`
- **Root cause:** `TestResultsService.findAll` returned an object `{ data, meta }` without proper pagination shape, causing the `TransformInterceptor` to wrap the object into `response.data`.
- **Chosen fix:** Modified `TestResultsService.findAll` to return the array directly, and updated `TestResultsController.findAll` to return the array to properly pass through the interceptor.
- **Files changed:**
  - `src/modules/profile/services/test-results.service.ts`
  - `src/modules/profile/controllers/test-results.controller.ts`
- **Output Before:**
  ```
  ✗   response.data is an array
      jq '.data | type' → expected 'array', got 'object'
  ```
- **Output After:**
  ```
  ✓   response.data is an array
  ```

## Gate 3 & 4 Validations
- Confirmation: No un-skipped test regressed.
- Confirmation: The second script run (fresh run) exited `0` with `Failed: 0`.
- **Gate 4 Checks Output:**
  1. Reproducibility: Fully reproduced and addressed.
  2. Boundary Check: Passed. Executor touched no tests; QA-Agent touched no source files.
  3. Shortcut Scan: Passed. (Zero matches for shortcuts/ignores in `src/modules/profile/`)
  4. Silent-Skip Scan: Passed. (Zero `.skip` matches across test/src directories).
  5. Fix-Shape Consistency: Verified. Test-results shape is an array; educations/languages shapes were unchanged.
  6. Idempotency Check: Passed. Script re-run was successful.
