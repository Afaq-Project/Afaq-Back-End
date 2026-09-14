# Area C: Security Automation Enhancement Plan

## Ownership
**Domain/Area:** Security / QA Automation
**Target Sub-Agent:** `oma-verifier` or `oma-executor` (QA focus)

## Issue Identification
**Issue:** Automated smoke tests lack HTTP 401 (Unauthorized) and 403 (Forbidden) validation.
**Root Cause:** The legacy smoke tests were authored strictly for "happy-path" validation (200/201 responses). The robust security coverage present in the Jest `.e2e-spec.ts` files was never replicated in the Postman/Newman automated suites, leaving infrastructure and pre-deploy smoke tests blind to authentication regressions.

## Dependency Mapping
- **Prerequisites:** None. Highly parallelizable.
- **Dependents:** Improved confidence in deployment pipelines.

## Corrective Strategy
1. Identify key protected endpoints (e.g., `PATCH /api/v1/profile`, `POST /api/v1/profile/documents`, cross-tenant downloads).
2. Inject negative test cases into `tests/levora-smoke-tests.json` simulating missing or invalid JWTs to assert HTTP 401.
3. Inject negative test cases asserting HTTP 403 for unauthorized resource access.
