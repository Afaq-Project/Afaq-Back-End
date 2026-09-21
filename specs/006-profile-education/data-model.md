# Data Model: Profile Education (Batch 2)

**Feature**: 006-profile-education
**Date**: 2026-09-21
**Schema version**: 2.0 (canonical source: `docx/complete-schema.md`)

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Entities Managed in this Spec

This spec owns the `UserEducations` entity and uses the following reference entities
(all seeded before Batch 2 tests):

- `EducationLevel` — (shared with `005-profile-foundation`, seeded in Batch 1)
- `Institutions`
- `Majors`
- `MajorCategories`
- `Countries` (seeded via `scripts/load-reference-data.ts`)
- `Cities` (seeded via `scripts/load-reference-data.ts`)

---

## Core Entity

### UserEducations — Education History

Multiple records per user. Each record is a unique institution × major × level combination.

| Column | Type | Nullable | Notes |
|:---|:---|:---:|:---|
| `id` | UUID PK | No | |
| `userId` | UUID FK | No | → `UserProfiles.userId` (cascade delete) |
| `educationLevelId` | UUID FK | No | → `EducationLevel.id` |
| `institutionId` | UUID FK | No | → `Institutions.id` |
| `majorId` | UUID FK | No | → `Majors.id` (named "PrimaryMajor") |
| `minorMajorId` | UUID FK | Yes | → `Majors.id` (named "MinorMajor") |
| `startDate` | DATE | Yes | |
| `endDate` | DATE | Yes | Must be after or equal to startDate if both set |
| `expectedGraduationDate` | DATE | Yes | |
| `isCurrent` | BOOLEAN | No | Default false |
| `gpaRaw` | DECIMAL(5,2) | Yes | Original value as entered |
| `gpaScale` | ENUM | Yes | OUT_OF_4 / OUT_OF_5 / OUT_OF_100; required if gpaRaw set |
| `gpaNormalized` | DECIMAL(5,2) | Yes | Always 0–4.0 scale; computed on write |
| `createdAt` | TIMESTAMPTZ | No | |
| `updatedAt` | TIMESTAMPTZ | Yes | |

**Unique constraint**: `(userId, institutionId, majorId, educationLevelId)`

**Limit**: `MAX_EDUCATIONS` from SystemSettings (default 5)

**Validation**: `endDate >= startDate` when both provided; `gpaScale` required when `gpaRaw` set.

**Domain rules**: `isCurrent = true` clears `endDate`; `isCurrent = false` clears `expectedGraduationDate`; `minorMajorId` MUST differ from `majorId`.

---

## Reference / Master Data Entities Used

| Entity | Table | Notes |
|:---|:---|:---|
| `EducationLevel` | `education_levels` | `code` (unique code), `nameEn`, `nameAr` — seeded in Batch 1 |
| `Countries` | `countries` | Hybrid-cached; loaded via `scripts/load-reference-data.ts` |
| `Cities` | `cities` | FK → Countries; loaded via `scripts/load-reference-data.ts` |
| `MajorCategories` | `major_categories` | Loaded via reference loader |
| `Majors` | `majors` | Hybrid-cached; FK → MajorCategories; loaded via reference loader |
| `Institutions` | `institutions` | Hybrid-cached; FK → Countries + Cities; loaded via reference loader |

All reference entities are bilingual (`nameEn` / `nameAr`), active by default (`isActive: true`), and ordered via `sortOrder`.

---

## GPA Normalization Formula

| Input Scale | Normalization Formula |
|:---|:---|
| `OUT_OF_4` | `gpaNormalized = gpaRaw` |
| `OUT_OF_5` | `gpaNormalized = (gpaRaw / 5) * 4` |
| `OUT_OF_100` | `gpaNormalized = (gpaRaw / 100) * 4` |

Both `gpaRaw` (original) and `gpaNormalized` (4.0-scale) are stored in the database.
The matching engine reads `gpaNormalized` exclusively.

For full rationale, see `docx/shared-research.md` § 4.

---

## FK Naming Conventions (this spec)

| Field in Prisma | DB Column | References |
|:---|:---|:---|
| `userId` on UserEducations | `user_id` | `user_profiles.user_id` |
| `educationLevelId` | `education_level_id` | `education_levels.id` |
| `institutionId` | `institution_id` | `institutions.id` |
| `majorId` | `major_id` | `majors.id` |
| `minorMajorId` | `minor_major_id` | `majors.id` |

All snake_case in DB, camelCase in TypeScript via `@map()`.
