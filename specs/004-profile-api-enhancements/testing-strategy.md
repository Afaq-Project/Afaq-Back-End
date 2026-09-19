# Testing Strategy: Feature 004 (Profile API Enhancements)

This document outlines the testing approach, coverage strategy, and test scenarios to validate the Profile API Enhancements and Reference Data Expansion feature.

## 1. Test Coverage Strategy

Our approach combines Unit, Integration, and End-to-End (E2E) tests to ensure robust validation of both functional requirements and security constraints.

*   **Unit Tests (Services & Utility logic):** Focus on profile completion percentage calculation, query string sanitization, and the logic to serve static app languages.
*   **Integration Tests (API & Database interactions):** Focus on pagination logic, Prisma queries, dual-mode response handling for skills taxonomy, and endpoint input validation pipes (UUID, Whitelist).
*   **E2E Tests (System-level validation):** Focus on rate-limiting behavior, routing-layer parameter rejections, full workflow from reference data lookup to profile patching, and regression validation of the `GET /users` endpoint.

## 2. Test Scenarios

### 2.1 Reference Data Tests (FR-004-01, FR-004-02, FR-004-03, FR-004-04, FR-004-05)
*   **Scenario 1:** Unauthenticated request to `GET /reference/languages` returns 200 with `meta.pagination`.
*   **Scenario 2:** Search query `?search=eng` on languages returns case-insensitive literal matches.
*   **Scenario 3:** `GET /reference/education-levels` returns exactly 7 records with expected fields (id, name, labelEn, labelAr, isActive).
*   **Scenario 4:** `GET /reference/app-languages` returns 200 with standard locales (including `ar` with `dir: rtl`). Server response time is minimal (no DB).
*   **Scenario 5:** `GET /reference/skills-taxonomy` without parameters returns legacy grouped response.
*   **Scenario 6:** `GET /reference/skills-taxonomy?search=dev` returns flat paginated response structure.

### 2.2 Profile Sub-List Pagination Tests (FR-004-09, FR-004-10, FR-004-11, FR-004-12)
*   **Scenario 1:** Authenticated request to `GET /profile/skills?page=2&limit=5` returns the correct page slice and `hasPrev: true`, `hasNext: ...`.
*   **Scenario 2:** Validating `meta.pagination` envelope shape across all profile sub-list endpoints.
*   **Scenario 3:** Verify `GET /profile/documents` response objects exclude the `storagePath` property entirely for security.

### 2.3 Shared Pagination & Input Validation Tests (FR-004-13, FR-004-14, FR-004-15, FR-004-18, FR-004-20)
*   **Scenario 1:** Submitting `page=0` or `limit=-1` returns 400 Bad Request.
*   **Scenario 2:** Submitting `limit=101` returns 400 Bad Request.
*   **Scenario 3:** Passing a non-UUID parameter (e.g., `GET /profile/skills/123`) returns 400 immediately (routing level).
*   **Scenario 4:** Including a non-whitelisted field in `PATCH /profile` returns 400.
*   **Scenario 5:** Query parameter injection attempt (`search=%` or `search=<script>`) is sanitized and treated safely.
*   **Scenario 6:** `search` query with more than 100 characters returns 400.

### 2.4 Profile Education & Completion Tests (FR-004-06, FR-004-07, FR-004-08, FR-004-16, FR-004-17)
*   **Scenario 1:** `PATCH /profile` with valid `educationLevel` (`bachelor`) is successfully persisted.
*   **Scenario 2:** `PATCH /profile` with invalid `educationLevel` (`phd_candidate`) returns 400 validation error.
*   **Scenario 3:** Empty profile returns `completionPct: 0`.
*   **Scenario 4:** Profile filled with `educationLevel`, `nationality`, and `fieldOfStudy` returns `completionPct: 45`.

### 2.5 Security & Rate Limiting Tests (FR-004-19)
*   **Scenario 1:** 5 successive login requests within 60s respond with expected login status codes (200, 401, etc).
*   **Scenario 2:** The 6th login request from the same IP within 60s is rejected with 429 Too Many Requests.

### 2.6 Admin Endpoint Regression Tests (FR-004-21)
*   **Scenario 1:** `GET /users` by Admin returns pagination metadata strictly under `meta.pagination` instead of the root body.

## 3. Success Criteria Validation
The testing phase is considered complete when:
1.  All test scenarios are implemented in the automated test suite.
2.  Postman/Newman smoke tests pass successfully (SC-008).
3.  Load tests confirm rate-limiting enforcement (SC-006).
4.  Performance tests verify `GET /reference/app-languages` executes under 50ms (SC-007).
