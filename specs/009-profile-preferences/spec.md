# Feature Specification: Profile Preferences (Batch 5)

**Feature Branch**: `009-profile-preferences`

**Created**: 2026-09-21

**Status**: Planned

**Prerequisites**: Batch 4 (`008-profile-tests`) MUST be complete and its Review Gate PASSED.

**Unblocks**: `010-profile-documents`

**Cross-cutting decisions**: See `docx/shared-research.md`

---

## Overview

This spec covers Batch 5 — Special Statuses & Target Preferences of the Profile v2 redesign.
Creates `SpecialStatusesService`, `PreferencesService`, their controllers, adds special
statuses and preferences reference endpoints, completes the completion engine (all 6 groups now active).

---

## User Scenarios & Testing _(mandatory)_

### User Story 6 — Declare Special Statuses (Priority: P3)

A user self-identifies with special statuses relevant to opportunity eligibility —
for example, "Person with Disability", "Refugee", "First-Generation Student". The
user selects from a predefined list. These statuses affect opportunity matching and
eligibility filters applied by the recommendation engine.

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

## Requirements _(mandatory)_

### Functional Requirements

#### Special Statuses

- **FR-026**: Special statuses MUST be selected from a predefined master list.
  Free-text status declarations are NOT accepted.
- **FR-027**: Duplicate status entries for the same user are NOT permitted.

#### Target Preferences

- **FR-028**: Target degrees MUST reference education level records from the master list.
- **FR-029**: Target majors MUST reference major records from the master list.
- **FR-030**: Target institutions MUST reference institution records from the master list.
- **FR-031**: Duplicate preference entries within the same category are silently
  deduplicated (no error, no duplication).
- **FR-032**: The maximum number of entries per preference category (degrees, majors,
  institutions) MUST be configurable via the system settings store.

---

### Key Entities

- **SpecialStatus**: A self-declared status (e.g., disability, refugee status).
  References a master list item.
- **TargetPreference**: A user's academic intent — expressed as sets of target degrees,
  majors, and institutions. Each set references master list items.

---

## Success Criteria

- Deduplication is silent — adding a preference twice produces no error and no duplicate record.
- `GET /profile/preferences` returns all three sub-lists in a single unified object.
- After all 6 groups are filled, `completionPct = 100`.

---

## Assumptions

- Batch 4 is complete.
- Maximum fallbacks: 5 target degrees, 10 target majors, 10 target institutions.
