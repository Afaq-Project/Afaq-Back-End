# Feature Specification: Profile API Enhancements & Reference Data Expansion

**Feature Branch**: `004-profile-api-enhancements`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Implement languages reference endpoint, pagination/filtering on all high-volume endpoints, profile completion display, app interface languages endpoint, educational levels table with endpoints, security hardening, and update all tests and seed data."

---

## Clarifications

### Session 2026-09-18
- Q: How should the system "degrade gracefully" if Redis is unavailable for rate limiting? (FR-004-23) → A: Bypass rate limiting (fail open) and log a warning

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse & Filter Reference Data (Priority: P1)

A user opens the profile wizard or settings screen. The application needs to populate dropdown menus for languages, fields of study, skills, and education levels. The user types a few characters to search within a long list (e.g., searching "comp" narrows the fields-of-study list to "Computer Science"). The system returns a paginated, filtered list immediately.

**Why this priority**: Every profile setup flow depends on reference data. Without pagination and search, dropdowns become unusable as the dataset grows beyond a few hundred entries. This directly blocks onboarding completion.

**Independent Test**: Can be fully tested by calling each reference endpoint with and without search/filter parameters and verifying the returned shape includes both `data` and `meta.pagination` fields.

**Acceptance Scenarios**:

1. **Given** a user opens the language selection dropdown, **When** they type "eng" in the search field, **Then** only languages whose names contain "eng" (case-insensitive) are returned, with accurate total count in the `meta.pagination` block.
2. **Given** a user requests the full fields-of-study list without filters, **When** no query parameters are provided, **Then** the first page of results is returned with correct `totalPages` and `hasNext`/`hasPrev` indicators.
3. **Given** a user requests `GET /reference/languages` with `limit=200`, **Then** the system rejects the request with a 400 error indicating the maximum allowed limit is 100.
4. **Given** any user (unauthenticated), **When** they call any reference endpoint, **Then** the request succeeds with 200 — no authentication is required for reference data.

---

### User Story 2 - Select an Education Level from Standardised List (Priority: P1)

A user filling in the education section of their profile needs to pick their highest educational qualification. Instead of a free-text field (which previously accepted any string), a curated dropdown now appears with standardised options (High School, Diploma, Bachelor, Master, PhD, Certificate, Other). The selection is persisted on the profile and displayed back on retrieval.

**Why this priority**: The `educationLevel` field is weighted at 15% of profile completion and is a required field for the matching engine. Standardising this value enables reliable filtering and analytics. A free-text field cannot be used for structured matching.

**Independent Test**: Can be fully tested by calling `GET /reference/education-levels` to retrieve the list, then `PATCH /profile` with a valid level name, then `GET /profile` to confirm the value is stored and returned correctly.

**Acceptance Scenarios**:

1. **Given** a user fetches `GET /reference/education-levels`, **Then** exactly 7 active records are returned (high_school, diploma, bachelor, master, phd, certificate, other) with both English and Arabic labels, without requiring authentication.
2. **Given** a user submits `PATCH /profile` with `educationLevelId: <UUID>`, **Then** the value is accepted, stored, and returned in subsequent `GET /profile` responses.
3. **Given** a user submits `PATCH /profile` with an invalid or non-existent `educationLevelId` UUID, **Then** the request is rejected with a 400 validation error.

---

### User Story 3 - View Profile Completion Progress in the UI (Priority: P1)

A user visits their profile dashboard. The UI displays a progress bar or percentage showing how complete their profile is (e.g., "75% complete"). This value is returned directly from `GET /profile` without requiring a separate API call.

**Why this priority**: Profile completion drives user engagement and is used by the matching engine to rank users for opportunities. The field already exists in the data model but the PRD confirmed it is already embedded in `GET /profile` — this story validates that the returned value is accurate and correctly weighted.

**Independent Test**: Can be fully tested by creating a user, progressively completing profile fields, and verifying `completionPct` increases at expected increments matching the weighted scoring table.

**Acceptance Scenarios**:

1. **Given** a freshly registered user with an empty profile, **When** they call `GET /profile`, **Then** `completionPct` is `0` and `coreFieldsComplete` is `false`.
2. **Given** a user has set `educationLevel`, `nationality`, and at least one `fieldOfStudy`, **When** they call `GET /profile`, **Then** `completionPct` is `45` (15+15+15) and `coreFieldsComplete` is `true`.
3. **Given** a fully complete profile (all weighted fields filled), **When** the user calls `GET /profile`, **Then** `completionPct` is `100`.

---

### User Story 4 - Browse Paginated List of Own Skills, Languages, Documents & Educations (Priority: P2)

A user views their profile page where all their personal data is listed (skills they've added, languages they speak, uploaded documents, education records). As a power user with many entries, they expect paginated results with navigation controls rather than one massive list that freezes the UI.

**Why this priority**: Without pagination these endpoints return unbounded queries, which will degrade performance and user experience as the platform scales. This is a correctness and scalability requirement, not a feature addition.

**Independent Test**: Can be fully tested by adding 25+ skills to a user and calling `GET /profile/skills?page=1&limit=20`, verifying only 20 are returned with `meta.pagination.total` showing 25 and `hasNext: true`.

**Acceptance Scenarios**:

1. **Given** a user has 25 skills, **When** they call `GET /profile/skills?page=1&limit=20`, **Then** 20 skills are returned with `meta.pagination.total=25`, `hasNext=true`, `hasPrev=false`.
2. **Given** a user has 25 skills, **When** they call `GET /profile/skills?page=2&limit=20`, **Then** 5 skills are returned with `hasNext=false`, `hasPrev=true`.
3. **Given** a user calls `GET /profile/documents`, **Then** the document response items do NOT include the internal `storagePath` field (security requirement).

---

### User Story 5 - Application Requests Supported UI Languages (Priority: P2)

The frontend application needs to know which interface languages the platform supports (for a language switcher in the top navigation). It calls a dedicated endpoint to retrieve the list of supported locales, including their BCP-47 codes, human-readable names, native names, and text direction (`ltr`/`rtl`).

**Why this priority**: This is a lightweight, no-auth endpoint returning a static list. It unblocks the frontend's internationalisation setup and is trivial to implement.

**Independent Test**: Can be fully tested by calling `GET /reference/app-languages` without any token and verifying the response includes at least Arabic (`ar`, `rtl`) and English (`en`, `ltr`) entries.

**Acceptance Scenarios**:

1. **Given** any caller (unauthenticated), **When** they call `GET /reference/app-languages`, **Then** the response returns 200 with a list of supported locales each containing `code`, `name`, `nativeName`, and `dir`.
2. **Given** the Arabic locale entry, **Then** its `dir` field is `"rtl"` (right-to-left).
3. **Given** the response, **Then** it does not require a database query and is served from a static configuration.

---

### User Story 6 - System Rejects Malformed UUID Route Parameters (Priority: P1)

A developer or attacker calls an endpoint with a non-UUID string in a route parameter (e.g., `GET /profile/skills/abc` or `PATCH /profile/languages/1`). Instead of propagating the invalid value to the database layer and receiving a cryptic error, the system immediately rejects the request at the routing layer with a clear 400 response.

**Why this priority**: This is a security and reliability gap. Non-UUID params bypass type validation and can cause unexpected behaviour in the service/database layer. This is a must-fix before production.

**Independent Test**: Can be fully tested by calling `GET /profile/skills/not-a-valid-uuid` and verifying a 400 response is returned before any database interaction occurs.

**Acceptance Scenarios**:

1. **Given** a caller sends `GET /profile/skills/not-a-uuid`, **Then** the response is 400 with a message indicating the parameter must be a valid UUID.
2. **Given** a caller sends `PATCH /profile/languages/123`, **Then** the response is 400.
3. **Given** a caller sends 6 rapid login attempts within 60 seconds, **Then** the 6th attempt returns a 429 Too Many Requests response.

---

### Edge Cases

- What happens when a user searches with special characters (e.g., `search=%` or `search=<script>`)? The system must treat the input as a literal string search, not as a SQL operator or HTML.
- What happens when `page` or `limit` is provided as a decimal (e.g., `page=1.5`)? The system must reject with 400.
- What happens when `limit=0` or `page=0` is provided? The system must reject with 400.
- What happens when a reference endpoint is called with an unknown query parameter (e.g., `GET /reference/languages?foo=bar`)? The system must ignore unknown parameters silently (whitelist validation strips them).
- What happens if the `skills-taxonomy` endpoint is called with a search term that matches no skills? An empty paginated list is returned, not a 404.

---

## Requirements _(mandatory)_

### Functional Requirements

**Reference Data Endpoints**

- **FR-004-01**: The system MUST provide `GET /reference/languages` returning a paginated list of master languages, accepting optional `search` (name filter), `page`, and `limit` query parameters. No authentication required.
- **FR-004-02**: The system MUST provide `GET /reference/education-levels` returning all active education level records (id, name, labelEn, labelAr, isActive). No authentication required.
- **FR-004-03**: The system MUST provide `GET /reference/app-languages` returning a static, hardcoded list of supported UI locales. Each entry MUST include `code` (BCP-47), `name`, `nativeName`, and `dir` (`ltr`/`rtl`). No database query. No authentication required.
- **FR-004-04**: The system MUST modify `GET /reference/fields-of-study` to accept optional `search`, `category`, `page`, and `limit` query parameters, returning a paginated response with `meta.pagination`.
- **FR-004-05**: The system MUST modify `GET /reference/skills-taxonomy` to support a dual-mode response: when no query parameters are provided the existing grouped response is preserved and MUST also include `meta.pagination`; when any filter is provided (search, category, page, or limit) a flat paginated list is returned with `meta.pagination`.

**Education Level Data Model**

- **FR-004-06**: The system MUST include an `EducationLevel` data entity with fields: unique identifier, machine-readable `name` (e.g., `bachelor`), English label (`labelEn`), Arabic label (`labelAr`), and active status flag.
- **FR-004-07**: The `EducationLevel` table MUST be seeded with exactly 7 values: `high_school`, `diploma`, `bachelor`, `master`, `phd`, `certificate`, `other`.
- **FR-004-08**: The `UserProfiles.educationLevelId` field MUST validate against the `EducationLevel` table using a UUID and reject any invalid value with a 400 error.

**Pagination on Profile Sub-Lists**

- **FR-004-09**: `GET /profile/skills` MUST accept `page` and `limit` query parameters and return a paginated response with `meta.pagination`. Requires authentication.
- **FR-004-10**: `GET /profile/languages` MUST accept `page` and `limit` query parameters and return a paginated response with `meta.pagination`. Requires authentication.
- **FR-004-11**: `GET /profile/documents` MUST accept `page` and `limit` query parameters and return a paginated response with `meta.pagination`. The `storagePath` field MUST NOT appear in any response item. Requires authentication.
- **FR-004-12**: `GET /profile/educations` MUST accept `page` and `limit` query parameters and return a paginated response with `meta.pagination`. Requires authentication.

**Shared Pagination Infrastructure**

- **FR-004-13**: All paginated endpoints MUST share a common pagination query structure: `page` (integer ≥ 1, default 1), `limit` (integer 1–100). Invalid values MUST be rejected with 400. Explicit defaults are:
  - `/reference/languages`: 20
  - `/reference/fields-of-study`: 20
  - `/reference/skills-taxonomy`: 50
  - `/profile/skills`: 10
  - `/profile/languages`: 10
  - `/profile/documents`: 10
  - `/profile/educations`: 10
- **FR-004-14**: All paginated responses MUST include a `meta.pagination` block containing: `page`, `limit`, `total`, `totalPages`, `hasNext`, `hasPrev`.
- **FR-004-15**: All `search` query parameters MUST be treated as literal strings (not interpreted as operators). Maximum length 100 characters.

**Profile Completion**

- **FR-004-16**: `GET /profile` MUST return `completionPct` (integer 0–100) computed from the established weighted scoring table. No separate endpoint is required.
- **FR-004-17**: The `completionPct` scoring MUST weight `educationLevelId` at 15%, `fieldOfStudy` at 15%, `nationality` at 15%, and the remaining optional fields as specified in the existing scoring table.

**Security**

- **FR-004-18**: All route parameters that expect a UUID (e.g., `:skillId`, `:languageId`, `:documentId`, `:educationId`) MUST be validated at the routing layer. Non-UUID values MUST return 400 before reaching the service layer.
- **FR-004-19**: Authentication-sensitive endpoints (`POST /auth/login`, `POST /auth/register`) MUST enforce a rate limit of no more than 5 requests per 60-second window per IP address. Exceeding the limit MUST return 429.
- **FR-004-20**: The global request validation MUST be configured to reject any fields not declared in the request DTO with a 400 error (forbidNonWhitelisted mode).
- **FR-004-22**: All `/profile/*` endpoints MUST derive `userId` strictly from `req.user.id` (JWT). Any request attempting to provide a `userId` in the query string or body MUST be rejected with a 400 error. Cross-user access attempts MUST return 403 or 404.
- **FR-004-23**: All `/reference/*` endpoints MUST enforce a rate limit of 60 requests per 60-second window per IP address via Redis. If Redis is unavailable, the system MUST bypass rate limiting (fail open) and log a warning.

**Response Standardisation**

- **FR-004-21**: The `GET /users` (admin) endpoint response MUST nest pagination metadata under `meta.pagination` to match the platform standard, rather than returning it at the root level.

### Key Entities

- **EducationLevel**: A reference entity representing a standardised educational qualification level. Attributes: unique identifier, machine-readable name, English display label, Arabic display label, active status. Used to standardise the `educationLevel` field on user profiles.
- **Paginated Response**: A standard response envelope wrapping any list endpoint. Contains the result array under `data` and pagination metadata under `meta.pagination` (total, page, limit, totalPages, hasNext, hasPrev).
- **AppLanguage**: A value object (not stored in the database) representing a supported UI locale. Attributes: BCP-47 code, English name, native name, text direction.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can search through any reference list (languages, fields of study, skills) and receive filtered results within 500 milliseconds, regardless of list size.
- **SC-002**: All list endpoints return at most `limit` items per response (default varies by endpoint, maximum 100), preventing unbounded data transfer on any single request.
- **SC-003**: Users filling in their profile education level can only select from 7 standardised values; invalid values are rejected 100% of the time with a clear, actionable error message.
- **SC-004**: The profile completion percentage displayed to the user matches the server-computed value within 0 percentage points (no stale or client-calculated values).
- **SC-005**: Any request using a malformed (non-UUID) route parameter is rejected at the API gateway layer before reaching the database, 100% of the time.
- **SC-006**: No more than 5 login or registration attempts per IP per minute are accepted; excess requests are rejected with a rate-limit response.
- **SC-007**: The `GET /reference/app-languages` endpoint is served without any database query, delivering a response in under 50 milliseconds under any load.
- **SC-008**: After all changes are applied, the existing automated test suite (Postman/Newman smoke tests) passes with 0 failures.

---

## Assumptions

- The `LanguagesMaster` table already exists in the database and is seeded with at least 10 language records. The new `GET /reference/languages` endpoint reads from this existing table.
- The existing global `ValidationPipe` in `main.ts` can be configured to enforce whitelist mode without breaking existing endpoints.
- **BREAKING CHANGE**: The `educationLevelId` field on `UserProfiles` will be a UUID foreign key referencing the `EducationLevel` table. The `PATCH /profile` endpoint will now require a valid UUID instead of a free-text string. Clients must be updated to use the new reference endpoint to fetch valid IDs.
- The `GET /users` response envelope change (nesting pagination under `meta.pagination`) may be a minor breaking change for any admin UI consumers. Coordination with the frontend team is assumed before deploying this specific change.
- **BREAKING CHANGE**: The `skills-taxonomy` endpoint's legacy grouped response now strictly includes a `meta.pagination` block (unlike previously where `meta` was null or missing). Existing frontend consumers must be updated to handle this envelope change.
- The six application UI languages in the static list (`en`, `ar`, `fr`, `de`, `es`, `tr`) are considered sufficient for the current release. Adding new languages requires a code change and new frontend translation bundle, so a database-driven approach is intentionally deferred.
- Redis caching for reference endpoints is intentionally bypassed for this sprint to reduce complexity. It will be addressed in a future performance optimization sprint.
- No changes are made to the authentication flow, billing, applications, or opportunity modules in this feature.
