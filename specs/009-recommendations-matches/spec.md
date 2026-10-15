# Feature Specification: Recommendations Module (Personalized Match Scores)

**Feature Branch**: `009-recommendations-matches`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Add a new, separate Recommendations module that exposes pre-calculated user-to-opportunity match scores (produced by the external matching service) to the frontend, supporting a lightweight match list and an auxiliary match list with brief opportunity info. The module never calculates matches and never returns full opportunity details. Requesting recalculation is out of scope for now."

## Clarifications

### Session 2026-10-07

- Q: When opportunities or matches change, how should cached results be refreshed? → A: Time-based expiry only (medium for default list, 5–10 minutes for combined list).
- Q: What are the default and maximum page sizes? → A: Default 20, max 100.
- Q: Should matches for expired or inactive opportunities be hidden? → A: Hidden by default, with an explicit filter to include them.
- Q: Which opportunity filters are supported? → A: Reuse the same filter names and semantics as the existing opportunities list.
- Q: What happens when the matching service's database is unreachable? → A: Return a standard service-unavailable error (503).
- Q: Where do cache durations live? → A: Environment configuration (deployment settings), not the administrative settings table.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View my match scores (Priority: P1)

An authenticated user opens the app and the app retrieves the user's match scores (one per opportunity: percentage, breakdown, calculation version, calculation time). The app uses these to show match badges on every screen and to sort/filter opportunities by relevance, merging them locally with opportunity data it already holds.

**Why this priority**: This is the core value of the feature and the default way all other screens consume personalization.

**Independent Test**: Authenticate as a user with existing match scores, request the match list, and verify only that user's matches are returned, paginated, with no opportunity descriptive fields.

**Acceptance Scenarios**:

1. **Given** a user with calculated matches, **When** they request their matches, **Then** they receive a page of match items (opportunity identifier, score percentage, score breakdown, calculation version, calculation time) plus total, page, limit and a sync timestamp.
2. **Given** a user with matches, **When** they request with a minimum score, **Then** only matches at or above that score are returned.
3. **Given** a user with matches, **When** they choose a sort order (highest score, lowest score, most recently calculated), **Then** results follow that order.
4. **Given** a user who previously synced, **When** they request matches calculated after their last sync timestamp, **Then** only newer/changed matches are returned.
5. **Given** a user with no calculated matches, **When** they request matches, **Then** an empty list with total 0 is returned (not an error).
6. **Given** an unauthenticated caller, **When** they request matches, **Then** access is denied.

---

### User Story 2 - Filter matches by opportunity attributes (Priority: P2)

A user narrows their matches using opportunity attributes (e.g., type, country, deadline, remote) without the response exposing any of those opportunity fields.

**Why this priority**: Enables the "My Recommendations" screen with filters while keeping the module lightweight.

**Independent Test**: Request matches with an opportunity-type or country filter and verify only matches for opportunities satisfying the filter are returned and that no opportunity fields appear in items.

**Acceptance Scenarios**:

1. **Given** matches across several opportunity types, **When** the user filters by one type, **Then** only matches for that type are returned and totals reflect the filtered set.
2. **Given** combined filters (score, country, deadline), **When** requested, **Then** all filters are applied together.
3. **Given** an invalid filter or sort value, **When** requested, **Then** a clear validation error is returned.

---

### User Story 3 - Personalized list with brief opportunity info (Priority: P2)

For screens that need a ready-to-render personalized list quickly, a user requests matches together with a brief summary of each opportunity (id, title, organization, deadline, country, type, remote flag) in one call.

**Why this priority**: Convenience path for the home page; not the default path.

**Independent Test**: Request the combined list and verify each item contains match data plus exactly the brief opportunity summary and no full details (description, eligibility, application link, etc.).

**Acceptance Scenarios**:

1. **Given** a user with matches, **When** they request the combined list, **Then** each item has the same match data as the default list plus a brief opportunity summary.
2. **Given** the same filters, sort and pagination inputs as the default list, **When** requested, **Then** the same set of matches is selected.
3. **Given** a request asking for full opportunity fields, **When** processed, **Then** those fields are never returned.

---

### Edge Cases

- A match whose opportunity cannot be resolved (defensive case; the data store enforces the link): it must not break listing; opportunity-filtered queries and the combined endpoint exclude it.
- Matching service data store is unreachable: respond with a service-unavailable error (503), not a crash and not a degraded empty list.
- Page beyond last page: empty list with correct total.
- Page size above 100: silently clamped to 100 (no error).
- Match whose opportunity is expired or inactive: hidden by default; shown only when the include flag is supplied.
- A caller attempting to pass another user's identifier in query or body: ignored; identity always comes from the authenticated session.
- Cached results after matches or opportunities change must not be served stale beyond their defined lifetime.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide an endpoint returning the authenticated user's match records, paginated, with fields: opportunity id, score percentage, score breakdown, calculation version, calculation time; and metadata: total, page, limit, sync timestamp. Default page size is 20; larger requested sizes are silently clamped to 100.
- **FR-002**: System MUST derive the user identity exclusively from the authenticated session and MUST ignore any user identifier supplied in query or body.
- **FR-003**: System MUST support filtering by minimum score, calculated-after timestamp, and by opportunity attributes, reusing the same filter names and semantics as the existing opportunities list. By default, matches whose opportunity is expired (deadline passed) or inactive MUST be hidden; callers MAY pass an explicit filter flag to include them.
- **FR-004**: System MUST support sort orders: score descending, score ascending, calculation time descending.
- **FR-005**: The default match list MUST NOT return any opportunity fields, even when filtering by opportunity attributes.
- **FR-006**: System MUST provide a second endpoint returning the same match items plus a brief opportunity summary (id, title, organization, deadline, country, type, remote flag) using identical filtering, sorting and pagination.
- **FR-007**: No endpoint of this module MAY return full opportunity details (description, eligibility, application URL, etc.).
- **FR-008**: The match item shape, match field mapping and filter logic MUST be defined once and shared by both list endpoints; the brief opportunity mapping MUST be reused from the opportunities module.
- **FR-009**: System MUST read match data from the matching service's data store as read-only and MUST NOT modify it. This module performs no match computation.
- **FR-010**: The default match list MUST be cached per user and filter combination for 30 minutes; the combined list for 5 minutes. Both durations are environment configuration. Cache refresh is time-based expiry only; no explicit invalidation is performed.
- **FR-011**: System MUST validate all inputs (page, limit, score range, sort value, timestamps, filters) and return standard error responses for invalid input, unauthenticated access, and service unavailability. When the matching service's data store is unreachable, both list endpoints MUST return a standard service-unavailable error (503).
- **FR-012**: API documentation MUST state explicitly that this module does not return full opportunity details.
- **FR-013**: System MUST log data-source failures without exposing sensitive data.

**Out of scope (for now)**: Any endpoint or mechanism for requesting match recalculation.

### Key Entities

- **Match**: A pre-calculated relationship between one user and one opportunity: score percentage, score breakdown, calculation version, calculation time. Unique per user–opportunity pair. Owned by the matching service; read-only here.
- **Brief Opportunity Summary**: Read-only subset of an opportunity (id, title, organization, deadline, country, type, remote flag), owned by the opportunities module.
- **User**: The authenticated owner of matches (managed in the main system).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 95% of match list requests complete in under 1 second for users with up to 5,000 matches.
- **SC-002**: 100% of responses from this module contain no full opportunity details, and 100% contain only the authenticated user's matches.
- **SC-003**: Users can fetch only matches changed since their last sync (incremental sync) instead of reloading the entire list.
- **SC-004**: Default and combined lists with identical inputs yield the same set of matched opportunities in 100% of cases.
- **SC-005**: Repeated identical match requests within the cache lifetime are served from cache without querying the data store, and no cached entry is served beyond its lifetime (30 minutes for the default list, 5 minutes for the combined list).

## Assumptions

- Match scores are produced and stored by the external matching service; this module only reads them.
- The existing opportunities module remains the single source for opportunity lists, details, and batch fetch by IDs.
- Users are authenticated through the existing authentication mechanism.
- The frontend merges match data with its cached opportunities in the default case.
- Match data store access is read-only and limited to the necessary data.
- The same user identifier is used in both the main system and the matching service's data store.
