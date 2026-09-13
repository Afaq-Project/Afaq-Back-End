# Phase 3 — Profile Refactoring Task List

> **Coordination Note:** This document represents the executable task breakdown for the Profile Module Refactoring. All tasks strictly adhere to the single local commit rule (no pushes). Minor sprint dependency resolutions (e.g. Unit tests depending on Sprint 4 tasks being moved to Sprint 4) have been autonomously applied.

---

## Sprint 1: Cleanup & Bug Fixes

### TASK-001: Remove Stale Postman Collection
- **Linked Issue(s):** D5
- **Description:** Deletes the outdated, conflicting Postman collection located in `docs/postman/` to prevent developer confusion. The CI pipeline relies on `tests/levora-smoke-tests.json`, which remains untouched.
- **Files to Delete:** `docs/postman/Levora_API.postman_collection.json`
- **Acceptance Criteria:**
  - File is deleted.
  - Project builds successfully.
- **Dependencies:** None
- **Estimated Complexity:** S
- **Sprint Assignment:** Sprint 1
- **Exact Commit Message:** `chore(docs): remove stale Postman collection`

### TASK-002: Remove Dead Code Block in updateProfile
- **Linked Issue(s):** NEW-004 (D3)
- **Description:** Removes the unreachable `educationLevel` logic at L284–290 in `profile.service.ts` that triggers false positive complexity metrics.
- **Files to Modify:** `src/modules/profile/services/profile.service.ts`
- **Acceptance Criteria:**
  - Lines 284–290 are removed.
  - Existing unit tests for `updateProfile` continue to pass.
- **Dependencies:** None
- **Estimated Complexity:** S
- **Sprint Assignment:** Sprint 1
- **Exact Commit Message:** `refactor(profile): remove dead code block in updateProfile`

### TASK-003: Enforce Deterministic Ordering for GPA Updates
- **Linked Issue(s):** MED-002, NEW-005 (D4)
- **Description:** Fixes the non-deterministic `educations[0]` bug in both GPA branches by enforcing explicit `findFirst` with `orderBy: { createdAt: 'asc' }`.
- **Files to Modify:** 
  - `src/modules/profile/services/profile.service.ts`
  - `src/modules/profile/services/profile.service.spec.ts`
- **Acceptance Criteria:**
  - `findFirst` is used with `orderBy: { createdAt: 'asc' }` to get the education record.
  - Both GPA update branches share this logic.
  - Unit tests reflect the deterministic ordering.
- **Dependencies:** TASK-002
- **Estimated Complexity:** S
- **Sprint Assignment:** Sprint 1
- **Exact Commit Message:** `fix(profile): enforce deterministic ordering for GPA updates`

---

## Sprint 2: Reference Data Initialization

### TASK-004: Seed Arabic and English to Languages Master
- **Linked Issue(s):** CRIT-001
- **Description:** Seeds the `LanguagesMaster` table with `Arabic` and `English` to support the language selection UI, matching the architectural pattern used for skills.
- **Files to Modify:** `prisma/seed.ts`
- **Acceptance Criteria:**
  - Seed file contains `upsert` logic for Arabic and English only.
  - `npx prisma db seed` executes successfully without errors.
- **Dependencies:** None
- **Estimated Complexity:** S
- **Sprint Assignment:** Sprint 2
- **Exact Commit Message:** `feat(seed): add Arabic and English to languages_master`

### TASK-005: Add GET /reference/languages Endpoint
- **Linked Issue(s):** HIGH-001
- **Description:** Exposes a public endpoint to fetch the list of available languages from `LanguagesMaster`. Unlike other reference endpoints, this does NOT use an `isActive` filter.
- **Files to Modify:** 
  - `src/modules/profile/controllers/reference.controller.ts`
  - `src/modules/profile/services/reference.service.ts`
- **Acceptance Criteria:**
  - `@Get('languages')` exists and is marked `@Public()`.
  - Response contains standard envelope `{ statusCode, message, data, timestamp }`.
  - Service fetches all languages without `isActive: true` where clause.
- **Dependencies:** TASK-004
- **Estimated Complexity:** S
- **Sprint Assignment:** Sprint 2
- **Exact Commit Message:** `feat(reference): add GET /reference/languages endpoint`

---

## Sprint 3: Dedicated Profile Sub-Resources

### TASK-006: Add Dedicated Skills and Languages Endpoints
- **Linked Issue(s):** HIGH-002, HIGH-003
- **Description:** Implements RESTful CRUD endpoints for user skills and languages. Enforces limits, catches P2002 duplicates, validates `isActive: true` for skills. Also extracts `recalculateProfileStatus(userId)` wrapper in `profile.service.ts` to update DB completion percentage.
- **Files to Create/Modify:** 
  - controllers, services, dtos for `skills` and `languages`.
  - `src/modules/profile/profile.module.ts`
  - `src/modules/profile/services/profile.service.ts` (extract wrapper)
- **Acceptance Criteria:**
  - All endpoints guarded by `@UseGuards(JwtAuthGuard)`.
  - Adding an inactive skill returns 400. Exceeding max limits returns 400.
  - Adding a duplicate skill/language returns 409 (P2002 caught).
  - Profile completion percentage wrapper updates the DB on every mutation.
- **Dependencies:** TASK-005
- **Estimated Complexity:** M
- **Sprint Assignment:** Sprint 3
- **Exact Commit Message:** `feat(profile): add dedicated skills and languages endpoints`

---

## Sprint 4: The Database Refactor & Component Testing

### TASK-007: Add UserFieldsOfStudy Join Table and Migrate Data (Phase 1)
- **Linked Issue(s):** D7
- **Description:** Adds the `UserFieldsOfStudy` model, creates endpoints to manage fields of study, and provides a TypeScript script to migrate data from the old string array to the new join table, logging auto-created master records.
- **Files to Create/Modify:** 
  - `scripts/migrate-fields-of-study.ts` & `scripts/rollback-fields-of-study.ts`
  - controllers, services, dtos for `fields-of-study`.
  - `prisma/schema.prisma`, `src/modules/profile/profile.module.ts`
- **Acceptance Criteria:**
  - Schema includes `UserFieldsOfStudy` (and keeps `String[]` on `UserProfiles`).
  - Migration script logs auto-creations and handles duplicate values safely.
  - Fields CRUD endpoints enforce max-5 limits, `isActive` validation, P2002, and completion recalc.
- **Dependencies:** TASK-006
- **Estimated Complexity:** L
- **Sprint Assignment:** Sprint 4
- **Exact Commit Message:** `feat(schema): add UserFieldsOfStudy model and migrate data`
- **Rollback Plan:**
  > **Reversible Phase:** Revert the git commit and run Prisma migration down. If data was written to the join table, `scripts/rollback-fields-of-study.ts` can synchronize it back to the string arrays.

### TASK-008: Hard Remove Relational Arrays from DTO and Drop Old Column (Phase 2)
- **Linked Issue(s):** D1, D7
- **Description:** Eliminates `skills`, `languages`, and `fieldOfStudy` from `UpdateProfileDto` and drops the `fieldOfStudy String[]` column from the database.
- **Files to Modify:** 
  - `prisma/schema.prisma`
  - `src/modules/profile/dto/update-profile.dto.ts`
  - `src/modules/profile/services/profile.service.ts`
- **Acceptance Criteria:**
  - DTO no longer accepts the relational arrays (`forbidNonWhitelisted` rejects them).
  - `updateProfile` calculates relations directly from DB.
  - `fieldOfStudy` column is completely removed from schema.
- **Dependencies:** TASK-007
- **Estimated Complexity:** M
- **Sprint Assignment:** Sprint 4
- **Exact Commit Message:** `refactor(profile): hard remove arrays from DTO and drop old column`
- **Rollback Plan:**
  > **WARNING: IRREVERSIBLE ACTION:** Dropping a column destroys the data. If a rollback is needed after deployment, you MUST run `scripts/rollback-fields-of-study.ts` FIRST before running the Prisma rollback migration.

### TASK-010: Unit Tests for New Sub-Resource Services
- **Description:** Write comprehensive unit tests for `SkillsService`, `LanguagesService`, and `FieldsOfStudyService`.
- **Files to Create:**
  - `src/modules/profile/services/skills.service.spec.ts`
  - `src/modules/profile/services/languages.service.spec.ts`
  - `src/modules/profile/services/fields-of-study.service.spec.ts`
- **Acceptance Criteria:** 
  - Happy path tests (add/update/delete) present.
  - Error tests: 409 (P2002), 400 (inactive/limits), 404.
  - Verify `calculateCompletionPct()` wrapper is called (mocked).
  - Coverage ≥ 90% for the new services.
- **Dependencies:** TASK-006, TASK-007
- **Estimated Complexity:** L
- **Sprint Assignment:** Sprint 4 *(Autonomously moved from Sprint 3 to resolve TASK-007 dependency)*
- **Exact Commit Message:** `test(profile): add unit tests for skills, languages, and fields-of-study services`

### TASK-011: Integration Tests for Profile Sub-Resources
- **Description:** Write integration tests exercising the full HTTP cycle using the real test database for the new endpoints.
- **Files to Create:**
  - `test/profile-skills.integration-spec.ts`
  - `test/profile-languages.integration-spec.ts`
  - `test/profile-fields-of-study.integration-spec.ts`
- **Acceptance Criteria:** 
  - Auth guard rejects unauthenticated requests (401).
  - Successful CRUD flows for each sub-resource.
  - `forbidNonWhitelisted` rejects legacy fields with 400.
  - `completionPct` updates correctly.
- **Dependencies:** TASK-006, TASK-007
- **Estimated Complexity:** L
- **Sprint Assignment:** Sprint 4
- **Exact Commit Message:** `test(profile): add integration tests for new sub-resource endpoints`

---

## Sprint 5: E2E Verification & Documentation

### TASK-012: E2E Tests for Full Profile Refactoring Flow
- **Description:** Update `test/profile.e2e-spec.ts` and add new E2E test scenarios covering the complete user journey.
- **Files to Modify/Create:**
  - `test/profile.e2e-spec.ts`
- **Acceptance Criteria:** 
  - Covers onboarding: register → add skills → add languages → add fields → verify completionPct.
  - Legacy PATCH payload rejection (400) works.
  - Migration compatibility: existing users with old `String[]` data handled correctly.
  - Suite passes with `npm run test:e2e`.
- **Dependencies:** TASK-008, TASK-011
- **Estimated Complexity:** L
- **Sprint Assignment:** Sprint 5
- **Exact Commit Message:** `test(profile): add comprehensive E2E tests for profile refactoring`

### TASK-009: Sync Postman Collection with Refactored API
- **Linked Issue(s):** Postman Docs
- **Description:** Update the root `Levora_API.postman_collection.json` to reflect all refactoring changes. Must be done after all endpoints are finalized.
- **Files to Modify:** `Levora_API.postman_collection.json` (root only)
- **Acceptance Criteria:**
  - All new endpoints have working example requests.
  - No stale `skills`/`languages`/`fieldOfStudy` fields remain in the PATCH body.
  - All IDs use valid UUID format (e.g. `00000000-0000-0000-0000-000000000001`).
  - `GET /profile` mock response matches the actual flat API shape.
- **Dependencies:** TASK-001 through TASK-008
- **Estimated Complexity:** M
- **Sprint Assignment:** Sprint 5
- **Exact Commit Message:** `docs(postman): sync collection with refactored endpoints`
