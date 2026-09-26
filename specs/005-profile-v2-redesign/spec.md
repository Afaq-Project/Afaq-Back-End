# Feature Specification: Profile Module v2 Redesign

**Feature Branch**: `005-profile-v2-redesign`

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

### Session 2026-09-22

- Q: Should `isMatchable` automatically become `false` when profile completion later drops below the configured threshold? → A: Yes. Matchability is recalculated bidirectionally: it is true at or above the threshold and false below it.
- Q: When a client sends server-controlled fields such as `completionPct`, `isMatchable`, or `matchingVersion`, should the request be rejected or ignored? → A: Reject the request with `400 UNKNOWN_FIELD`.
- Q: If an administrator changes a completion group's runtime weight, how should that group's internal components be scored? → A: Scale the documented component weights proportionally within the changed group.
- Q: Must the configured completion group weights always total exactly 100%? → A: Yes. Validate the group-weight settings as a complete set and reject any change that makes their total differ from 100%.
- Q: If file storage succeeds during a document upload but creation of the database record then fails, what should happen to the uploaded file? → A: Immediately attempt to delete the uploaded file, then return an error.

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

### User Story 2 — Manage Education Level and Education History (Priority: P1)

A user specifies their current education level (e.g., Bachelor's Degree) and then
adds one or more historical education records. Each record must reference a real,
recognized institution and major — selected from predefined master lists rather
than typed freehand. The user can also record their GPA using one of three
standardized scales. Duplicate education records for the exact same institution,
major, and level are rejected.

**Why this priority**: Education data carries 35% of the profile completion score —
the single largest weight group. It is also the primary matching input for
academic opportunity recommendations.

**Independent Test**: A tester can add an education record using institution and
major IDs from the reference API and verify the record appears in the profile with
the GPA normalized to a 4.0 scale, with the completion percentage increasing to
reflect the 35-point education group contribution.

**Acceptance Scenarios**:

1. **Given** a user who has not yet set an education level, **When** the user selects
   an education level from the master list, **Then** the system saves it on the
   profile, and 10 completion points are awarded.

2. **Given** a user with an education level set, **When** the user adds a new
   education record by selecting an institution, a primary major, and an education
   level — optionally adding a minor major, a start date, an end date, an expected
   graduation date, an isCurrent flag, and GPA — **Then** the
   record is saved, 25 completion points are awarded (on top of the education-level
   points), and the matching version increments.

3. **Given** a user submitting a GPA of 85 on a 100-point scale, **When** the record
   is saved, **Then** the system also stores the GPA normalized to the 0–4.0 scale
   so the matching engine has a uniform comparison baseline.

4. **Given** a user who already has a record for Institution A, Major B, at Bachelor's
   level, **When** the user attempts to add another record with the same combination,
   **Then** the system rejects the request with a clear conflict message.

5. **Given** a user with an existing education record, **When** the user deletes it,
   **Then** the record is permanently removed, and if it was the user's only education
   record, the 25-point contribution is removed from the completion score.

6. **Given** a user browsing for institutions, **When** the user queries institutions
   filtered by country and city, **Then** only institutions matching those filters are
   returned, without requiring authentication.

---

### User Story 3 — Manage Language Records (Priority: P2)

A user declares the languages they speak. For each language, the user selects the
language name and a structured proficiency level (e.g., Beginner, Intermediate,
Fluent) from master lists, and optionally marks the language as their native tongue.
Free-text proficiency descriptions are no longer accepted.

**Why this priority**: Languages carry 10% of the completion score and are a key
matching dimension for international opportunities. Enforcing structured proficiency
prevents inconsistent data ("I'm good at it", "advanced", "C1") from polluting the
matching engine.

**Independent Test**: A tester can add a language record by selecting a language and
a proficiency level from the reference API, mark it as native, and verify that the
profile's language list reflects this record with the completion score updated.

**Acceptance Scenarios**:

1. **Given** a user with no language records, **When** the user adds their first
   language with a valid proficiency level, **Then** the system saves the record
   and 10 completion points are awarded (languages group threshold met).

2. **Given** a user with a language record, **When** the user updates the proficiency
   level to a higher tier, **Then** the update is saved and the matching version
   increments to signal the profile data has changed.

3. **Given** a user who tries to add a language with a free-text proficiency string,
   **When** the request is submitted, **Then** the system rejects it — only a
   recognized proficiency level ID is accepted.

4. **Given** a user with multiple language records, **When** the user queries their
   language list, **Then** each record shows the language name in both English and
   Arabic alongside the proficiency label.

---

### User Story 4 — Upload and Delete Documents Safely (Priority: P2)

A user uploads identity, academic, or financial documents. Each upload must specify
the document type from a predefined list rather than a free-text category. When the
user deletes a document, the system removes the file from storage first and only
marks the record as deleted after the storage operation succeeds. A storage failure
does not corrupt the database record.

**Why this priority**: Document uploads are a primary onboarding step for
applications. The storage-first deletion rule is a critical data-safety concern —
the current system's DB-first deletion can produce orphaned files with no recovery
path.

**Independent Test**: A tester can upload a document with a valid type ID, verify
it appears in the document list, then delete it and verify both that the file is
unreachable in storage and that the DB record is gone. A simulated storage failure
during deletion must leave the DB record intact.

**Acceptance Scenarios**:

1. **Given** a user uploading a document, **When** the user submits the file with
   a valid document type selected from the master list, **Then** the system stores
   the file and creates a record with the file's size, MIME type, and display name.

2. **Given** a user deleting a document, **When** the deletion request is made,
   **Then** the system deletes the file from storage first; only upon storage
   success does it remove the database record.

3. **Given** a storage provider that fails during a deletion request, **When** the
   deletion attempt is made, **Then** the system returns an error to the user, and
   the database record remains intact so the user can retry later.

4. **Given** a user requesting a download of their document, **When** the request
   is authorized, **Then** the system returns a time-limited signed URL that
   allows direct file download.

5. **Given** a user submitting a document with a free-text category, **When** the
   request is submitted, **Then** the system rejects it — only a recognized
   document type ID is accepted.

---

### User Story 5 — Record Standardized Test Scores (Priority: P2)

A user logs their scores for internationally recognized standardized tests (e.g.,
IELTS, TOEFL, GRE, SAT). Each test entry records the score and an optional date.
The system validates that the entered score falls within the test's defined valid
score range. Each test type can only appear once per user profile.

**Why this priority**: Standardized test scores carry 7% of the completion score
and are a critical signal for academic opportunity matching. Score range validation
prevents implausible data from reaching the matching engine.

**Independent Test**: A tester can add a test result with a score within the valid
range, verify it appears in the profile, and verify that a score outside the valid
range is rejected.

**Acceptance Scenarios**:

1. **Given** a user with no test records, **When** the user adds an IELTS result
   with a valid score within the defined range, **Then** the record is saved and
   7 completion points are awarded.

2. **Given** a user adding a test score, **When** the score falls outside the
   valid minimum–maximum range for that test type, **Then** the system rejects
   the request with a validation error explaining the valid range.

3. **Given** a user who already has an IELTS record, **When** the user attempts
   to add a second IELTS record, **Then** the system rejects it — each test type
   is unique per profile.

---

### User Story 6 — Declare Special Statuses (Priority: P3)

A user self-identifies with special statuses relevant to opportunity eligibility —
for example, "Person with Disability", "Refugee", "First-Generation Student". The
user selects from a predefined list. These statuses affect opportunity matching and
eligibility filters applied by the recommendation engine.

**Why this priority**: Special statuses carry 3% of the completion score and
unlock eligibility for specific opportunity categories. They are not mandatory,
but their presence significantly improves matching quality.

**Independent Test**: A tester can add a special status from the list, verify it
appears in the profile's statuses section, and verify the completion score
reflects the 3-point contribution.

**Acceptance Scenarios**:

1. **Given** a user with no declared statuses, **When** the user adds one valid
   special status, **Then** the record is saved and 3 completion points are awarded.

2. **Given** a user trying to add a status not found in the master list,
   **When** the request is submitted, **Then** the system rejects it.

3. **Given** a user who added a status by mistake, **When** the user deletes it,
   **Then** the status is removed from the profile and the completion score
   decreases accordingly.

---

### User Story 7 — Set Target Academic Preferences (Priority: P2)

A user specifies what they are looking for: their target academic degrees (e.g.,
Master's, PhD), target fields of study (majors), and target institutions. These
are multi-select preference sets selected from the master lists. They form the
preference input to the matching engine.

**Why this priority**: Target preferences carry 12% of the completion score
and are the primary intent signal used by the matching engine to rank and filter
opportunities.

**Independent Test**: A tester can add target preferences across all three
sub-sections, verify they appear in the unified preferences response, and verify
the completion score reflects the group's weight.

**Acceptance Scenarios**:

1. **Given** a user with no preferences set, **When** the user adds a target degree
   (e.g., Master's), **Then** the record is saved and 4 completion points are awarded.

2. **Given** a user adding target majors, **When** the user adds a target major,
   **Then** 5 completion points are awarded on the first addition.

3. **Given** a user adding a target institution, **When** the user adds a target
   institution, **Then** 3 completion points are awarded on the first addition.

4. **Given** a user requesting all preferences, **When** `GET /profile/preferences`
   is called, **Then** the response contains all three sub-lists (degrees, majors,
   institutions) in a single object.

5. **Given** a user adding a preference already in their list, **When** the request
   is submitted, **Then** the system silently deduplicates (no duplicate entries
   are stored).

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
- A user attempts to set `completionPct` directly via the update endpoint — the
  request is rejected with `400 UNKNOWN_FIELD`; completion is always computed and
  never manually set.
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
  via a system settings store. When a configured group weight differs from its
  default, its documented component weights MUST be scaled proportionally to the
  configured group total. The configured group weights MUST total exactly 100%; a
  settings change that would violate this invariant MUST be rejected. The system
  MUST fall back to hardcoded defaults if a setting key is missing and MUST NOT fail.

#### Matchability

- **FR-011**: Matchability (`isMatchable`) MUST be automatically computed by the system
  against a configurable completion threshold: it MUST be `true` when completion is
  at or above the threshold and `false` when completion is below it.
- **FR-012**: The user MUST NOT be able to manually toggle, pause, or disable matchability.

#### Education Records

- **FR-014**: Education records MUST reference institutions, majors, and education
  levels from the predefined master lists. Free-text institution or major names are
  NOT accepted.
- **FR-015**: Each education record supports one primary major and one optional minor
  major.
- **FR-016**: GPA MUST be accepted in one of three standardized scales:
  percentage (0–100), GPA-5 (0–5), or GPA-4 (0–4). The system MUST store both
  the raw value and its normalized equivalent on the 4.0 scale.
- **FR-017**: The system MUST enforce uniqueness of education records per user:
  the combination of institution, primary major, and education level MUST be unique
  per profile.
- **FR-018**: The maximum number of education records per profile MUST be
  configurable via the system settings store.
- **FR-018b**: When `isCurrent` is set to `true`, the system MUST set `endDate` to `null`. When `isCurrent` is set to `false`, the system MUST set `expectedGraduationDate` to `null`. When both `minorMajorId` and `majorId` are provided, they MUST differ. When both `endDate` and `startDate` are provided, `endDate` MUST be greater than or equal to `startDate`. All rules apply on both create and update operations.

#### Language Records

- **FR-019**: Language proficiency MUST be selected from a predefined proficiency
  level master list. Free-text proficiency values are NOT accepted.
- **FR-020**: Each language record MUST support a native-speaker flag (`isNative`).
- **FR-021**: The maximum number of language records per profile MUST be configurable
  via the system settings store.

#### Standardized Test Records

- **FR-022**: Test results MUST reference a test type from the standardized tests
  master list.
- **FR-023**: The system MUST validate that a submitted test score falls within the
  valid minimum and maximum range defined for that test type, AND aligns with the
  defined score step. Out-of-range or off-step scores MUST be rejected.
- **FR-024**: Each test type MUST appear at most once per profile.
- **FR-025**: The maximum number of test records per profile MUST be configurable
  via the system settings store.

#### Special Statuses

- **FR-026**: Special statuses MUST be selected from a predefined master list.
  Free-text status declarations are NOT accepted.
- **FR-027**: Duplicate status entries for the same user are silently deduplicated (idempotent), preventing duplication without returning an error.

#### Target Preferences

- **FR-028**: Target degrees MUST reference education level records from the master
  list. Free-text degrees are NOT accepted.
- **FR-029**: Target majors MUST reference major records from the master list.
- **FR-030**: Target institutions MUST reference institution records from the master
  list.
- **FR-031**: Duplicate preference entries within the same category are silently
  deduplicated (no error, no duplication).
- **FR-032**: The maximum number of entries per preference category (degrees, majors,
  institutions) MUST be configurable via the system settings store.

#### Documents

- **FR-033**: Document upload MUST require the user to specify a document type
  selected from the master list. Free-text document categories are NOT accepted.
- **FR-033b**: Document uploads MUST enforce a maximum file size and a whitelist of
  allowed MIME types. Both values MUST be read from SystemSettings with code-level
  fallback defaults.
- **FR-033c**: Document upload MUST perform content inspection (e.g., MIME sniffing and content analysis) to verify that the actual file content matches the user-declared document type.
- **FR-033d**: If storage upload succeeds but database record creation fails, the system
  MUST immediately attempt to delete the uploaded file, then return an error. This
  compensating action prevents orphaned files.
- **FR-034**: Document deletion MUST be storage-first: the file MUST be removed from
  the storage provider before the database record is deleted. A storage failure MUST
  leave the database record intact and return an error to the user.
- **FR-035**: Document deletion MUST be permanent (hard-delete). No soft-delete or
  recovery mechanism is provided.
- **FR-036**: The system MUST provide a time-limited, authenticated download URL for
  each stored document.

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

- **SC-004**: Document deletion leaves no orphaned files in storage when the deletion
  is successful. A failed storage deletion leaves the database record untouched 100%
  of the time.

- **SC-005**: All reference endpoints respond to unauthenticated clients without
  requiring any credentials.

- **SC-006**: Structured fields (institutions, majors, education levels, languages,
  proficiency levels, test types, document types) reject free-text input in 100%
  of cases.

- **SC-007**: Test score submissions outside the defined valid range for a given test
  type are rejected in 100% of cases.

- **SC-008**: Duplicate education records (same institution + major + level) are
  rejected in 100% of cases.

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
