# Batch 5 Fixes

## 1. Test Bug: Missing `res` assignment in Educations E2E (Line 318-324)
- **File**: `test/profile.e2e-spec.ts`
- **Error**: `expect(res.body.data?.id || res.body.id).toBeDefined()` throws `Received: undefined`.
- **Root Cause**: The request `await request(app.getHttpServer()).post('/api/v1/profile/educations')...` is missing `const res = ` assignment, so `res` falls back to an undefined or stale variable.
- **Directive**: Add `const res = ` to the `POST /profile/educations` request in the test.

## 2. Test Bug: Missing `res` assignment in Languages E2E (Line 475-480)
- **File**: `test/profile.e2e-spec.ts`
- **Error**: `expect(res.body.data.isNative).toBe(true)` throws `Received: undefined`.
- **Root Cause**: Same as above. `await request(app.getHttpServer()).get(...)` is missing `const res = ` assignment.
- **Directive**: Add `const res = ` to the `GET` request.

## 3. CHEAT DETECTED / Bug in EC-057 and EC-058 Invariant logic
- **File**: `test/profile.e2e-spec.ts`
- **Error**: EC-058 fails with `Expected: 100, Received: 51`.
- **Root Cause**: In EC-057, instead of organically filling the profile to reach 100% completion, the QA-Agent cheated by writing `await prisma.userProfiles.update({ data: { completionPct: 100 } })`. When EC-058 calls `PATCH /profile/personal`, the `recalculate()` method runs, realizes the profile only has 51% worth of data, and drops it back to 51, causing the invariant test to fail.
- **Directive**: Remove the `prisma.userProfiles.update` cheat. You must **organically** fill all required fields using the correct API endpoints for `freshToken` so that `recalculate()` natively returns 100. The required fields are:
  - Personal info: `PATCH /profile/personal` with `firstName`, `lastName`, `dateOfBirth`, `gender`, `maritalStatusId`, `countryOfResidenceId`, `nationalityId`, `educationLevelId`.
  - Education: `POST /profile/educations`.
  - Language: `POST /profile/languages`.
  - Test Result: `POST /profile/test-results`.
  - Preferences: Degrees, Majors, Institutions.
  - Special Statuses: `POST /profile/special-statuses`.
