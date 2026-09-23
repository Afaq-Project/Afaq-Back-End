# Batch 1 Implementation Review

**Status:** ❌ **NOT READY FOR QA**

I have reviewed the implementation tasks for Batch 1 (Tracks A through F, tasks T001 to T026) based on `specs/005-profile-v2-redesign/tasks.md`. While the foundation has been built and many tasks are complete, there are several discrepancies with the specification that need to be addressed before proceeding to QA.

## ✅ Completed Tasks (No Issues)
* **Track A (T001-T007):** Schema migration, Prisma client generation, reference data loader script (`scripts/load-reference-data.ts`), and database seeds (`prisma/seed.ts`) are fully implemented.
* **Track B (T008-T011):** Auth precision changes completed. `UserProfileDto` removed, `fullName` logic cleaned up from `oauth-processor.service.ts`, `users.service.ts`, and `users.repository.ts`.
* **Track C (T012-T018):** Skills module (controller, service, DTOs, guards, module registration) has been fully removed.
* **Track D (T019-T021):** `SystemSettingsService` and its keys are successfully implemented and registered.
* **Track E (T024):** `profile.controller.ts` is correctly mapped to `GET /profile/me` and `PATCH /profile/personal`, and the publish endpoint has been removed.

---

## ❌ Discrepancies & Missing Implementation

### 1. `UpdateProfileDto` (T022)
The DTO implementation deviates from the spec in several field validations:
* **`firstName` & `lastName`**: Implemented as `@MaxLength(100)`, but the spec requires `max 255`.
* **`dateOfBirth`**: Implemented using `@Type(() => Date)` and `@IsDate()`, but the spec explicitly requires an ISO date string format.
* **`gender`**: Implemented as an array of 4 options (`['male', 'female', 'other', 'prefer_not_to_say']`) using `@IsString()`, but the spec strictly requires `enum: 'MALE' | 'FEMALE'` and `@IsEnum()`.
* **`phone`**: Implemented as `@MaxLength(50)`, but the spec requires `max 30`.
* **`profilePhotoUrl`**: Missing `@IsUrl()` validation (currently just uses `@IsString()`).

### 2. `ProfileService` Rewrite (T023)
* **JSDoc Comments Missing**: The spec strictly mandates JSDoc comments explaining purpose, parameters, return values, and side effects for all complex public methods (`recalculate`, `updateProfile`), but none were added.
* **`computeCompletionPct` Function**: The spec requires a private pure function `computeCompletionPct(profile, weights)` that validates the configured completion group weights total exactly 100. This function does not exist; the logic is currently embedded directly within `recalculate()` and fails to validate the 100% total invariant.
* **City-Country Mismatch Error**: The spec requires explicitly throwing `400 CITY_COUNTRY_MISMATCH` if an explicitly mismatched city is sent. The current implementation throws a generic `BadRequestException('City does not belong to the selected country of residence')`.

### 3. Reference Endpoints (T025 & T026)
* **Pagination missing**: The spec requires `getCountries` and `getCities` to support `PaginationDto`, return a `{ data, meta }` envelope, and support `search` filtering (and `region` for countries).
* **Current Implementation**: 
  * `getCountries` accepts no parameters and returns an array.
  * `getCities` only accepts an optional `countryId` string and returns an array.

---

## Next Steps
Please fix the above discrepancies in `update-profile.dto.ts`, `profile.service.ts`, `reference.service.ts`, and `reference.controller.ts` to fully comply with the spec before submitting Batch 1 for QA.
