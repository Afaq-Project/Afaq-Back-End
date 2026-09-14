# Remediation Task List

## Task 1: Fix Mass Assignment Risk & GPA Data Loss
- **Description**: In `src/modules/profile/services/profile.service.ts` (`updateProfile`), remove `data as any`. Properly parse `gpaValue` if it is a string (`parseFloat(gpaValue)`). Pick fields explicitly instead of using `...profileData`.

## Task 2: Fix Arbitrary GPA Overwrites
- **Description**: In `src/modules/profile/services/profile.service.ts` (`updateProfile`), change the education lookup `orderBy: { createdAt: 'asc' }` to `orderBy: { createdAt: 'desc' }` to update the newest record instead of the oldest.

## Task 3: Fix Missing Response Mapping
- **Description**: In `src/modules/profile/services/profile.service.ts` (`getProfileWithDetails`), ensure the `userFieldsOfStudy` is mapped appropriately if it is missing, or update `ProfileWithRelations` DTO mapper.

## Task 4: Fix Broken Migration Scripts
- **Description**: Delete `scripts/migrate-fields-of-study.ts` and `scripts/rollback-fields-of-study.ts` using `git rm`.
