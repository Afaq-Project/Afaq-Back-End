# Feature Specification: Profile Tests (Batch 4)

**Feature Branch**: `008-profile-tests`

**Created**: 2026-09-21

**Status**: Planned

**Prerequisites**: Batch 3 (`007-profile-languages`) MUST be complete and its Review Gate PASSED.

**Unblocks**: `009-profile-preferences`

**Cross-cutting decisions**: See `docx/shared-research.md`

---

## Overview

This spec covers Batch 4 — Standardized Tests Section of the Profile v2 redesign.
Creates `TestResultsService` and `TestResultsController`, validates score against
min/max/step, adds `GET /reference/standardized-tests`, updates completion.

---

## User Scenarios & Testing _(mandatory)_

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

## Requirements _(mandatory)_

### Functional Requirements

#### Standardized Test Records

- **FR-022**: Test results MUST reference a test type from the standardized tests master list.
- **FR-023**: The system MUST validate that a submitted test score falls within the
  valid minimum and maximum range defined for that test type, AND aligns with the
  defined score step. Out-of-range or off-step scores MUST be rejected.
- **FR-024**: Each test type MUST appear at most once per profile.
- **FR-025**: The maximum number of test records per profile MUST be configurable
  via the system settings store.

---

### Key Entities

- **TestResult**: A single standardized test score. References a known test type.
  Score is validated against the test's defined bounds.

---

## Success Criteria

- **SC-007**: Test score submissions outside the defined valid range for a given test type are rejected in 100% of cases.

---

## Assumptions

- Batch 3 is complete. `StandardizedTests` are seeded before Batch 4 tests run.
- Maximum fallback: 10 test results per profile.
- Score step validation uses integer arithmetic (multiply by 100) to avoid float precision issues.
