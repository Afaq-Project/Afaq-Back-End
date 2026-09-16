# Task: Issue C — Silent GPA Partial Payload Failure

## Issue Summary

When a client sends `PATCH /profile` with `gpaValue` but **without** `gpaScale`, the request succeeds with HTTP 200 — but the database is not updated. The user receives no indication of failure. This is a data integrity bug: the user believes their GPA was submitted; it was not.

The root cause is a missing cross-field validation constraint in `UpdateProfileDto` and a missing guard in `ProfileService.updateProfile()`.

**Branch:** `feature/issue-b-c` (shared with Issue B — do NOT split into separate branches)

> [!WARNING]
> This fix introduces a **breaking API contract change**. A request that currently returns HTTP 200 will return HTTP 400 after the fix is deployed. Frontend coordination is mandatory before deployment.

---

## Root Cause

### DTO layer — `update-profile.dto.ts`

**File:** `src/modules/profile/dto/update-profile.dto.ts`

```typescript
// Lines 70–74
@IsOptional()
@IsOptional()  // ← duplicate
@ApiPropertyOptional()
@IsOptional()  // ← duplicate again (three total)
gpaValue?: number | string;   // ← no @IsNumber() or @IsString() type validator

// Lines 76–79
@ApiPropertyOptional()
@IsOptional()                  // ← no cross-field constraint
@IsString()
gpaScale?: '4.0' | 'percentage' | 'letter';
```

Both fields are independently optional. No `@ValidateIf` or custom validator links them.

**Additional DTO code quality issues found:**
- `gpaValue` has **three** stacked `@IsOptional()` decorators (lines 70, 71, 73) — idempotent at runtime but indicative of copy-paste errors.
- `currentCountry` has **two** `@IsOptional()` decorators (lines 33–35) — same issue.
- `gpaValue` has **no type validator** — `number | string` allows arrays (e.g., `[3.5]`) to bypass validation because `Number([3.5]) === 3.5` in JavaScript. This is a real bypass, not theoretical.

### Service layer — `profile.service.ts`

**File:** `src/modules/profile/services/profile.service.ts`, lines 327–379:

```typescript
if (gpaValue !== undefined && gpaScale) {
  // Branch 1: both present → updates GPA ✓
} else if (gpaScale && gpaValue === undefined) {
  // Branch 2: scale only → clears gpaRaw ✓
}
// NO else/throw → Branch 3: gpaValue present, gpaScale absent → SILENT NO-OP ✗
```

---

## Silent Failure Path (Confirmed)

```
PATCH /profile  →  { gpaValue: 3.5 }  (no gpaScale)

  1. L297 — Destructure: gpaValue = 3.5, gpaScale = undefined
  2. L315 — $transaction opens
  3. L318 — userProfiles.update() runs (non-GPA fields updated normally)
  4. L327 — gpaValue !== undefined → TRUE, but gpaScale → undefined → FALSY → condition fails
  5. L356 — gpaScale → undefined → FALSY → condition fails
  6. No else branch → transaction commits silently
  7. Old GPA in userEducations is UNTOUCHED
  8. HTTP 200 OK returned to client
  ── User believes GPA was submitted. It was not. ──
```

---

## Fix Approach Options

### Option A — `@ValidateIf` cross-field constraint (Recommended — non-breaking structurally)

Add `@ValidateIf` to `gpaScale` so that it becomes required whenever `gpaValue` is provided. Changes the DTO without renaming fields — existing clients that send both fields are unaffected.

**Trade-off:** The behavior change from silent 200 to explicit 400 is still a contract change for clients sending `gpaValue` only. Frontend coordination is still required.

### Option C — Nested `GpaDto` sub-object (Best long-term, but breaking)

Create a `GpaDto` class with `value` and `scale` fields, then use `@ValidateNested()` + `@Type(() => GpaDto)` in `UpdateProfileDto`. Enforces atomicity structurally — impossible to send one without the other. However:
- Field names change from `gpaValue`/`gpaScale` to `gpa.value`/`gpa.scale`
- This is a **structural breaking change** requiring frontend rewrites
- Not appropriate as an immediate fix

### Recommendation

**Use Option A now.** Plan Option C as a future API versioning task.

---

## Step-by-Step Fix Checklist

### Step 1 — Fix `update-profile.dto.ts`

**File:** `src/modules/profile/dto/update-profile.dto.ts`

#### 1a. Remove duplicate `@IsOptional()` decorators on `gpaValue` (lines 70–74)
- Keep exactly **one** `@IsOptional()` on `gpaValue`
- Remove the two extra `@IsOptional()` copies

#### 1b. Remove duplicate `@IsOptional()` on `currentCountry` (lines 33–35)
- Keep exactly **one** `@IsOptional()` on `currentCountry`
- Remove the duplicate

#### 1c. Add type validator to `gpaValue`
- Add a type enforcement constraint to prevent array-coercion bypass
- `gpaValue` is typed `number | string` — use `@IsNumberString()` or separate `@IsNumber()` / `@IsString()` with an appropriate union validator
- Apply it conditionally so it only fires when `gpaValue` is present: `@ValidateIf(o => o.gpaValue !== undefined)`

#### 1d. Add cross-field `@ValidateIf` constraint to `gpaScale`
- Make `gpaScale` required whenever `gpaValue` is present:
  ```
  @ValidateIf(o => o.gpaValue !== undefined)
  @IsNotEmpty()
  @IsIn(['4.0', 'percentage', 'letter'])
  gpaScale?: '4.0' | 'percentage' | 'letter';
  ```
- This makes the DTO reject any request containing `gpaValue` without `gpaScale` with a descriptive 400 error.

#### 1e. Verify DTO
- Confirm that sending `{ gpaValue: 3.5 }` (no `gpaScale`) is rejected at the DTO layer with a 400.
- Confirm that sending `{ gpaValue: 3.5, gpaScale: '4.0' }` is accepted.
- Confirm that sending neither field is accepted (profile update without GPA change).

### Step 2 — Add service-level guard to `profile.service.ts` (defense-in-depth)

**File:** `src/modules/profile/services/profile.service.ts`
**Location:** Before line 327 (before the `if (gpaValue !== undefined && gpaScale)` block)

- Add an explicit guard that throws `BadRequestException` if `gpaValue` is present without `gpaScale`
- This guards against programmatic calls that bypass DTO validation (internal services, tests, future API clients)
- The guard should be concise and placed at the top of the GPA conditional block

> [!NOTE]
> The DTO-layer fix (Step 1) handles the HTTP request path. The service-layer guard (Step 2) is defense-in-depth for programmatic calls. Both are required.

### Step 3 — Coordinate with Issue B

Since this fix edits `profile.service.ts` in the same `if/else if` block as Issue B (L327–L379), ensure both fixes are applied on the same `feature/issue-b-c` branch. The service-layer guard from Step 2 should be placed **before** the existing `if/else if` block so it doesn't interfere with Issue B's `gpaRaw` fix inside Branch 1.

### Step 4 — Run linter and build

- `pnpm lint` — zero errors required
- `pnpm build` — must succeed

### Step 5 — Add test case (see Test Plan below)

### Step 6 — Run full test suite

- `pnpm test` — all tests (existing + new) must pass

---

## Code Review Checklist

- [ ] Is `@ValidateIf(o => o.gpaValue !== undefined)` correctly applied to `gpaScale` in the DTO?
- [ ] Are all **three** duplicate `@IsOptional()` on `gpaValue` reduced to exactly **one**?
- [ ] Are the **two** duplicate `@IsOptional()` on `currentCountry` reduced to exactly **one**?
- [ ] Does `gpaValue` now have a type validator (`@IsNumberString()` or equivalent)?
- [ ] Is the service-level guard placed **before** (not inside) the `if/else if` GPA block?
- [ ] Does the service guard throw `BadRequestException` with a clear message?
- [ ] Is the DTO `@ValidateIf` condition bidirectional? (i.e., `gpaValue` required when `gpaScale` present, and `gpaScale` required when `gpaValue` present)
- [ ] Is this fix on the combined `feature/issue-b-c` branch?
- [ ] Does `pnpm lint` pass with zero errors?
- [ ] Does `pnpm build` succeed?
- [ ] Does the new test case pass?
- [ ] Do all existing tests remain green?

---

## Frontend Coordination Requirement

> [!IMPORTANT]
> **Action required before deployment.** Coordinate the following with the frontend team:

| Item | Detail |
|------|--------|
| **Current behavior** | `PATCH /profile` with `{ gpaValue: 3.5 }` (no `gpaScale`) → HTTP 200, silent no-op |
| **Behavior after fix** | Same request → HTTP 400 Bad Request with validation error |
| **Affected flows** | Any GPA submission flow that sends `gpaValue` independently |
| **Required frontend change** | Always send `gpaScale` together with `gpaValue` in the same request body |
| **Deployment strategy** | Backend fix should not deploy until frontend is updated, OR use a feature flag to gate enforcement |

- [ ] Frontend team notified of the contract change
- [ ] Frontend updated to always send `gpaScale` with `gpaValue`
- [ ] Deployment timing confirmed with frontend team
- [ ] API documentation / Postman collection updated

---

## Test Plan

Add the following test case to `src/modules/profile/services/profile.service.spec.ts`:

| # | Scenario | Expected outcome |
|---|----------|-----------------|
| 1 | `updateProfile()` called with `{ gpaValue: 3.5 }` (no `gpaScale`) | Throws `BadRequestException('gpaScale is required when gpaValue is provided')` — does NOT silently no-op |

**Additional test to verify existing coverage still holds:**

| # | Scenario | Expected outcome |
|---|----------|-----------------|
| 2 | `updateProfile()` called with `{ gpaScale: '4.0' }` (no `gpaValue`) | Still works — clears `gpaRaw` as before (existing test at L197 covers this; verify it still passes) |
| 3 | `updateProfile()` called with neither `gpaValue` nor `gpaScale` | Still works — profile updated without touching GPA fields |

---

## Definition of Done

- [ ] `update-profile.dto.ts` updated:
  - `gpaValue` has exactly one `@IsOptional()` and a type validator
  - `gpaScale` has `@ValidateIf` enforcing it is required when `gpaValue` is present
  - `currentCountry` duplicate `@IsOptional()` removed
- [ ] `profile.service.ts` has service-level guard before the GPA `if/else if` block
- [ ] New test case added and passing
- [ ] All existing tests pass (`pnpm test`)
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm build` succeeds
- [ ] Frontend team notified and deployment coordinated
- [ ] API documentation updated
- [ ] Code review approved
