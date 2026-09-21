# Feature Specification: Profile Languages (Batch 3)

**Feature Branch**: `007-profile-languages`

**Created**: 2026-09-21

**Status**: Planned

**Prerequisites**: Batch 2 (`006-profile-education`) MUST be complete and its Review Gate PASSED.

**Unblocks**: `008-profile-tests`

**Cross-cutting decisions**: See `docx/shared-research.md`

---

## Overview

This spec covers Batch 3 — Languages Section of the Profile v2 redesign.
It rewrites `LanguagesService`, updates DTOs, adds proficiency levels reference endpoint.
Updates completion engine to include languages group.

---

## User Scenarios & Testing _(mandatory)_

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

### Edge Cases

- A user adds the same language twice — the second insertion is rejected with a conflict error.

---

## Requirements _(mandatory)_

### Functional Requirements

#### Language Records

- **FR-019**: Language proficiency MUST be selected from a predefined proficiency
  level master list. Free-text proficiency values are NOT accepted.
- **FR-020**: Each language record MUST support a native-speaker flag (`isNative`).
- **FR-021**: The maximum number of language records per profile MUST be configurable
  via the system settings store.

---

### Key Entities

- **LanguageRecord**: A single language the user speaks. References a master language
  and a structured proficiency level. Includes a native-speaker flag.

---

## Success Criteria

- **SC-006**: Structured fields (languages, proficiency levels) reject free-text input in 100% of cases.

---

## Assumptions

- Batch 2 is complete. `LanguagesMaster` and `ProficiencyLevels` are seeded before Batch 3 tests run.
- Maximum fallback: 10 languages per profile.
