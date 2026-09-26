# Batch 2: Education Section — QA Fixes

## Failure 1: Orphaned `gpaRaw` bypasses validation on Update (EC-016)
**Type**: Production Bug
**Description**: During a `PATCH` (update), if the user does NOT send `gpaRaw` in the payload but sends `gpaScale: null`, the DTO ignores `gpaScale` validators. The service then updates the DB with `gpaScale: null` while the existing `gpaRaw` remains untouched. The error returned by DTO is also not `GPA_SCALE_REQUIRED`.
**Fix Directive for Executor**:
- In `src/modules/profile/services/educations.service.ts`: During `update`, if `dto.gpaScale === null` and the existing record has `gpaRaw !== null` (and no new `gpaRaw` is provided), throw `BadRequestException('GPA_SCALE_REQUIRED')`. Similarly, if `dto.gpaRaw` is provided but `dto.gpaScale` is not (and the record has no existing scale or it's being nullified), ensure it throws `GPA_SCALE_REQUIRED`. It may be cleaner to enforce this logic in the service's `update` and `create` methods to ensure `GPA_SCALE_REQUIRED` is always thrown when a `gpaRaw` exists without a `gpaScale`.
- In `src/modules/profile/dto/create-education.dto.ts` / `update-education.dto.ts`: Ensure the DTO validation matches the exact error code requirements, but fallback to service-level validation to handle the merged state reliably.

## Failure 2: Hardcoded string messages instead of strict error codes (EC-019, EC-020, EC-021)
**Type**: Production Bug
**Description**: `ConflictException` and `NotFoundException` are thrown with human-readable sentences instead of the required strict error codes (`EDUCATION_DUPLICATE`, `MAX_EDUCATIONS_REACHED`, `EDUCATION_NOT_FOUND`).
**Fix Directive for Executor**:
- In `src/modules/profile/services/educations.service.ts`: Replace the exception string messages with the exact error codes required by the specification:
  - Change "Education record already exists" (or similar) to `'EDUCATION_DUPLICATE'`.
  - Change "Maximum of 5 educations reached" (or similar) to `'MAX_EDUCATIONS_REACHED'`.
  - Change "Education not found" (or similar) to `'EDUCATION_NOT_FOUND'`.

## Failure 3: Invalid FK errors do not match required error codes (EC-013)
**Type**: Production Bug
**Description**: The service manually checks FKs and throws `BadRequestException` with a descriptive English string rather than the exact expected error codes.
**Fix Directive for Executor**:
- In `src/modules/profile/services/educations.service.ts`: When throwing `BadRequestException` for failed FK lookups, use the exact codes required:
  - For education level: `'INVALID_EDUCATION_LEVEL'`
  - For institution: `'INVALID_INSTITUTION'`
  - For major: `'INVALID_MAJOR'`
  - For minor major: `'INVALID_MINOR_MAJOR'`
