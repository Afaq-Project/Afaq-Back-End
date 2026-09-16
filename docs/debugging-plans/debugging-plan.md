# Debugging Plan: Profile GPA & Education Issues

## Executive Summary

This document outlines the strategy for resolving three interrelated issues in the profile and education modules:
- **Issue A** — Missing education creation endpoint (blocks all new users from setting GPA)
- **Issue B** — Critical 500 error on letter grade GPA submissions
- **Issue C** — Silent partial payload failure when `gpaValue` is sent without `gpaScale`

The plan dictates execution lanes, dependencies, and risk mitigation strategies to ensure safe deployment without regressions.

> **Scope exclusion:** Profile completion percentage calculation logic is excluded from this plan.

---

## Dependency Diagram

```
┌──────────────────────────────────────┐
│             ISSUE A                  │
│  (Education CRUD Endpoints)          │
│  feature/issue-a                     │
│                                      │
│  • New controller                    │
│  • New service                       │
│  • New DTOs                          │
│  • profile.module.ts registration    │
└────────────────┬─────────────────────┘
                 │
                 │  Runtime dependency:
                 │  education record must exist before
                 │  GPA write path can be exercised
                 ▼
┌──────────────────────────────────────┐
│          ISSUES B & C                │
│  (Shared code surface)               │
│  feature/issue-b-c  (ONE BRANCH)     │
│                                      │
│  B: profile.service.ts L346          │
│     parseFloat('A') → NaN → 500      │
│                                      │
│  C: profile.service.ts L327          │
│     gpaValue without gpaScale → 200  │
└──────────────────────────────────────┘
```

**Key dependency rules:**
- A is fully independent at the code level — entirely new files.
- B and C share `profile.service.ts` L327–L379. They **must** live on a single combined branch. Splitting them into two branches guarantees a three-way merge conflict.
- B and C depend on A only for **end-to-end runtime testing** (an education record must exist to exercise the GPA code path). They are independent at the code level.

---

## Execution Lanes

### Wave 1 — Parallel (Day 0)

| Lane | Branch | Work |
|------|--------|------|
| Lane 1 | `feature/issue-a` | New `EducationsController` + `EducationsService` + DTOs + `profile.module.ts` registration |
| Lane 2 | `feature/issue-b-c` | Fix L346 (B) + Fix L327 guard (C) + DTO cleanup + 5 new test cases in `profile.service.spec.ts` |

> [!WARNING]
> Issues B and C **must** be implemented on the same branch (`feature/issue-b-c`). They both edit `profile.service.ts` L327–L379. Do not assign them to separate developers on separate branches.

### Wave 2 — Sequential (Day 1–2)

1. Merge `feature/issue-b-c` first — no new routes, lower deployment risk.
2. Run the pre-deploy production data audit (see Data Migration section) before the deployment.
3. Merge `feature/issue-a` after — adds new routes, requires smoke test post-deploy.
4. Run end-to-end integration tests covering the full GPA lifecycle (create education → submit GPA → verify stored values).

---

## Merge-Conflict Risk Zones

| File | Risk | Why |
|------|------|-----|
| `profile.service.ts` L327–L379 | 🔴 **HIGH** | Issues B and C both edit the same `if/else if` block. One branch only. |
| `profile.service.spec.ts` | 🔴 **HIGH** | All three issues add new test cases to this file. Coordinate to avoid diff conflicts during integration. |
| `profile.module.ts` | 🟡 Medium | Issue A registers a new controller and service here. Easy to forget; silent 404 if missed. |
| `update-profile.dto.ts` | 🟡 Medium | Issue C adds `@ValidateIf` annotations. No overlap with Issue A or B. |
| `gpa-normalizer.ts` | 🟢 Low | Issue B may reference this utility; no changes needed to the utility itself. |
| `prisma/schema.prisma` | 🟢 None | Schema already contains the full `UserEducations` model. No migration needed for B or C. |

---

## Data Migration Steps (Pre-Deploy Checklist for Issue B)

Before deploying the Issue B fix, the following production audit **must** be run to identify and clean up any rows where `gpaRaw` was corrupted by a prior letter-grade submission (which wrote `NaN` to a `Decimal(5,2)` field).

```sql
-- Step 1: Audit (read-only — run first)
SELECT id, user_id, gpa_raw, gpa_raw_scale, gpa_normalized_4
FROM user_educations
WHERE gpa_raw IS NOT NULL
  AND gpa_raw_scale IS NULL;
-- Rows here have gpaRawScale=null (letter scale falls through ternary)
-- and potentially corrupt gpa_raw (NaN serialized as 'NaN' string by some pg driver versions)

-- Step 2: Cleanup (only if rows found in Step 1)
UPDATE user_educations
SET gpa_raw = NULL
WHERE gpa_raw IS NOT NULL
  AND gpa_raw_scale IS NULL;
```

**Checklist:**
- [ ] Run audit query in production (read-only)
- [ ] Review results with team lead before running cleanup
- [ ] Run cleanup query if corrupt rows are found
- [ ] Confirm zero remaining rows via re-run of audit query
- [ ] Document row count before and after in deployment log

---

## Risk Matrix

| Issue | Severity | Likelihood | Mitigation |
|-------|----------|------------|------------|
| **A** — Missing education endpoint | Medium | High (every new user is blocked) | Entirely additive changes. Key review check: module registration. Required DTO fields must use `@IsNotEmpty()`. |
| **B** — Letter grade NaN crash → 500 | High | High (any letter-grade submission triggers it) | Single-line fix on L346 + L369 mirror. Pre-deploy data audit. Coordinate with Issue C on same branch. Add 5 test cases before merge. |
| **C** — Silent no-op on partial payload | Medium | High (no client feedback, data integrity risk) | DTO-layer `@ValidateIf` fix (non-breaking structurally). Service-layer guard as defense-in-depth. **Breaking API contract change** — frontend coordination required. |

---

## Open Questions (Must Be Resolved Before Issue A Implementation)

These ambiguities affect the design of the `EducationsController` and `EducationsService`. Implementation of Issue A **must not begin** until the team reaches a decision on each.

| # | Question | Impact |
|---|----------|--------|
| **A** | What is the maximum number of education records per user? (Languages = 5, Skills = 20, FieldsOfStudy = 5 — no policy defined for education) | Blocks count-check guard in `EducationsService.create()` |
| **B** | Should GPA (`gpaValue`, `gpaScale`) be moved to `PATCH /profile/educations/:id` or stay in `PATCH /profile`? | Determines whether `UpdateProfileDto` is trimmed and whether Issue B/C fixes must also touch the educations endpoint |
| **C** | Is `educations[0]` (most recently created record) the canonical GPA source? Or should GPA be tracked independently per education record? | Affects `getProfileWithDetails()` line 236 return shape and whether a GPA read must change |
| **D** | Should `completionPct` award percentage points for having ≥ 1 education record? Currently it does not. | May require a separate formula update task |
| **E** | On DELETE of the most recent education record: should GPA data be migrated to the next-most-recent record, or discarded? | Affects `EducationsService.remove()` logic |
| **F** | Should `degree`, `major`, `institution` be validated against enums, or remain free-text? | Affects DTO validation approach |
| **G** | Should `GET /profile/educations` return the raw Prisma shape or a mapped DTO (similar to how skills/languages map to `name + id` pairs)? | Affects controller return shape |

---

## Frontend Coordination Requirements (Issue C)

> [!IMPORTANT]
> Issue C introduces a **breaking API contract change**.

**Current behavior:** `PATCH /profile` with `{ gpaValue: 3.5 }` (no `gpaScale`) returns HTTP 200 silently — database is not updated.

**Behavior after fix:** Same request returns HTTP 400 Bad Request with a validation error message.

**Required actions:**
- [ ] Notify frontend team before deploying Issue C
- [ ] Frontend must update all GPA-submission flows to always send `gpaScale` alongside `gpaValue`
- [ ] Coordinate deployment timing: backend fix should not be deployed until frontend is ready, or a feature flag should gate the enforcement
- [ ] Update API documentation / Postman collection to reflect the new contract
