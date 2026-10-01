# Feature Specification: Opportunity Browser

**Feature Branch**: `008-opportunity-browser`

**Created**: 2026-09-30

**Status**: Draft

**Input**: User description: "Create a new module representing a 'Scholarship Opportunities' feature. Data for this feature will be fetched from an external AI service database. The module must expose a browsable list of opportunities with filtering, search, and pagination, plus a detail view for a single opportunity."

---

## Clarifications

### Session 2026-09-30

- Q: Should the opportunities list and detail endpoints require a logged-in user, or be accessible to anyone? → A: Fully public — no token or session required to list or view opportunities.
- Q: When a `fields` parameter includes a field not on the allowed whitelist, should the API reject the entire request with 400 or silently drop the unknown field? → A: Return `400 Bad Request` with a clear message listing the disallowed field(s).
- Q: When a client sends a `limit` value above 100, should the API silently clamp it or reject with 400? → A: Silently clamp to 100 and return results normally.
- Q: When the external AI service database is temporarily unreachable, should the API return 503 or attempt a retry first? → A: Fail immediately with `503 Service Unavailable` — no application-level retry.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 – Browse & Filter Opportunities (Priority: P1)

A user opens the opportunities section and sees a paginated list of scholarship and opportunity cards. They can narrow results by applying filters (country, type, funding, study level, field of study, remote, deadline range) and perform a keyword search.

**Why this priority**: This is the primary entry point to the feature. Without a working, filterable list, no other story has value. It is also the highest-traffic view and directly drives user engagement.

**Independent Test**: Can be fully tested by requesting the opportunities list endpoint with and without various combinations of filters and confirming that the correct subset of records is returned, with accurate pagination metadata.

**Acceptance Scenarios**:

1. **Given** the opportunities list is requested with no parameters, **When** the response is returned, **Then** it contains the first 20 opportunities sorted by most recently added, along with pagination metadata (current page, total records, total pages).
2. **Given** the list is requested with a `country` filter, **When** the response is returned, **Then** only opportunities matching that country are included.
3. **Given** the list is requested with an `opportunity_type` filter (e.g., "scholarship"), **When** the response is returned, **Then** only opportunities of that type are included.
4. **Given** the list is requested with a `funding_type` filter, **When** the response is returned, **Then** only opportunities with that funding type are included.
5. **Given** the list is requested with `is_remote=true`, **When** the response is returned, **Then** only remote opportunities are included.
6. **Given** the list is requested with `deadline_from` and/or `deadline_to` date bounds, **When** the response is returned, **Then** only opportunities whose deadline falls within that range are included.
7. **Given** the list is requested with `study_levels` (comma-separated), **When** the response is returned, **Then** only opportunities matching at least one of those study levels are included.
8. **Given** the list is requested with `fields_of_study` (comma-separated), **When** the response is returned, **Then** only opportunities matching at least one of those fields of study are included.
9. **Given** the list is requested with multiple filters combined, **When** the response is returned, **Then** all filters are applied simultaneously (AND logic) and only matching records appear.
10. **Given** the list is requested with `page` and `limit` parameters, **When** the response is returned, **Then** the correct page slice is returned and pagination metadata reflects the correct offsets.
11. **Given** the list is requested with a `sort` parameter (e.g., `deadline:asc`), **When** the response is returned, **Then** results are ordered accordingly.
12. **Given** an invalid `sort` value or a disallowed `fields` selection is provided, **When** the request is processed, **Then** the system rejects the request with a `400 Bad Request` error.

---

### User Story 2 – Keyword Search Across Opportunities (Priority: P2)

A user types a keyword or phrase into the search bar and the list narrows to opportunities whose title or description matches the query.

**Why this priority**: Search is the fastest path to a relevant result when the user already has something specific in mind. It complements filters but requires its own distinct logic and is independently valuable.

**Independent Test**: Can be fully tested by submitting a search query (`q` parameter) and confirming that only records containing the keyword in their title or description are returned, and that removing the query parameter restores the full list.

**Acceptance Scenarios**:

1. **Given** the list is requested with a `q` parameter, **When** the response is returned, **Then** only opportunities whose title or description contains the search term (case-insensitive) are included.
2. **Given** a `q` parameter is combined with additional filters, **When** the response is returned, **Then** both the keyword match and the filter conditions are applied simultaneously.
3. **Given** a `q` parameter that matches no records, **When** the response is returned, **Then** an empty data array is returned with total count of zero — not an error.
4. **Given** a `q` parameter with leading or trailing whitespace, **When** the request is processed, **Then** the whitespace is stripped and the search proceeds normally.

---

### User Story 3 – View Opportunity Details (Priority: P2)

A user clicks on an opportunity card to see its full details: complete description, eligibility criteria, deadline, application URL, study levels, fields of study, source, and all other available attributes.

**Why this priority**: The list view only shows a summary. Users need the full detail page to make an informed decision about whether to apply. This is the direct conversion moment.

**Independent Test**: Can be fully tested by fetching a specific opportunity by its ID and confirming all expected fields are present in the response, including fields not shown in the list view.

**Acceptance Scenarios**:

1. **Given** a valid opportunity ID, **When** the detail endpoint is called, **Then** the full opportunity object is returned, including all fields: description, eligibility, application URL, study levels, fields of study, location, and timestamps.
2. **Given** an opportunity ID that does not exist, **When** the detail endpoint is called, **Then** the system returns a `404 Not Found` error.
3. **Given** a valid opportunity ID with a `fields` query parameter, **When** the detail endpoint is called, **Then** only the requested fields are returned (partial response).
4. **Given** a `fields` parameter containing a disallowed or non-existent field name, **When** the request is processed, **Then** the system returns a `400 Bad Request` with a message identifying the disallowed field(s).

---

### User Story 4 – Field Selection for Lightweight Responses (Priority: P3)

An API consumer (e.g., a mobile client or a low-bandwidth scenario) can request only specific fields in both the list and detail endpoints to reduce payload size.

**Why this priority**: Field selection is an optimization concern. While not blocking for initial launch, it is specified as a core API contract in the endpoint documentation and avoids the need for a breaking API change later.

**Independent Test**: Can be fully tested by requesting `?fields=id,title,deadline` and confirming the response contains exactly those fields and no others.

**Acceptance Scenarios**:

1. **Given** a list request with `fields=id,title,country`, **When** the response is returned, **Then** each item in the data array contains only those three fields.
2. **Given** a request with `fields=*`, **When** the response is returned, **Then** all available fields are returned for each record.
3. **Given** a request with no `fields` parameter on the list endpoint, **When** the response is returned, **Then** only the default summary fields are returned: `id`, `title`, `organization`, `country`, `deadline`, `opportunity_type`, `is_remote`.
4. **Given** a `fields` value containing a field not in the allowed whitelist, **When** the request is processed, **Then** the system returns a `400 Bad Request` with a message identifying the disallowed field(s) — no partial result is returned.

---

### Edge Cases

- When the external AI service database is unreachable, the API returns `503 Service Unavailable` immediately with a meaningful error message — no application-level retry is attempted.
- Records with `null` deadline are excluded from `deadline_from`/`deadline_to` range filters. They are included in results when no date filter is active.
- What happens when `limit` is set to an excessively large value (e.g., 10,000) — is it capped?
- What happens when `page` is beyond the last available page — is an empty array returned or an error?
- What happens when `deadline_from` is later than `deadline_to` — is this validated?
- What happens when `sort` references a field that exists in the schema but is not in the allowed sort whitelist?
- What happens when the external database returns an opportunity with an empty title — is it still surfaced or filtered out?

---

## Requirements _(mandatory)_

### Functional Requirements

**Opportunity Listing**

- **FR-001**: The system MUST expose a public read-only endpoint that returns a paginated list of cleaned opportunities.
- **FR-002**: The default response MUST return page 1, 20 results per page, sorted by `created_at` descending, when no parameters are provided.
- **FR-003**: The system MUST support the following filter parameters: `country`, `opportunity_type`, `funding_type`, `is_remote`, `deadline_from`, `deadline_to`, `source_id`, `study_levels`, `fields_of_study`.
- **FR-004**: The `study_levels` and `fields_of_study` filters MUST match any record that contains at least one of the provided values (inclusive OR matching within the array).
- **FR-005**: The `deadline_from` and `deadline_to` parameters MUST accept ISO 8601 date strings. If both are provided, only records with deadlines within the inclusive range are returned.
- **FR-006**: The system MUST support a `q` (keyword search) parameter that performs a case-insensitive text match against the opportunity's title and description fields.
- **FR-007**: The system MUST support a `sort` parameter in `field:asc|desc` format. Only a defined whitelist of fields are valid sort targets. Invalid sort targets MUST return `400 Bad Request`.
- **FR-008**: The list response MUST include a `meta` object with `page`, `limit`, `total` (total matching records), and `pages` (total pages) fields.
- **FR-009**: The `limit` parameter MUST be capped at a maximum of 100 records per page. Any value exceeding 100 MUST be silently clamped to 100 — no error is returned to the caller.
- **FR-010**: When `page` exceeds the last available page, the system MUST return an empty `data` array with correct `meta` (not an error).

**Field Selection**

- **FR-011**: Both the list and detail endpoints MUST support a `fields` query parameter accepting a comma-separated list of field names.
- **FR-012**: A strict whitelist of allowed fields MUST be enforced. Any field not on the whitelist MUST cause a `400 Bad Request` response that identifies the disallowed field(s) — no partial result is returned.
- **FR-013**: `fields=*` MUST return all whitelisted fields.
- **FR-014**: When `fields` is omitted on the list endpoint, the default set of returned fields MUST be: `id`, `title`, `organization`, `country`, `deadline`, `opportunity_type`, `is_remote`.

**Opportunity Detail**

- **FR-015**: The system MUST expose a read-only endpoint that returns all available fields for a single opportunity, identified by its UUID.
- **FR-016**: If no opportunity exists for the given ID, the endpoint MUST return `404 Not Found`.

**Data Source**

- **FR-017**: All opportunity data MUST be read from the external AI service database. The system MUST NOT write to, update, or delete records in that database under any circumstances.
- **FR-018**: The connection to the external database MUST be configured exclusively via an environment variable — no credentials are hardcoded.
- **FR-018**: If the external database connection fails or becomes unreachable, the system MUST immediately return a `503 Service Unavailable` response with a meaningful error message — no application-level retry is attempted. The failure MUST be logged with enough context for diagnosis.

### Key Entities

- **Opportunity (Cleaned)**: A structured, deduplicated record produced by the AI service. Key attributes: unique identifier, title, organization name, opportunity type (scholarship, grant, fellowship, etc.), description, eligibility details, location, remote flag, funding type, application deadline, application URL, source URL, country, study levels (array), fields of study (array), creation timestamp, and last-updated timestamp.
- **Source**: The origin from which an opportunity was scraped. Attributes: name, display name, base URL. Exposed as a filter dimension (`source_id`) but its full data is managed entirely by the AI service.
- **Opportunity List Response**: A composite response object containing a `data` array of opportunity summaries and a `meta` pagination descriptor.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: The opportunity list endpoint returns a valid, correctly paginated response in under 500 milliseconds at the 95th percentile under normal load.
- **SC-002**: The opportunity detail endpoint returns a full opportunity record in under 300 milliseconds at the 95th percentile under normal load.
- **SC-003**: 100% of requests with invalid parameters (disallowed `sort` field, unknown `fields` value, malformed date) are rejected with a `400 Bad Request` response — no invalid parameter silently produces wrong results.
- **SC-004**: Requests for a non-existent opportunity ID return `404 Not Found` 100% of the time — never a 500 or an empty 200.
- **SC-005**: Applying any filter combination returns only records that satisfy all specified filter conditions simultaneously — zero records appear that violate any active filter.
- **SC-006**: A keyword search (`q`) never returns records that do not contain the search term in either the title or description — zero false positives.
- **SC-007**: Field selection (`fields=id,title`) returns responses containing exactly and only the requested fields — no extra fields leak through and no requested whitelisted field is missing.
- **SC-008**: The system produces zero writes to the external AI service database — all operations are strictly read-only, verifiable by inspecting query logs.
- **SC-009**: When the external AI service database is unreachable, the API returns `503 Service Unavailable` in under 5 seconds — never a 500 or a hanging connection.

---

## Assumptions

- The external AI service database is a PostgreSQL instance, and the connection URL is available in the environment under `DATABASE_AIService_URL`.
- The data being consumed is the `cleaned_opportunities` table (and related `sources` table for filtering) from the AI service schema. The schema is stable and read-only from this service's perspective.
- The database user provided via `DATABASE_AIService_URL` has SELECT-only privileges on the relevant tables — the application does not need to verify or enforce this itself.
- All opportunity data is pre-cleaned and structured by the AI service; this module performs no cleaning, enriching, or transformation of the raw data.
- The opportunities list and detail endpoints are **public** (unauthenticated) — no login or token is required. If authentication is introduced in the future, it will be handled by a separate spec amendment and will not change the current API contract.
- Pagination is offset-based (`page`/`limit`). Cursor-based pagination is out of scope.
- The `q` keyword search matches against `title` and `description` only. Searching across other fields (e.g., `organization`, `country`) is out of scope for this spec.
- Static filter value lists (e.g., the enumeration of valid opportunity types or study levels) are managed and displayed by the frontend; no dedicated "get filter options" endpoint is required by this spec.
- The maximum allowed `limit` per page is 100. Requests above this will be clamped silently to 100 (not rejected).
- The allowed `fields` whitelist and the allowed `sort` field whitelist are defined in `data-model.md §Field Whitelist` and `§Sort Whitelist`.
- This spec covers the backend API only. Frontend rendering, routing, and UI components are out of scope.
- Response shape follows the project-standard envelope: `{ statusCode, message, data, timestamp }` for all endpoints, consistent with the existing GlobalExceptionFilter and interceptors.
