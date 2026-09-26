# Architectural Decisions Log

This document records all finalized architectural and design decisions for the v1.3 → v2.0 migration.
It serves as the source of truth for implementation. Decisions are listed by module.

> **Status: Requirements Phase — No code changes have been applied yet.**

---

## Module 1: Authentication & OAuth

### DEC-AUTH-01 — Users and UserProfiles are fully independent entities
**Decision:** `Users` and `UserProfiles` are separate entities. The only structural link between them is `userId` (the account ID as a foreign key). No data field is ever shared or copied between them.
- `Users` holds account-level data: email, password, OAuth identities, roles, subscription, payments.
- `UserProfiles` holds the person's real-world identity: name, date of birth, education, etc.
- The name in `Users` originates from OAuth or signup form and may be a pseudonym.
- The name in `UserProfiles` is entered by the user later and may be completely different.
- No automatic sync between the two tables — not even names or email.

### DEC-AUTH-02 — All UserProfiles fields are nullable at the database level
**Decision:** Every field in `UserProfiles` is nullable (`?`) at the database level. No DB-level `NOT NULL` constraint is applied to any profile field.
- Validation of which fields are "mandatory for matching" is enforced at the application/DTO layer, not the database layer.
- This allows Auth flows (email or OAuth) to create a fully empty profile record at signup without any constraint errors.
- It also supports the frontend's auto-save pattern (partial saves at any time).

### DEC-AUTH-03 — Profile creation at signup is strictly empty
**Decision:** When a new user is created (via email or OAuth), the system creates one `UserProfiles` record containing only: `{ isMatchable: false, completionPct: 0 }`. No other fields are populated.
- No data from the OAuth provider (name, photo, email) is written to `UserProfiles`.
- No data from the signup form is written to `UserProfiles`.
- The user fills in their profile independently, at their own pace, through dedicated profile endpoints.

### DEC-AUTH-04 — Auth endpoints return tokens only
**Decision:** Auth endpoints (`/auth/login`, `/auth/oauth/callback`, etc.) return only the JWT pair: `{ accessToken, refreshToken }`. No user object, no profile snapshot, no nested data is returned.
- The frontend uses the JWT's `sub` (userId) to call `GET /profile/me` to retrieve profile data.
- The `UserResponseDto` and `generateAuthResponse` will be stripped of the `userProfile` nested object.

### DEC-AUTH-05 — JWT payload is profile-free
**Decision:** The JWT payload contains only stable account-level fields: `{ sub: userId, email, role }`. No profile fields (name, completion percentage, etc.) are included.
- This is already the case in the current implementation. No change required.

---

## Module 2: Profile

### Decision 01 (Legacy) — isDraft / publishedAt replaced by isMatchable
**Decision:** The concepts of `isDraft` and `publishedAt` are removed. They implied a public-facing publish workflow that does not exist in this platform.
- Replaced by `isMatchable Boolean @default(false)`.
- `isMatchable` indicates the profile is ready to enter the matching engine.
- Once set to `true`, it is not automatically reverted — even if `completionPct` later drops.
- The user (or admin) can manually toggle it off via the matchable endpoint.

### DEC-PROF-02 — completionPct is recalculated synchronously after every mutation
**Decision:** Every sub-service (educations, languages, tests, special statuses, preferences, documents) calls `ProfileService.recalculate(userId)` synchronously after any create, update, or delete mutation. No dedicated recalculation endpoint is exposed.
- Applies to direct profile field updates (`PATCH /profile`) as well, triggered from `ProfileService.updateProfile()` itself.
- The recalculation is lightweight (single DB read + update) and synchronous.

### DEC-PROF-03 — matchingVersion increments unconditionally on every recalculate() call
**Decision:** `matchingVersion` is incremented inside `recalculate()` unconditionally, on every call — regardless of whether `completionPct` changed.
- **Rationale:** A change to a target major (Engineering → Medicine) does not change the completion percentage, but it fundamentally changes matching behavior. The version must always reflect that the profile changed.
- This rule applies to all mutation paths: direct profile updates, sub-service mutations, and any future mutation points.

### DEC-PROF-04 — Completion percentage weight table
**Decision:** The completion percentage is calculated using the following weight distribution (total = 100%). Fields outside this table are excluded from the calculation.

| Group | Weight | Components |
|:---|:---:|:---|
| Personal Identity | 18% | `firstName` (3), `lastName` (3), `dateOfBirth` (5), `gender` (4), `maritalStatusId` (3) |
| Location & Origin | 15% | `countryOfResidenceId` (8), `nationalityId` (7) |
| Education | 35% | `educationLevelId` (10), at least one `UserEducations` record (25) |
| Languages | 10% | At least one `UserLanguages` record |
| Standardized Tests | 7% | At least one `UserTestResults` record |
| Preferences & Statuses | 15% | `UserTargetMajors` (5), `UserTargetDegrees` (4), `UserTargetInstitutions` (3), `UserSpecialStatuses` (3) |

- **Excluded from calculation:** `bio`, `phone`, `email`, `profilePhotoUrl`, `currentCityId`, all `Documents`, and all records beyond the first in any relationship (only the *existence* of at least one record counts — additional records do not increase the percentage).

### DEC-PROF-05 — Completion weights and limits are read from SystemSettings, with hardcoded fallbacks
**Decision:** The weights in Decision 04 and all record limits (max educations, max languages, etc.) are read at runtime from the `SystemSettings` table.
- If a key is missing (e.g., on a fresh environment), the code falls back to the hardcoded defaults shown in Decision 04.
- A fresh environment must never fail to start or fail to calculate `completionPct` due to an empty settings table.

### DEC-PROF-06 — Profile is divided into 8 logical sections
**Decision:** The profile data is organized into 8 sections, each with its own dedicated CRUD endpoints.
1. **Personal Info** — names, DOB, gender, marital status, phone, bio, photo, email
2. **Location & Origin** — country of residence, nationality, current city
3. **Education** — current education level + education history records
4. **Languages** — language records with proficiency and native flag
5. **Standardized Tests** — test results
6. **Special Statuses** — special status records
7. **Target Preferences** — target degrees, majors, institutions
8. **Documents** — uploaded files

- `GET /profile/me` returns all 8 sections in a single response.
- Each section has its own dedicated mutation endpoints.

### DEC-PROF-07 — Record limits are enforced from SystemSettings
**Decision:** Maximum record limits for educations, languages, tests, target majors, target degrees, and target institutions are all read from `SystemSettings` — not hardcoded in service logic.
- Falls back to sensible hardcoded defaults if keys are missing (Decision 05).

### DEC-PROF-08 — Skills module is fully removed
**Decision:** The Skills concept is removed entirely from the system.
- `SkillsMaster` and `UserSkills` tables are dropped from the schema.
- `SkillsService`, `SkillsController`, `SkillsGuard`, and all related DTOs are deleted from the codebase.
- No replacement or equivalent is introduced.

### DEC-PROF-09 — Document deletion is storage-first
**Decision:** When a document is deleted, the order of operations is:
1. Delete the file from the storage provider.
2. On success → delete the DB record.
3. On failure → keep the DB record intact; return an error to the user so they can retry.

- **Rationale:** If the DB record is deleted first and storage deletion fails, the file becomes an orphan with no reference and no recovery path. Storage-first ensures the file is never unreachable, at the cost of a temporary stale DB record — which is fully recoverable.
- The current implementation (DB-first) must be reversed.

### DEC-PROF-10 — Document deletion is hard-delete (no soft-delete)
**Decision:** `deletedAt` is removed from the `Documents` table. Document deletion is immediate and permanent. No soft-delete lifecycle, no delayed cleanup.

### DEC-PROF-11 — File encryption is not tracked in the database
**Decision:** The `isEncrypted` column is removed from the `Documents` table. Encryption is handled at the storage-provider level and is not a concern of the application database.

### DEC-PROF-12 — Cities is a dedicated master table, seeded manually
**Decision:** A `Cities` master table is introduced, linked to `Countries` via `countryId`.
- `UserProfiles.currentCityId` and `Institutions.cityId` are FKs to `Cities`.
- Cities are populated via a manual seed — no external API integration.
- City data does not participate in matching logic or `completionPct` calculation.

### DEC-PROF-13 — MajorCategories is a dedicated master table
**Decision:** A `MajorCategories` master table is introduced. `Majors.categoryId` is an FK to this table, replacing the previous free-text `categoryEn`/`categoryAr` fields.
- Hierarchy is flat: both general and specific majors are rows in `Majors`, distinguished only by their category.

### DEC-PROF-14 — SavedOpportunities is deferred to a future User Module
**Decision:** `SavedOpportunities` is out of scope for the Profile Module migration.
- It is architecturally a user-interaction-with-external-content concern, not a profile identity concern.
- The table remains in the Prisma schema but is relocated to a "User Module — Deferred" section for organizational clarity.
- No service or controller will be built for it in this migration.
- **FK target (finalized):** `SavedOpportunities.userId` links to `Users.id` — not `UserProfiles.userId`. A saved opportunity is an account-level action, not a profile-level one. The Prisma schema must be updated to reflect this when the schema is applied.

### DEC-PROF-15 — Notifications links to Users, not UserProfiles
**Decision:** `Notifications` is out of scope for this migration (deferred to a future User Module). No service or controller will be built yet.
- **FK target (finalized):** `Notifications.userId` links to `Users.id` — not `UserProfiles.userId`.
- **Rationale:** Notifications are account-level events. A "Welcome" notification fires the moment a user signs up, before any `UserProfiles` record is populated. A "Complete your profile" notification must be deliverable even when the profile is completely empty. Linking to `UserProfiles` would make both cases impossible.
- Both `Notifications` and `SavedOpportunities` follow the same rule: account-level concerns link to `Users.id`.
- In `complete-schema.md`, the `Notifications` model is placed in Section 13 (User Module — Deferred) alongside `SavedOpportunities`.

### DEC-PROF-16 — All /reference/* endpoints are public
**Decision:** All endpoints under `/reference/*` are public — no JWT authentication is required.
- They serve static master/reference data only (countries, majors, languages, education levels, etc.).
- This is consistent with the `@Public()` decorator already applied to the existing reference endpoints.

---

## Cross-Cutting Decisions

### DEC-CROSS-01 — Phase boundary: Requirements before implementation
**Decision:** All architectural decisions must be finalized across all modules before any code changes begin. The migration action plan is a tracking document — not a work order for immediate execution.

### DEC-CROSS-02 — SystemSettings as the central configuration store
**Decision:** The `SystemSettings` table (`key TEXT @id`, `value JSON`) serves as the runtime configuration store for all tunable parameters (completion weights, record limits, matching thresholds).
- Managed by admins.
- Always has a code-level fallback. Never a point of failure.

## DEC-PROF-01: Profile Matchability (Revised 2026-09-21)
- **Status:** Final
- **Decision:** The `isMatchable` flag is exclusively system-controlled and computed as `completionPct >= matching.threshold`. Users cannot manually toggle, pause, or disable matchability.
- **Rationale:** Prevents incomplete profiles from polluting the matching engine. Eliminates ambiguity and bugs caused by manual toggle state drift. Ensures matchability is always accurate based on profile completeness.
- **Alternatives Rejected:** Manual toggle (creates edge cases), manual pause (out of scope, speculative).

## DEC-PROF-17: EducationLevel Field Naming Unification
- **Status:** Final
- **Decision:** The `EducationLevel` table's fields are unified with other reference tables: `name` → `code`, `labelEn` → `nameEn`, `labelAr` → `nameAr`.
- **Rationale:** Ensures consistency across the schema (all reference tables use `nameEn`/`nameAr` for display and `code` for stable identifiers), eliminating implementation confusion and standardizing API responses.

## DEC-PROF-18: Standardized Test Score Widening
- **Status:** Final
- **Decision:** Increased Decimal precision for standardized test scores from `Decimal(5,2)` to `Decimal(6,2)`.
- **Rationale:** Supports SAT scores which range from 400-1600. `Decimal(5,2)` has a maximum value of 999.99, which is insufficient. `Decimal(6,2)` provides a max of 9999.99, covering the SAT bounds.

### DEC-PROF-20 — Profile experiences field is free-form and excluded from completion

**Decision:** `UserProfiles.experiences` is a `String[]` column storing up to N free-text entries describing the user's prior work or volunteer experience. It is updated exclusively through `PATCH /profile/personal`.

- **Maximum entries:** read from `SystemSettings` key `profile.max_experiences` (default `10`).
- **Maximum length per entry:** 500 characters.
- **Excluded from `completionPct`**: like `bio`, `phone`, `email`, and `profilePhotoUrl`, this field does not affect completion or matchability. The weight table in DEC-PROF-04 remains unchanged.
- **Ownership:** inherent — the field lives on `UserProfiles`, no separate guard is required.
