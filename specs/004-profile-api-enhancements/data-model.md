# Data Model: Profile API Enhancements & Reference Data Expansion

**Feature**: 004-profile-api-enhancements | **Phase**: 1 — Design
**Date**: 2026-09-18

---

## New Entities

### EducationLevel

A reference lookup entity representing a standardised educational qualification level. Read-only from the API perspective (no write endpoints in this sprint).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | UUID | Primary key, auto-generated | `gen_random_uuid()` |
| `name` | String (VarChar 50) | Unique, NOT NULL | Machine-readable slug: `bachelor`, `master`, etc. |
| `labelEn` | String (VarChar 100) | NOT NULL | English display label e.g. `"Bachelor"` |
| `labelAr` | String (VarChar 100) | NOT NULL | Arabic display label e.g. `"بكالوريوس"` |
| `isActive` | Boolean | NOT NULL, default `true` | Soft-deactivation flag |

**Seed values** (7 rows, inserted idempotently via `upsert` on `name`):

| name | labelEn | labelAr |
|---|---|---|
| `high_school` | High School | ثانوية عامة |
| `diploma` | Diploma | دبلوم |
| `bachelor` | Bachelor | بكالوريوس |
| `master` | Master | ماجستير |
| `phd` | PhD | دكتوراه |
| `certificate` | Certificate | شهادة |
| `other` | Other | أخرى |

**Prisma model block**:
```
model EducationLevel {
  id       String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name     String  @unique @db.VarChar(50)
  labelEn  String  @map("label_en") @db.VarChar(100)
  labelAr  String  @map("label_ar") @db.VarChar(100)
  isActive Boolean @default(true) @map("is_active")

  @@map("education_levels")
}
```

**No relations in this sprint.** `UserProfiles.educationLevel` remains `String?` validated at DTO level.

---

## Modified Entities

### PaginationDto (extended)

Location: `src/common/dto/pagination.dto.ts`

Added field:

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `search` | String (optional) | `@IsOptional`, `@IsString`, `@MaxLength(100)` | Case-insensitive substring filter. Applied to `name` field on LanguagesMaster, FieldOfStudy, SkillsMaster. |

Existing fields (`page`, `limit`, `skip`) are unchanged.

---

### UserProfiles (validation change only)

No schema change in this sprint.

| Field | Current | Change |
|---|---|---|
| `educationLevel` | `String?` free-text | DTO adds `@IsIn(['high_school','diploma','bachelor','master','phd','certificate','other'])` in `UpdateProfileDto` |

---

## Value Objects (No DB Table)

### AppLanguage

A static value object returned by `GET /reference/app-languages`. Not persisted in the database.

| Field | Type | Example |
|---|---|---|
| `code` | String (BCP-47) | `"ar"` |
| `name` | String | `"Arabic"` |
| `nativeName` | String | `"العربية"` |
| `dir` | `"ltr"` \| `"rtl"` | `"rtl"` |

**Constant location**: `src/modules/profile/constants/app-languages.constant.ts`

**Initial values** (6 locales):

| code | name | nativeName | dir |
|---|---|---|---|
| `en` | English | English | ltr |
| `ar` | Arabic | العربية | rtl |
| `fr` | French | Français | ltr |
| `de` | German | Deutsch | ltr |
| `es` | Spanish | Español | ltr |
| `tr` | Turkish | Türkçe | ltr |

---

## Shared Utilities

### buildMeta() — Pagination Meta Builder

Location: `src/common/utils/paginate.util.ts`

**Input**: `{ total: number, page: number, limit: number }`

**Output**:
```json
{
  "pagination": {
    "total": 248,
    "page": 2,
    "limit": 20,
    "totalPages": 13,
    "hasNext": true,
    "hasPrev": true
  }
}
```

Used by all paginated service methods to produce the `meta` block.

---

## New Files (Implementation)

| File | Purpose |
|---|---|
| `src/common/utils/paginate.util.ts` | `buildMeta()` helper |
| `src/modules/profile/constants/app-languages.constant.ts` | Static app locale list |
| Migration file (auto-generated) | Creates `education_levels` table |

## Modified Files (Implementation)

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `EducationLevel` model |
| `prisma/seed.ts` | Add 7 `EducationLevel` upsert rows |
| `src/common/dto/pagination.dto.ts` | Add `search` field |
| `src/modules/profile/controllers/reference.controller.ts` | Add 3 new GET endpoints; add query params to 2 existing |
| `src/modules/profile/services/reference.service.ts` | Implement languages, education-levels, app-languages; add pagination to fields-of-study, skills-taxonomy |
| `src/modules/profile/controllers/skills.controller.ts` | Add `ParseUUIDPipe`; add pagination to GET; remove redundant local `@UsePipes()` |
| `src/modules/profile/controllers/languages.controller.ts` | Add `ParseUUIDPipe`; add pagination to GET |
| `src/modules/profile/controllers/documents.controller.ts` | Add pagination to GET list |
| `src/modules/profile/controllers/educations.controller.ts` | Add pagination to GET list |
| `src/modules/profile/services/skills.service.ts` | `findAll()` accepts pagination params |
| `src/modules/profile/services/languages.service.ts` | `findAll()` accepts pagination params |
| `src/modules/profile/services/documents.service.ts` | `getDocuments()` accepts pagination params |
| `src/modules/profile/services/educations.service.ts` | `findAll()` accepts pagination params |
| `src/modules/profile/dto/update-profile.dto.ts` | Add `@IsIn([...])` on `educationLevel` field |
| `src/modules/users/users.service.ts` | Nest pagination fields under `pagination` key in return value |
| `src/modules/auth/auth.controller.ts` | Add `@Throttle({ default: { limit: 5, ttl: 60000 } })` to `login` and `register` |
| `Levora_API.postman_collection.json` | Add new endpoints; add pagination examples |
| `Levora_API_localhost.postman_collection.json` | Same as above |
| `tests/levora-smoke-tests.json` | Add assertions for 5 new endpoints; update existing paginated endpoint checks |
