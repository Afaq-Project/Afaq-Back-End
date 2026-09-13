# Area C: Security Automation Enhancement Tasks

**Owner:** Security/QA Automation Agent (`oma-executor`)

## TASK-C-001: Implement 401 Unauthorized Smoke Tests
- **Why it's necessary:** Ensures API gateway and JWT guards actively block unauthenticated traffic during production deployments.
- **Action:** Add negative request items to `tests/levora-smoke-tests.json` targeting a core endpoint (e.g., `PATCH /api/v1/profile`) with no Authorization header. Add test scripts asserting a 401 status code.
- **Prerequisites:** None.
- **Commit:** `test(smoke): add 401 unauthorized validation cases`

## TASK-C-002: Implement 403 Forbidden Smoke Tests
- **Why it's necessary:** Prevents cross-tenant data leaks by verifying role/ownership guards.
- **Action:** Add negative request items to `tests/levora-smoke-tests.json` simulating an attempt to access a document ID belonging to another user. Add test scripts asserting a 403 status code.
- **Prerequisites:** None.
- **Commit:** `test(smoke): add 403 forbidden cross-tenant validation cases`
