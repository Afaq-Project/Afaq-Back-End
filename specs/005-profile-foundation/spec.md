# Feature Specification: Profile Module v2 Redesign

**Feature Branch**: `005-profile-foundation`

**Created**: 2026-09-21

**Status**: Draft

**Decision References**: DEC-AUTH-01–05, DEC-PROF-01–16, DEC-CROSS-01–02

---

## Overview

This feature redesigns the Profile Module from the ground up to replace the current
free-text, flat-structure profile system with a structured, relation-driven model.
The goal is to produce a profile that is machine-readable, matchable against
opportunities, and accurately reflective of a user's real-world academic and personal
identity — without depending on the account login data in any way.

This is a migration from v1.3 to v2.0 of the profile data model. The existing
profile module is partially dismantled and rebuilt. No new features visible to the
user are introduced beyond what was already planned; the changes are primarily
structural improvements that unlock reliable matching.

---

## Clarifications

### Session 2026-09-21

- Q: User Story 9 listed 9 items for "8 sections" — how should the section count be described? → A: Education is a single section covering both current education level and education history. Corrected to: "personal information, location, education (current level + history), languages, test results, special statuses, target preferences, and documents."
- Q: FR-008 last weight group was labelled "Target Preferences" but included special statuses — what is the correct group name? → A: "Preferences & Statuses (target majors, target degrees, target institutions, special statuses) — 15%"
- Q: FR-023 omitted the scoreStep constraint from StandardizedTests — should score step validation be enforced? → A: Yes. Out-of-range or off-step scores MUST be rejected.
- Q: Should document uploads enforce a maximum file size and allowed MIME type whitelist? → A: Yes, both values must be configurable via SystemSettings with fallback defaults (FR-033b added).
- Q: Should the bio field have a maximum character length? → A: Yes, configurable via SystemSettings with fallback default (FR-009b added).
- Q: Should the spec explicitly state that Notifications and SavedOpportunities are deferred? → A: Yes, added to Assumptions with DEC-PROF-14 and DEC-PROF-15 references.
- Q: User Story 2 used "date range" — what are the explicit date fields for education records? → A: start date, end date, expected graduation date, and isCurrent flag.
- Q: FR-040 only mentioned country and institution search — should major search also be supported? → A: Yes. Country, institution, and major searches all support a search term parameter.
- Q: FR-041 only mentioned skills removal — should the legacy FieldOfStudy table removal also be specified? → A: Yes. Both skills and FieldOfStudy are removed; their functionality is replaced by Majors.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — View and Update Personal Information (Priority: P1)

A registered user opens their profile for the first time after signing up. The profile
is blank. The user fills in their first name, last name, date of birth, gender,
marital status, phone number, a short biography, and optionally their email and
profile photo. The user also selects their country of residence, nationality, and
current city from predefined lists. The system saves each update and recalculates
the profile completion percentage automatically.

**Why this priority**: Personal identity and location are the foundation of the
profile. Without them, no matching can occur. This story unlocks the largest portion
of the completion percentage and is the first thing every new user will do.

**Independent Test**: A tester can create a new account, navigate to the profile
endpoint, submit personal info fields in isolation, and verify the returned profile
reflects the saved data with an updated completion percentage. No other section
is required.

**Acceptance Scenarios**:

1. **Given** a newly registered user whose profile is completely empty, **When** the user sets their `countryOfResidenceId`, **Then** the location section updates. If they later change the country, the system must automatically clear any mismatched `currentCityId`.
   user submits their first name, last name, and date of birth, **Then** the system
   saves the data and the completion percentage reflects the weight of those fields
   (11 out of 100 points earned).

2. **Given** a user with some personal info already saved, **When** the user updates
   their marital status and selects a country of residence from the countries list,
   **Then** the system saves both fields, the completion percentage increases
   accordingly, and the matching version number increments.

3. **Given** a user selecting a country of residence, **When** the user queries the
   countries list with a search term, **Then** the system returns matching countries
   in both English and Arabic without requiring authentication.

4. **Given** a user who selects a country, **When** the user then queries cities
   filtered by that country, **Then** only cities belonging to that country are
   returned.

---


### User Story 8 — Automatic Matchability Determination (Priority: P2)

Matchability (`isMatchable`) is automatically determined by the system based on the profile completion percentage. When a user reaches the required threshold (configured via `SystemSettings`), `isMatchable` becomes `true`. The user cannot manually toggle, pause, or disable matchability.

**Why this priority**: Matchability is the gate between a profile and the opportunity recommendation engine. Automating it based on completeness ensures accuracy and prevents half-complete profiles from polluting
results.

**Independent Test**: A tester can create a profile with fields that push `completionPct`
above 60%, then re-fetch the profile and verify `isMatchable: true` without making any
explicit matchability call. The tester can then remove a record to drop `completionPct`
below 60% and verify `isMatchable` becomes `false` on the next fetch.

**Acceptance Scenarios**:

1. **Given** a user whose `completionPct` reaches the configured threshold (default 60),
   **When** the recalculation runs after a profile mutation,
   **Then** `isMatchable` becomes `true` automatically.

2. **Given** a user who previously had `isMatchable: true` and then deletes a record
   causing `completionPct` to drop below the threshold, **When** the recalculation runs,
   **Then** `isMatchable` becomes `false` automatically.

3. **Given** a user attempting to send `isMatchable` directly to any endpoint,
   **When** the request is submitted, **Then** it is rejected with `400 UNKNOWN_FIELD`
   due to `forbidNonWhitelisted: true`.


---

### User Story 9 — View Complete Profile (Priority: P1)

A user (or the frontend) fetches the complete profile in a single request. The
response includes all 8 sections: personal information, location, education
(current level + history), languages, test results, special statuses, target
preferences, and documents. Profile data is completely separate from the account's
login data — the profile name may differ from the account name.

**Why this priority**: The full profile view is the starting point for every user
session. The frontend depends on this single endpoint to hydrate all profile-related
UI states.

**Independent Test**: A tester can call `GET /profile/me` and verify the response
contains all 8 sections structured consistently, even if some sections are empty.

**Acceptance Scenarios**:

1. **Given** a user with a partially filled profile, **When** `GET /profile/me`
   is called, **Then** the response contains all 8 sections — empty sections return
   empty arrays or `null` values rather than being omitted.

2. **Given** the profile's name fields differ from the account name, **When** the
   profile is returned, **Then** the profile's name fields reflect what the user
   entered in the profile — not the account registration name.

3. **Given** an unauthenticated request, **When** `GET /profile/me` is called,
   **Then** the system returns a 401 Unauthorized response.

---

### User Story 10 — Automatic Profile Completion Tracking (Priority: P1)

Every time the user adds, edits, or removes any profile data — in any section —
the system automatically recalculates the completion percentage. No manual action
or dedicated recalculation call is required. The matching version also increments
automatically with every change, ensuring the recommendation engine knows the
profile has been updated.

**Why this priority**: Completion tracking is the motivational mechanism that
guides users toward a matchable profile state. Inaccurate or stale percentages
would undermine user trust and degrade matching quality.

**Independent Test**: A tester can add a new education record and immediately
re-fetch the profile to verify the completion percentage and matching version have
both updated without any additional API call.

**Acceptance Scenarios**:

1. **Given** a user who adds their first language record, **When** the creation
   request succeeds, **Then** the profile's `completionPct` increases by 10 points
   and `matchingVersion` increments — both reflected in the next profile fetch.

2. **Given** a user who deletes their only test result, **When** the deletion
   succeeds, **Then** the `completionPct` decreases by 7 points.

3. **Given** a user who updates a target major (replaces one with another), **When**
   the update succeeds, **Then** `completionPct` remains unchanged (no new group
   unlocked) but `matchingVersion` still increments — reflecting that the profile's
   matching intent has changed.

---

### Edge Cases

- A user submits a city that does not belong to the selected country — the system rejects the update with `CITY_COUNTRY_MISMATCH`.
- A user adds an education record with `isCurrent: true` and no `endDate` — the
  system accepts it (ongoing education).
- A user submits a GPA of `0` on a 100-point scale — the system accepts it (valid
  score) and normalizes to 0.0 on the 4.0 scale.
- A user queries institutions or majors with no country/category filter — the system
  returns all records, paginated.
- A user attempts to set `completionPct` directly via the update endpoint — the field
  is ignored; completion is always computed, never manually set.
- A user deletes the only education record that was contributing the 25-point group
  bonus — the `educationLevelId` field still exists on the profile, so the 10-point
  education-level contribution remains; only the 25-point "has at least one record"
  contribution is removed.
- The `SystemSettings` table is empty on a fresh environment — the completion
  calculation falls back to hardcoded weights and does not fail.
- A user adds the same language twice — the second insertion is rejected with a
  conflict error.
- A user requests cities for a country with no seeded cities — the system returns
  an empty list, not an error.

---
## Requirements _(mandatory)_

### Functional Requirements

#### Profile Core

- **FR-001**: The system MUST maintain a profile record for every registered account.
  The profile is created automatically at account registration, initially empty.
- **FR-002**: The profile MUST be identifiable using the account's user ID. No
  separate profile identifier is issued.
- **FR-003**: Profile fields MUST be independently updatable; updating one field MUST
  NOT require re-submitting unrelated fields.
- **FR-004**: Every profile mutation MUST trigger automatic recalculation of the
  completion percentage. No manual recalculation step is exposed to users.
- **FR-005**: The matching version counter MUST increment on every recalculation,
  unconditionally — regardless of whether the completion percentage changed.
- **FR-006**: The profile's name, date of birth, and personal information MUST be
  entirely independent from the account's registration name. No synchronization
  between the two occurs.
- **FR-007**: The system MUST reject any attempt by a user to directly set the
  completion percentage or matching version. Both are system-computed.

#### Completion Percentage

- **FR-008**: The completion percentage MUST be computed using a weighted scoring
  model with the following group contributions:
  - Personal Identity (first name, last name, date of birth, gender, marital status) — 18%
  - Location & Origin (country of residence, nationality) — 15%
  - Education (education level set + at least one education record) — 35%
  - Languages (at least one language record) — 10%
  - Standardized Tests (at least one test result) — 7%
  - Preferences & Statuses (target majors, target degrees, target institutions, special statuses) — 15%
- **FR-009**: Fields excluded from the completion calculation MUST include: `bio`,
  `phone`, `email`, `profilePhotoUrl`, `currentCityId`, all documents, and any
  records beyond the first in any group.
- **FR-009b**: The bio field MUST be limited to a maximum character length. This
  limit MUST be read from SystemSettings with a code-level fallback default.
- **FR-010**: The weight values and record limits MUST be configurable at runtime
  via a system settings store. The system MUST fall back to hardcoded defaults if
  a setting key is missing and MUST NOT fail.

#### Matchability

- **FR-011**: Matchability (`isMatchable`) MUST be automatically computed by the system based on the completion percentage against a configurable threshold.
- **FR-012**: The user MUST NOT be able to manually toggle, pause, or disable matchability.

#### Reference / Master Data

- **FR-037**: All reference endpoints MUST be publicly accessible — no authentication
  is required.
- **FR-038**: The reference API MUST expose: education levels, languages, proficiency
  levels, countries, cities (filterable by country), institutions (filterable by
  country and city), major categories, majors (filterable by category), marital
  statuses, special statuses, standardized tests, and document types.
- **FR-039**: All master data items MUST be returned uniformly with `nameEn` and `nameAr` fields.
- **FR-040**: Country, institution, and major searches MUST support a search term
  parameter for filtering by name.

#### Skills Removal

- **FR-041**: The skills system (skills master list, user skill associations, and
  all related endpoints) AND the legacy FieldOfStudy table MUST be fully removed.
  Their functionality is replaced by Majors. No equivalent replacement is
  introduced in this version.

---

### Key Entities

- **UserProfile**: The central hub of a user's real-world identity. Linked to one
  account. Contains personal information, location, education level, and computed
  matching fields. All profile sub-records link back to this entity.

- **EducationRecord**: A single entry in the user's academic history. References a
  recognized institution, primary major, optional minor major, and education level.
  May include a GPA stored in the original scale and normalized to 4.0.

- **LanguageRecord**: A single language the user speaks. References a master language
  and a structured proficiency level. Includes a native-speaker flag.

- **TestResult**: A single standardized test score. References a known test type.
  Score is validated against the test's defined bounds.

- **SpecialStatus**: A self-declared status (e.g., disability, refugee status).
  References a master list item.

- **TargetPreference**: A user's academic intent — expressed as sets of target degrees,
  majors, and institutions. Each set references master list items.

- **Document**: An uploaded file tied to a user profile. Classified by document type
  (master list). Storage and database lifecycle are explicitly sequenced: storage
  deletion precedes record deletion.

- **SystemSettings**: A key-value configuration store that controls completion weights,
  record limits, and other tunable parameters. Always provides fallback defaults.

- **Master Tables**: Countries, Cities, Institutions, Majors, MajorCategories,
  EducationLevels, MaritalStatuses, SpecialStatuses, StandardizedTests, LanguagesMaster,
  ProficiencyLevels, DocumentTypes. All are bilingual (English + Arabic). All are
  read-only to users.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user with a complete profile (all high-weight fields and at least one
  record in each group) achieves a completion percentage of 100%. Any partial
  combination produces a proportionally correct result.

- **SC-002**: Every profile data mutation — across any section — updates the completion
  percentage and increments the matching version within the same response cycle.
  No separate refresh call is required.

- **SC-003**: The profile completion percentage is never inaccurate for more than one
  operation — it is always consistent with the last saved state.

  is successful. A failed storage deletion leaves the database record untouched 100%
  of the time.

- **SC-005**: All reference endpoints respond to unauthenticated clients without
  requiring any credentials.

- **SC-009**: The `isMatchable` flag is recomputed automatically on every profile
  mutation and reflects `completionPct >= matching.threshold` at all times. No user
  action can set it directly.

- **SC-010**: A fresh environment with an empty system settings store can start and
  compute completion percentages without errors, using hardcoded fallback values.

---

## Assumptions

- The existing `Users` table (account data) and `UserProfiles` table (profile data)
  remain physically separate. No field is shared or synchronized between them.
- Profile authentication is handled by the upstream Auth module. This feature assumes
  a valid user identity is always available from the authenticated session.
- The matching engine (external Python service) consumes profile data by reading
  from the database directly. This feature's responsibility ends at data accuracy;
  the matching engine's behavior is out of scope.
- Auth endpoints are already updated to return tokens only (no profile snapshot).
  This spec does not cover Auth endpoint changes — those belong to the Auth module.
- The `Users` repository changes needed to strip profile data from user creation
  (removing `fullName` propagation) are considered a dependency of this spec, not
  its primary scope.
- Countries, institutions, and majors are partially seeded and partially populated
  on demand (via external API lookup when a user makes a selection). Seeding
  procedures are outside this spec's scope.
- Cities, education levels, marital statuses, special statuses, standardized tests,
  language master, proficiency levels, and document types are fully seeded before
  this feature goes live.
- The maximum values used as fallbacks if `SystemSettings` is empty are:
  5 educations, 10 languages, 10 test results, 5 target degrees, 10 target majors,
  10 target institutions.
- Documents are stored in an S3-compatible storage provider. Signed URL generation
  and file lifecycle are infrastructure responsibilities; this spec describes the
  behavioral contract only.
- The profile API is consumed exclusively by the frontend. No machine-to-machine
  client is expected in this version.
- Profile photo upload (`profilePhotoUrl`) is stored as a URL string — the upload
  itself is handled separately and is outside this spec's scope. The profile only
  stores the URL.
- Notifications and SavedOpportunities are deferred to a future User Module
  (DEC-PROF-14, DEC-PROF-15). They are NOT part of this spec and will not be
  implemented in this migration.
