# Feature Specification: Profile Education (Batch 2)

**Feature Branch**: `006-profile-education`

**Created**: 2026-09-21

**Status**: Planned

**Prerequisites**: Batch 1 (`005-profile-foundation`) MUST be complete and its Review Gate PASSED.

**Unblocks**: `007-profile-languages`

**Decision References**: DEC-PROF-04, DEC-PROF-09, DEC-PROF-10

**Cross-cutting decisions**: See `docx/shared-research.md`

---

## Overview

This spec covers Batch 2 — Education Section of the Profile v2 redesign.
It adds education records (history), GPA normalization, and education reference endpoints
(major categories, majors, institutions). It also covers the seeding strategy for
reference data (countries, cities, institutions, majors).

---

## User Scenarios & Testing _(mandatory)_

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

### Edge Cases

- A user adds an education record with `isCurrent: true` and no `endDate` — the
  system accepts it (ongoing education).
- A user submits a GPA of `0` on a 100-point scale — the system accepts it (valid
  score) and normalizes to 0.0 on the 4.0 scale.
- A user queries institutions or majors with no country/category filter — the system
  returns all records, paginated.
- A user deletes the only education record that was contributing the 25-point group
  bonus — the `educationLevelId` field still exists on the profile, so the 10-point
  education-level contribution remains; only the 25-point "has at least one record"
  contribution is removed.

---

## Requirements _(mandatory)_

### Functional Requirements

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

#### Reference / Master Data (Education subset)

- **FR-040**: Country, institution, and major searches MUST support a search term
  parameter for filtering by name.

---

### Key Entities

- **EducationRecord**: A single entry in the user's academic history. References a
  recognized institution, primary major, optional minor major, and education level.
  May include a GPA stored in the original scale and normalized to 4.0.

- **Reference tables used**: EducationLevel, Institutions, Majors, MajorCategories.
  All are bilingual (English + Arabic). All are read-only to users.

---

## Success Criteria _(mandatory)_

- **SC-006**: Structured fields (institutions, majors, education levels) reject free-text input in 100% of cases.
- **SC-008**: Duplicate education records (same institution + major + level) are rejected in 100% of cases.

---

## Assumptions

- Batch 1 schema migration is complete and the Prisma client is generated.
- Countries, cities, majors, and institutions are seeded before Batch 2 tests run (via `scripts/seed-education-data.ts`).
- The maximum values used as fallbacks if `SystemSettings` is empty: 5 educations.
