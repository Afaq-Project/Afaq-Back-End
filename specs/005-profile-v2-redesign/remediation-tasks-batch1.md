# Remediation Plan: Feature 005 (Profile-v2-redesign) - Batch 1

## Goal and Non-Goals
**Goal**: Address the 5 core bugs reported by the Testing and Security Agents by fixing the root causes across exception handling, validation mappings, Prisma error filters, and rate limit configurations.
**Non-Goal**: Refactor the entire error handling architecture or add new rate-limiting modules. Fixes will utilize the existing `class-validator`, `AllExceptionsFilter`, and `Throttler` implementations.

## Phase Plan & Ordered Tasks

### Phase 1: Exception Error Codes Mapping (Bug 1)
1. **Update `ErrorCode` Enum** (`src/common/dto/response.dto.ts`)
   - Add the missing error codes: `UNKNOWN_FIELD`, `BIO_TOO_LONG`, `CITY_COUNTRY_MISMATCH`, `VALIDATION_ERROR`, and `INVALID_MARITAL_STATUS`.
2. **Update Global Constraint Mapping** (`src/main.ts`)
   - In `constraintToErrorCode`, add `whitelistValidation: ErrorCode.UNKNOWN_FIELD` to fix undeclared field errors.
   - Add `isUuid: ErrorCode.VALIDATION_ERROR` to fix invalid UUID format errors.
3. **Context-Aware Pagination Validation** (`src/common/dto/pagination.dto.ts` & `src/main.ts`)
   - Change `@Min(1)` to `@Min(1, { context: { errorCode: 'VALIDATION_ERROR' } })`.
   - Update `exceptionFactory` in `src/main.ts` to prioritize `err.contexts?.[constraintKey]?.errorCode` before falling back to `constraintToErrorCode`.

### Phase 2: Service-Level Exception Formatting (Bug 1 cont.)
1. **Fix Bio Length Error** (`src/modules/profile/services/profile.service.ts`)
   - Line 75: Change `new BadRequestException('Bio exceeds maximum length...')` to `new BadRequestException({ message: 'Bio exceeds maximum length of 500', code: 'BIO_TOO_LONG' })`.
2. **Fix Geography Error** (`src/modules/profile/services/profile.service.ts`)
   - Line 103: Change `new BadRequestException('CITY_COUNTRY_MISMATCH')` to `new BadRequestException({ message: 'City and country do not match', code: 'CITY_COUNTRY_MISMATCH' })`.

### Phase 3: Prisma Foreign Key Constraint Handling (Bug 2)
1. **Handle Prisma `P2003`** (`src/common/filters/all-exceptions.filter.ts`)
   - Add an `if` block catching `exception.code === 'P2003'`.
   - Extract the field name from `exception.meta.field_name` (e.g., `maritalStatusId_fkey`).
   - Clean the string and format it dynamically as `INVALID_${FIELD}` (e.g., `INVALID_MARITAL_STATUS`).
   - Set the HTTP status to `400 Bad Request` and assign the custom code.

### Phase 4: Rate Limiting and Controller Fixes (Bugs 3, 4, 5)
1. **Fix Auth Rate Limiting** (`src/modules/auth/auth.controller.ts`)
   - Update the `@Throttle` decorators on `login` and `register` endpoints from `limit: 10` to `limit: 5`.
2. **Allow Unknown Query Parameters in Reference API** (`src/modules/profile/controllers/reference.controller.ts`)
   - Decorate the `ReferenceController` class with `@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))` to override the global setting for GET reference endpoints.
3. **Fix Empty Enum Messages** (`src/modules/profile/dto/update-profile.dto.ts` & `src/modules/users/dto/user-query.dto.ts`)
   - Replace `@IsEnum(['MALE', 'FEMALE'])` and `@IsEnum(['USER', 'ADMIN'])` with `@IsIn([...])`, OR define explicit TypeScript enums and pass the enum objects to `@IsEnum()`. This allows `class-validator` to correctly format the list of valid options.

## Risks and Mitigations
- **Risk**: Modifying the global exception factory or `constraintToErrorCode` could change error codes for unrelated endpoints.
- **Mitigation**: Using `context` for `@Min` ensures only pagination parameters are affected without globally converting all `min` failures to `VALIDATION_ERROR`.
- **Risk**: Dynamic code generation for `P2003` might produce unexpected codes for complex foreign keys.
- **Mitigation**: Clean the Prisma field name thoroughly (stripping `_fkey` and standardizing to uppercase snake case).

## Verification Checklist
- [ ] Extra field in DTO returns `400 UNKNOWN_FIELD`.
- [ ] Bio exceeding limits returns `400 BIO_TOO_LONG`.
- [ ] Invalid city/country returns `400 CITY_COUNTRY_MISMATCH`.
- [ ] Invalid UUID string format returns `400 VALIDATION_ERROR`.
- [ ] `page=0` in reference endpoint returns `400 VALIDATION_ERROR`.
- [ ] Passing a valid but non-existent UUID for a relational ID returns `400 INVALID_...`.
- [ ] 6th login request within 60s returns `429 Too Many Requests`.
- [ ] GET `/reference/languages?fake_param=1` returns `200 OK`.
- [ ] Invalid enum value includes options (e.g., 'MALE, FEMALE') in the error message.

## Critical Files for Implementation Focus
1. `src/main.ts`
2. `src/common/filters/all-exceptions.filter.ts`
3. `src/modules/profile/services/profile.service.ts`
4. `src/modules/auth/auth.controller.ts`
5. `src/common/dto/response.dto.ts`
