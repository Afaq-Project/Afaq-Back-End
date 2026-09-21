# Data Model: Profile Tests (Batch 4)

**Feature**: 008-profile-tests
**Date**: 2026-09-21
**Schema version**: 2.0 (canonical source: `docx/complete-schema.md`)

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Entities Managed in this Spec

This spec owns `UserTestResults` and uses `StandardizedTests` (seeded in Batch 1).

---

## Core Entity

### UserTestResults — Standardized Test Results

| Column | Type | Nullable | Notes |
|:---|:---|:---:|:---|
| `id` | UUID PK | No | |
| `userId` | UUID FK | No | → `UserProfiles.userId` |
| `testId` | UUID FK | No | → `StandardizedTests.id` |
| `score` | DECIMAL(6,2) | No | Validated at app layer vs min/max/step |
| `testDate` | DATE | Yes | |

**Unique**: `(userId, testId)` — one result per test type per user

**Score validation**: `minScore ≤ score ≤ maxScore` AND `(score - minScore) % scoreStep == 0`

**Limit**: `MAX_TEST_RESULTS` (default 10)

---

## Reference Entity Used

| Entity | Table | Notes |
|:---|:---|:---|
| `StandardizedTests` | `standardized_tests` | + `minScore`, `maxScore`, `scoreStep` |

---

## Score Step Validation Note

Integer arithmetic is used to avoid floating-point imprecision:
```
Math.round(score * 100) % Math.round(scoreStep * 100) === 0
```

For IELTS (step 0.5): score 7.3 → `730 % 50 = 30 ≠ 0` → rejected.
Score 7.5 → `750 % 50 = 0` → accepted.

See `docx/shared-research.md` § 5 for full rationale.
