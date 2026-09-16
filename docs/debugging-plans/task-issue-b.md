# Task: Issue B — Letter Grade GPA Crash (500 Error)

## Issue Summary

When a user submits a letter-scale GPA (`gpaScale: 'letter'`, `gpaValue: 'A'`), the service calls `parseFloat('A')` which returns `NaN`. This `NaN` is then passed to Prisma for the `gpaRaw` field (`Decimal(5,2)`), causing a `PrismaClientValidationError` — an unhandled exception that surfaces to the client as an HTTP 500 Internal Server Error.

Additionally, a secondary bug exists in the same line: if a user submits `gpaValue: 0` (a valid GPA of zero on the 4.0 scale), the falsy check `gpaValue ?` evaluates `0` as falsy and stores `null` instead of `0.0`.

Both bugs also appear in a mirror block in the "clear GPA" branch of the same function.

**Branch:** `feature/issue-b-c` (shared with Issue C — do NOT split into separate branches)

---

## Root Cause Lines

**Primary bug — `gpaRaw` assignment (main GPA branch):**
- **File:** `src/modules/profile/services/profile.service.ts`
- **Line 346:**
  ```typescript
  gpaRaw: gpaValue ? parseFloat(gpaValue.toString()) : null,
  ```
  - Bug 1: `parseFloat('A')` → `NaN` → Prisma crashes on `Decimal(5,2)`
  - Bug 2: `gpaValue ? ...` evaluates `0` as falsy → stores `null` for a valid GPA of 0.0

**Mirror bug — clear-GPA branch:**
- **Lines 369–375:** The same `gpaRaw` assignment logic appears identically in the `else if (gpaScale && gpaValue === undefined)` branch. Apply the same fix.

**Secondary observation (not a crash, data integrity):**
- **Lines 347–352:** The `gpaRawScale` ternary never matches `'letter'`, falling to `null`. This is semantically acceptable (letter scale has no numeric denominator) but is achieved by ternary omission rather than explicit intent. Making it explicit in the code improves readability.

---

## Full Crash Path

```
PATCH /profile  →  { gpaValue: "A", gpaScale: "letter" }
  │
  ├─ updateProfile() — L297 destructures gpaValue, gpaScale
  │
  ├─ validateGPARange("A", "letter") → true  ✓  [gpa-normalizer.ts — parseLetterGrade mapping]
  │
  ├─ normalizeGPA("A", "letter") → 4.0  ✓  [gpa-normalizer.ts]
  │
  ├─ userEducations.findFirst({ where: { userId } }) — finds record (if exists)
  │
  └─ prisma.userEducations.update({
       gpaRaw:       parseFloat("A") → NaN   ← CRASH ORIGIN  (L346)
       gpaRawScale:  null                    (letter falls through ternary)
       gpaNormalized4: 4.0                   ✓
     })
       └─ PrismaClientValidationError: NaN cannot be stored in Decimal(5,2)
            └─ Unhandled inside $transaction → HTTP 500
```

**Note:** `validateGPARange` and `normalizeGPA` in `gpa-normalizer.ts` are **correct and uninvolved** in the crash. No changes needed to those utilities.

---

## Fix Direction

### Fix 1 — Line 346: `gpaRaw` for letter scale

**Current (broken):**
```typescript
gpaRaw: gpaValue ? parseFloat(gpaValue.toString()) : null,
```

**Target fix direction:**
- When `gpaScale === 'letter'`: set `gpaRaw = null`. Letter grades have no numeric raw value. `gpaNormalized4` already carries the canonical 4.0-equivalent value from `normalizeGPA()`.
- When `gpaScale !== 'letter'`: use `gpaValue != null` (not `gpaValue ?`) to avoid treating a legitimate `0` as falsy.
- Do **not** store the normalized 4.0 value in `gpaRaw` for letter grades — this conflates raw and normalized semantics.

**Fix 2 — Falsy zero bug (same line 346):**
Replace the `gpaValue ?` falsy check with an explicit null/undefined check (`gpaValue != null`) so that `gpaValue = 0` is correctly stored as `0.0` rather than coerced to `null`.

### Fix 3 — Lines 369–375: Mirror block (clear-GPA branch)

Apply the exact same `gpaRaw` fix to the corresponding lines in the `else if (gpaScale && gpaValue === undefined)` branch. The mirror currently has the same `gpaValue ?` falsy bug (though in the clear-GPA branch `gpaValue` is always `undefined`, so it always resolves to `null` correctly — but the explicit fix makes the intent unambiguous and prevents future regressions).

### Fix 4 — Lines 347–352 and 370–375: `gpaRawScale` for letter case (optional, readability)

The current ternary `gpaScale === '4.0' ? 4.0 : gpaScale === 'percentage' ? 100 : null` produces `null` for `'letter'` by falling through. This is semantically correct (no numeric denominator for letter scale), but making it an explicit `else null` for letter clarifies intent to future readers.

---

## Schema Change Assessment

| Goal | Schema change needed? |
|------|----------------------|
| Fix the 500 crash | ❌ No — storing `gpaRaw = null` for letter scale is sufficient |
| Preserve the original letter string `"A"` in the DB | ✅ Optional — would require adding `gpaRawLetter VARCHAR(3)` to `UserEducations` — not required for correctness |
| Disambiguate "letter grade submitted" vs "raw not set" in DB | ⚠️ Partial — both produce `gpaRaw = null, gpaRawScale = null`. A `gpaScaleType TEXT` discriminator column would remove ambiguity — not required for this fix |

**Decision: No schema change is required for this task.**

---

## Step-by-Step Fix Checklist

1. **Open `profile.service.ts`** on branch `feature/issue-b-c`

2. **Fix `gpaRaw` on line 346 (main GPA branch):**
   - Apply the letter-scale null guard AND the falsy-zero fix together in a single expression
   - Ensure the fix sets `null` for letter scale and correctly stores `0` for numeric scales

3. **Fix `gpaRawScale` on lines 347–352 (optional readability):**
   - Add an explicit `gpaScale === 'letter' ? null : ...` arm to the ternary to document intent

4. **Fix the mirror block at lines 369–375 (clear-GPA branch):**
   - Apply the same `gpaRaw` letter-scale null guard to the mirror assignment
   - This branch sets `gpaRaw: null` anyway (since `gpaValue === undefined`), but explicit logic prevents future regression

5. **Run `pnpm lint`** — zero errors required before proceeding

6. **Run `pnpm build`** — confirm TypeScript compilation succeeds

7. **Add all 5 new test cases** (see Test Plan section below) to `profile.service.spec.ts`

8. **Run `pnpm test`** — all tests must pass, including existing ones

---

## Code Review Checklist

- [ ] Is `gpaRaw` explicitly `null` when `gpaScale === 'letter'`, NOT the normalized numeric value?
- [ ] Is the falsy-zero bug fixed (i.e., `gpaValue = 0` now stores `0.0`, not `null`)?
- [ ] Is the mirror fix applied to the clear-GPA branch (lines 369–375)?
- [ ] Does the fix leave `gpaRawScale` as `null` for letter scale (correct semantic)?
- [ ] Are `normalizeGPA` and `validateGPARange` in `gpa-normalizer.ts` **unchanged**?
- [ ] Is this fix on the combined `feature/issue-b-c` branch (not split from Issue C)?
- [ ] Do all 5 new letter-scale test cases pass?
- [ ] Do existing passing tests remain green?
- [ ] Does `pnpm build` succeed?
- [ ] Does `pnpm lint` pass with zero errors?

---

## Test Plan

Add the following test cases to `src/modules/profile/services/profile.service.spec.ts`:

| # | `gpaValue` | `gpaScale` | Expected `gpaRaw` | Expected `gpaNormalized4` | Expected behavior |
|---|-----------|-----------|-------------------|--------------------------|-------------------|
| 1 | `'A'` | `'letter'` | `null` | `4.0` | No 500 error; writes successfully |
| 2 | `'A-'` | `'letter'` | `null` | `3.7` | Correct mapping for A- |
| 3 | `'Z'` | `'letter'` | — | — | Throws `BadRequestException('Invalid GPA range...')` at `validateGPARange` |
| 4 | `'F'` | `'letter'` | `null` | `0.0` | Edge case: falsy 0 in normalized result stored correctly |
| 5 | `0` | `'4.0'` | `0.0` | `0.0` | Falsy-zero bug fix: 0 stored as 0.0, not null |

**Test setup notes:**
- Mock `prisma.userEducations.findFirst` to return a valid existing education record (Issue A provides this record in real flows, but tests should mock it).
- Mock `prisma.userEducations.update` and assert the exact payload it receives, especially `gpaRaw`.
- For test case 3 (`'Z'`), the assertion is that `update` is never called — `validateGPARange` should throw before reaching Prisma.

---

## Pre-Deploy Data Migration Checklist

> [!CAUTION]
> Run the audit query **before** deploying this fix to production. If corrupt `gpa_raw` rows are found, run the cleanup query before deploying.

```sql
-- Step 1: Audit (read-only)
SELECT id, user_id, gpa_raw, gpa_raw_scale, gpa_normalized_4
FROM user_educations
WHERE gpa_raw IS NOT NULL
  AND gpa_raw_scale IS NULL;

-- Step 2: Cleanup (only if Step 1 returns rows)
UPDATE user_educations
SET gpa_raw = NULL
WHERE gpa_raw IS NOT NULL
  AND gpa_raw_scale IS NULL;
```

- [ ] Audit query executed in production (read-only)
- [ ] Result reviewed with team lead
- [ ] Cleanup query executed if corrupt rows found
- [ ] Audit re-run confirms zero remaining corrupt rows
- [ ] Row counts before/after logged in deployment record

---

## Definition of Done

- [ ] `profile.service.ts` lines 346 and 369–375 updated with letter-scale null guard and falsy-zero fix
- [ ] All 5 test cases added to `profile.service.spec.ts` and passing
- [ ] Existing test suite passes with zero regressions (`pnpm test`)
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm build` succeeds
- [ ] Pre-deploy SQL audit script prepared and reviewed
- [ ] Code review approved
