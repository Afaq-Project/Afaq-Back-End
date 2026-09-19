# Security Testing Specification: Profile API Enhancements (Feature 004)

## 1. Overview
This document defines the security test cases required to validate the security controls outlined in `security-controls.md` for the `004-profile-api-enhancements` feature. All tests are fully traceable to the feature specification to ensure comprehensive coverage.

## 2. Test Cases

### TC-01: Pagination Limit Enforcement (DoS Prevention)
- **Target**: All paginated endpoints (e.g., `GET /reference/languages`, `GET /profile/skills`)
- **Pre-conditions**: None (for reference endpoints), Authenticated (for profile endpoints).
- **Action**: Send a request with `limit=101` or `limit=200`.
- **Expected Result**: System rejects the request with HTTP 400 Bad Request.
- **Traceability**: FR-004-13, User Story 1 (Scenario 3), SC-002.

### TC-02: Pagination Type Enforcement
- **Target**: All paginated endpoints.
- **Action**: Send a request with `page=1.5`, `page=0`, `limit=0`, or `limit=-1`.
- **Expected Result**: System rejects the request with HTTP 400 Bad Request.
- **Traceability**: Edge Cases section, FR-004-13.

### TC-03: Search String Sanitization & Length Restriction
- **Target**: `GET /reference/languages`, `GET /reference/fields-of-study`, `GET /reference/skills-taxonomy`
- **Action 1**: Send a search parameter with special characters (e.g., `search=%` or `search=<script>`).
- **Expected Result 1**: System processes the search as a literal string without executing code or acting as a SQL wildcard.
- **Action 2**: Send a search parameter exceeding 100 characters.
- **Expected Result 2**: System rejects the request with HTTP 400 Bad Request.
- **Traceability**: FR-004-15, Edge Cases section.

### TC-04: Route Parameter UUID Validation
- **Target**: `GET /profile/skills/:skillId` (or any UUID route like `:languageId`, `:documentId`, `:educationId`).
- **Action**: Send a request with a non-UUID parameter (e.g., `GET /profile/skills/abc`, `GET /profile/skills/123`).
- **Expected Result**: System rejects the request immediately at the routing layer with HTTP 400 Bad Request, before any database interaction occurs.
- **Traceability**: FR-004-18, User Story 6, SC-005.

### TC-05: Mass Assignment Prevention (Whitelist Enforcement)
- **Target**: Any endpoint with a JSON body payload (e.g., `PATCH /profile`).
- **Action**: Send a valid payload containing an additional, unexpected field (e.g., `{"educationLevel": "bachelor", "isAdmin": true}`).
- **Expected Result**: System rejects the request with HTTP 400 Bad Request due to non-whitelisted properties.
- **Traceability**: FR-004-20.

### TC-06: Authentication Rate Limiting
- **Target**: `POST /auth/login` and `POST /auth/register`
- **Action**: Send 6 requests to the same endpoint from the same IP address within a 60-second window.
- **Expected Result**: The first 5 requests are processed normally. The 6th request is rejected with HTTP 429 Too Many Requests.
- **Traceability**: FR-004-19, User Story 6 (Scenario 3), SC-006.

### TC-07: Sensitive Data Exclusion
- **Target**: `GET /profile/documents`
- **Action**: Authenticate and retrieve the list of documents.
- **Expected Result**: The response array items do not contain the `storagePath` field or any internal filesystem paths.
- **Traceability**: FR-004-11, User Story 4 (Scenario 3).

### TC-08: Unknown Query Parameter Handling
- **Target**: Any paginated reference endpoint.
- **Action**: Send a request with an unknown query parameter (e.g., `?foo=bar`).
- **Expected Result**: The system silently ignores the unknown parameter (due to whitelist validation) and returns a successful 200 response.
- **Traceability**: Edge Cases section.

### TC-09: Enum Validation for Education Level
- **Target**: `PATCH /profile`
- **Action**: Send payload `{"educationLevel": "invalid_level"}`.
- **Expected Result**: System rejects the request with HTTP 400 Bad Request, listing the valid options.
- **Traceability**: FR-004-08, User Story 2 (Scenario 3).
