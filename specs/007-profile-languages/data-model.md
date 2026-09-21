# Data Model: Profile Languages (Batch 3)

**Feature**: 007-profile-languages
**Date**: 2026-09-21
**Schema version**: 2.0 (canonical source: `docx/complete-schema.md`)

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Entities Managed in this Spec

This spec owns `UserLanguages` and uses:
- `LanguagesMaster`
- `ProficiencyLevels`

Both are seeded before Batch 3 tests run.

---

## Core Entity

### UserLanguages — Language Records

Composite PK: one row per language per user.

| Column | Type | Nullable | Notes |
|:---|:---|:---:|:---|
| `userId` | UUID PK | No | → `UserProfiles.userId` |
| `languageId` | UUID PK | No | → `LanguagesMaster.id` |
| `proficiencyLevelId` | UUID FK | No | → `ProficiencyLevels.id` |
| `isNative` | BOOLEAN | No | Default false |

**Limit**: `MAX_LANGUAGES` (default 10)

**Unique constraint**: `(userId, languageId)` — one record per language per user.

---

## Reference Entities Used

| Entity | Table | Notes |
|:---|:---|:---|
| `LanguagesMaster` | `languages_master` | `isoCode` + `nameEn` + `nameAr` |
| `ProficiencyLevels` | `proficiency_levels` | `sortOrder` for ordered display |

---

## FK Naming Conventions

| Field in Prisma | DB Column | References |
|:---|:---|:---|
| `userId` on UserLanguages | `user_id` | `user_profiles.user_id` |
| `languageId` | `language_id` | `languages_master.id` |
| `proficiencyLevelId` | `proficiency_level_id` | `proficiency_levels.id` |

All snake_case in DB, camelCase in TypeScript via `@map()`.
