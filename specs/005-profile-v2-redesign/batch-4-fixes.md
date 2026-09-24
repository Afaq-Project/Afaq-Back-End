# Batch 4 Fixes

1. **Failure**: Error keys and HTTP status codes do not match the spec in `test-results.service.ts`.
   - *Reproduction*: Code review of `test-results.service.ts` and E2E test inspection.
   - *Assigned Fix (Executor)*: Update exceptions in `test-results.service.ts`:
     - Exceeding limit: `throw new ConflictException({ message: 'Maximum test results reached', code: 'MAX_TEST_RESULTS_REACHED' });`
     - Test not found: `throw new BadRequestException({ message: 'Test not found', code: 'INVALID_TEST' });`
     - Score out of range: `throw new BadRequestException({ message: 'Score out of range', code: 'SCORE_OUT_OF_RANGE' });`
     - Score not aligned: `throw new BadRequestException({ message: 'Score not aligned to step', code: 'SCORE_NOT_ALIGNED_TO_STEP' });`
     - Duplicate result: `throw new ConflictException({ message: 'Test result already exists', code: 'TEST_RESULT_DUPLICATE' });`
     - Result not found (findById): `throw new NotFoundException({ message: 'Test result not found', code: 'TEST_RESULT_NOT_FOUND' });`
2. **Failure**: `test-batch4.sh` test script is incomplete and does not verify all required behavioral EC cases (e.g. IELTS 7.3, IELTS 7.5, TOEFL, SAT), nor does it wait properly for the Nest server to accept connections.
   - *Reproduction*: Ran `./scripts/test-batch4.sh` and observed a `curl` connection refused error (exit code 7). Also reviewed the script content.
   - *Assigned Fix (QA-Agent)*: Rewrite `scripts/test-batch4.sh` to include a proper wait loop for the server `curl -s http://localhost:3000/api/v1/reference/countries` until it responds. Add explicit POST requests verifying IELTS `7.3` is rejected, IELTS `7.5` is accepted, SAT `405` is rejected, and SAT `410` is accepted. Assert against `errors[0].code` for all EC-028 to EC-034 cases.
