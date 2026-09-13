# Correction Plan and Task List

## FIX-001: Fix Type Mismatch in recalculateProfileStatus
- **Description:** Update `recalculateProfileStatus` to call `this.getProfile(userId)` instead of `this.getProfileWithDetails(userId)`. This resolves the type mismatch, as calculation methods expect `ProfileWithRelations` instead of a flattened object.
- **Files to Modify:** `src/modules/profile/services/profile.service.ts`
- **Acceptance Criteria:** `recalculateProfileStatus` successfully fetches the profile using `getProfile` and correctly calculates/updates the profile state without typing or runtime errors.
- **Exact Commit Message:** `fix(profile): use getProfile for recalculateProfileStatus to fix type mismatch`

## FIX-002: Add Test Coverage for recalculateProfileStatus
- **Description:** Add a unit test for `recalculateProfileStatus` that mocks `getProfile` and asserts that `prisma.userProfiles.update` is called with the correctly calculated `completionPct` and `isDraft` values.
- **Files to Modify:** `src/modules/profile/services/profile.service.spec.ts`
- **Acceptance Criteria:** A unit test for `recalculateProfileStatus` is implemented, passes successfully, and verifies the update operation parameters.
- **Exact Commit Message:** `test(profile): add unit test for recalculateProfileStatus`

## FIX-003: Remove Leftover Dead Code in DTOs
- **Description:** Remove the unused `SkillDto` and `LanguageDto` classes from the update profile DTO file.
- **Files to Modify:** `src/modules/profile/dto/update-profile.dto.ts`
- **Acceptance Criteria:** `SkillDto` and `LanguageDto` classes no longer exist in the codebase.
- **Exact Commit Message:** `refactor(profile): remove unused SkillDto and LanguageDto`
