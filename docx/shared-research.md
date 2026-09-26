# Shared Research — Cross-Cutting Decisions

This document contains technical decisions that apply to more than one spec
in the `specs/` directory. Each spec references this document instead of
duplicating its content.

**Consumers**: 005-profile-foundation, 006-profile-education, 007-profile-languages,
008-profile-tests, 009-profile-preferences, 010-profile-documents.

---

## 1. Schema Migration Strategy

**Decision**: Wholesale replacement of `prisma/schema.prisma` from `docx/complete-schema.md` in Batch 1, Step A.1. A single named migration (`v2-profile-redesign`) covers the full diff.

**Rationale**: The schema changes are extensive and interconnected (32 tables, enum additions, column renames, new relations). Incremental migration files would create unnecessary intermediate states and complicate rollback. A single complete migration is cleaner and easier to reason about.

**Alternatives considered**: Incremental per-batch migrations — rejected because Prisma requires the schema file to be consistent with cumulative migration state at all times. Writing partial schemas would require maintaining a "draft" schema separate from the production file.

**Risk mitigation**: Run `pnpm prisma migrate dev --dry-run` first to inspect the generated SQL. Validate against a local database snapshot before applying.

---

## 2. completionPct Calculation Engine

**Decision**: Implemented as a private `computeCompletionPct()` method inside `ProfileService`. It is a pure function that takes a snapshot of the profile and all sub-relations in memory. It reads weight values from `SystemSettingsService` at the start of every `recalculate()` call.

**Weight distribution (canonical source: DEC-PROF-04)**:

| Field / Group | Points |
|:---|:---:|
| `firstName` | 3 |
| `lastName` | 3 |
| `dateOfBirth` | 5 |
| `gender` | 4 |
| `maritalStatusId` | 3 |
| `countryOfResidenceId` | 8 |
| `nationalityId` | 7 |
| `educationLevelId` | 10 |
| `userEducations.length > 0` | 25 |
| `userLanguages.length > 0` | 10 |
| `userTestResults.length > 0` | 7 |
| `userTargetMajors.length > 0` | 5 |
| `userTargetDegrees.length > 0` | 4 |
| `userTargetInstitutions.length > 0` | 3 |
| `userSpecialStatuses.length > 0` | 3 |
| **Total** | **100** |

**Excluded fields** (do not affect completion): `bio`, `phone`, `email`,
`profilePhotoUrl`, `currentCityId`, all `Documents`, any record beyond the first in any group.

**Rationale**: Weight values must be configurable at runtime via `SystemSettings`. Code falls back to the above table if any key is missing. A fresh environment with an empty `SystemSettings` table must work correctly.

---

## 3. matchingVersion Behavior

**Decision**: `matchingVersion` is an auto-incrementing integer stored on `UserProfiles`. It increments unconditionally inside every `recalculate()` call — regardless of whether `completionPct` changed.

**Rationale (DEC-PROF-03)**: Changing a target major from Engineering to Medicine does not change `completionPct` (still has at least one major), but it fundamentally changes matching behavior. The version must reflect every profile mutation, not just threshold changes.

**Implementation**: A single `UPDATE user_profiles SET matching_version = matching_version + 1, completion_pct = $new WHERE user_id = $userId` within `recalculate()`.

---

## 4. GPA Normalization Formula

**Decision**: All three supported GPA scales normalize to a 4.0-point basis.

| Input Scale | Normalization Formula |
|:---|:---|
| `OUT_OF_4` | `gpaNormalized = gpaRaw` |
| `OUT_OF_5` | `gpaNormalized = (gpaRaw / 5) * 4` |
| `OUT_OF_100` | `gpaNormalized = (gpaRaw / 100) * 4` |

**Storage**: Both `gpaRaw` (original) and `gpaNormalized` (4.0-scale) are stored in the database. The matching engine reads `gpaNormalized` exclusively.

**Alternatives considered**: Normalizing only at query time — rejected because the matching engine reads directly from the database and should not perform computation.

---

## 5. Test Score Step Validation

**Decision**: Validate `(score - minScore) % scoreStep === 0` (floating-point safe: use integer arithmetic by multiplying all values by 100 before modulo).

**Example**: IELTS — minScore: 0, maxScore: 9, scoreStep: 0.5. Valid scores: 0, 0.5, 1.0, … 9.0. Score of 1.3 is rejected.

**Rationale**: The `StandardizedTests` table defines `scoreStep` explicitly. Ignoring it would allow invalid scores to reach the matching engine.

---

## 6. Document Deletion Order

**Decision**: Storage-first deletion (DEC-PROF-09).
1. `StorageService.delete(storageKey)` — if throws, propagate error, return 500. DB record unchanged.
2. On success → `prisma.documents.delete({ where: { id } })`.

**Rationale**: A DB-first deletion that then fails on storage leaves an orphaned file with no reference and no recovery path. Storage-first ensures the file is always reachable from the DB record until the full operation succeeds.

---

## 7. Document Upload Constraints

**Decision**: File size and MIME type whitelist are read from `SystemSettings`:
- Key `documents.max_size_bytes` → default 10 MB (10,485,760 bytes)
- Key `documents.allowed_mime_types` → stored as JSON array, e.g.:
  `["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]`

Validation occurs in `DocumentsService.upload()` before any storage call.

All SystemSettings keys follow the `<domain>.<setting_name>` pattern. Code-level
constants in `system-settings.keys.ts` map descriptive names to these keys
(e.g., `MAX_DOCUMENT_SIZE_BYTES = 'documents.max_size_bytes'`).

---

## 8. Auth Response Change — Token-Only Pattern

**Decision (DEC-AUTH-04)**: All auth endpoints return only `{ accessToken, refreshToken }`. Profile data is fetched separately via `GET /profile/me`.

**Impact**: The `UserProfileDto` class inside `user-response.dto.ts` is deleted entirely. `UserResponseDto` reduces to `{ accessToken: string; refreshToken: string }`.

**Frontend coordination required**: The frontend must stop reading `userProfile` from auth responses and instead call `GET /api/v1/profile/me` after login to retrieve profile state.

---

## 9. Profile Sub-Table Relation Key Change

**Decision**: In the old schema, sub-tables (`UserEducations`, `UserLanguages`, `Documents`) used `userId` as an FK pointing to `Users.id`. In v2.0, they FK to `UserProfiles.userId`. The Prisma field name `userId` is preserved, but the referenced model changes.

**Impact on services**: Prisma relation syntax in `educations.service.ts`, `languages.service.ts`, and `documents.service.ts` must be updated to create records under `userProfile` (not `user`), and the `include` path changes accordingly.

---

## 10. isMatchable Rules

**Decision (DEC-PROF-01 revised)**: `isMatchable` is exclusively system-controlled.
It is computed automatically as `completionPct >= matching.threshold`, where the
threshold is read from `SystemSettings` under the key `matching.threshold`
(default: 60). The user cannot toggle, pause, disable, or otherwise influence
matchability. `isMatchable` reverts automatically to `false` when `completionPct`
drops below the threshold.

**Implementation**: `isMatchable` is computed inside `recalculate()` on every
profile mutation — alongside `completionPct` and `matchingVersion` — and written
back to `UserProfiles` in the same update.

---

## 11. Seeding Approach

**Decision**: Reference tables are populated in two phases:
- **Batch 1**: `Roles`, `SystemSettings` defaults, and core static tables (education levels, languages master, proficiency levels, marital statuses, special statuses, standardized tests, document types) are seeded immediately.
- **Reference Data Loading**: `scripts/load-reference-data.ts` acts as the primary loader for Countries, Cities, MajorCategories, Majors, and Institutions, resolving relationships dynamically.
- **Development vs. Production**: In development, `scripts/seed-education-data.ts` provides a fast curated sample (minimum 5 majors per category). In production, the full CIP and GeoNames datasets are loaded via the reference data loader.

---

## 12. Parallel Execution Agent Assignment

| Batch | Track | Agent Type | Parallelizable |
|:---:|:---|:---|:---:|
| 1 | A — Schema migration | `oma-architect` | No (prerequisite) |
| 1 | B — Auth precision changes | `oma-editor` | Yes (after A) |
| 1 | C — Skills deletion | `oma-quick` | Yes (after A) |
| 1 | D — SystemSettingsService | `oma-editor` | Yes (after A) |
| 1 | E — ProfileService rewrite | `oma-architect` | Yes (after A) |
| 1 | F — Reference endpoints | `oma-editor` | Yes (after A) |
| 1 | G — Tests | `oma-reviewer` | No (after B–F) |
| 2 | A — Seeding script | `oma-quick` | No (prerequisite) |
| 2 | B — EducationsService | `oma-architect` | Yes (after A) |
| 2 | C — Reference endpoints | `oma-editor` | Yes (after A) |
| 2 | D — Tests | `oma-reviewer` | No (after B–C) |
| 3 | A — LanguagesService | `oma-editor` | Yes |
| 3 | B — Reference endpoints | `oma-quick` | Yes |
| 3 | C — Tests | `oma-reviewer` | No (after A–B) |
| 4 | A — TestResultsService | `oma-editor` | Yes |
| 4 | B — Reference endpoints | `oma-quick` | Yes |
| 4 | C — Tests | `oma-reviewer` | No (after A–B) |
| 5 | A — SpecialStatusesService | `oma-editor` | Yes |
| 5 | B — PreferencesService | `oma-editor` | Yes |
| 5 | C — Reference endpoints | `oma-quick` | Yes |
| 5 | D — Tests | `oma-reviewer` | No (after A–C) |
| 6 | A — DocumentsService | `oma-architect` | Yes |
| 6 | B — Reference endpoints | `oma-quick` | Yes |
| 6 | C — Tests | `oma-reviewer` | No (after A–B) |
