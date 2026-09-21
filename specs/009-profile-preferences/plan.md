# Implementation Plan: Profile Preferences (Batch 5)

**Branch**: `009-profile-preferences` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Prerequisite**: Batch 4 Review Gate PASSED (`008-profile-tests`).

**Unblocks**: `010-profile-documents`

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Summary

Batch 5 — Special Statuses + Target Preferences. Create `SpecialStatusesService`,
`PreferencesService`, their controllers, add special statuses and preferences reference
endpoints, complete the completion engine (all 6 groups now active).

**Review Gate**: All preference and status endpoints work. Deduplication is silent.
Completion percentage is now accurate across all 6 groups (total 100%). All tests pass.

---

## Batch 5 — Parallel Execution Plan

### Track A — SpecialStatusesService + Controller (parallel with B, C)

**Agent**: `oma-editor`

**DTO** — `src/modules/profile/dto/create-special-status.dto.ts`:
- `specialStatusId: string` (UUID, required)

**Service** — `src/modules/profile/services/special-statuses.service.ts`:
- `add(userId, dto)`: Validate status exists. Check uniqueness `(userId, specialStatusId)` — silently `upsert` (no duplicate). Save. Call `recalculate`.
- `findAll(userId)`: Return user's statuses with `{ specialStatus: { nameEn, nameAr } }`.
- `remove(userId, specialStatusId)`: Hard-delete. Call `recalculate`.

**Controller** — `src/modules/profile/controllers/special-statuses.controller.ts`:
- `POST /profile/special-statuses`
- `GET /profile/special-statuses`
- `DELETE /profile/special-statuses/:specialStatusId`

---

### Track B — PreferencesService + Controller (parallel with A, C)

**Agent**: `oma-editor` (second instance)

**DTO** — `src/modules/profile/dto/add-preference.dto.ts`:
- `educationLevelId?: string` (UUID) — for target degrees
- `majorId?: string` (UUID) — for target majors
- `institutionId?: string` (UUID) — for target institutions

Three separate endpoint-specific DTOs inherit from this or are minimal single-field DTOs.

**Service** — `src/modules/profile/services/preferences.service.ts`:
- `getAll(userId)`: Returns `{ targetDegrees, targetMajors, targetInstitutions }` as a unified object.
- `addDegree(userId, educationLevelId)`: Upsert. Enforce `MAX_TARGET_DEGREES`. Call `recalculate`.
- `removeDegree(userId, educationLevelId)`: Hard-delete. Call `recalculate`.
- `addMajor(userId, majorId)`: Upsert. Enforce `MAX_TARGET_MAJORS`. Call `recalculate`.
- `removeMajor(userId, majorId)`: Hard-delete. Call `recalculate`.
- `addInstitution(userId, institutionId)`: Upsert. Enforce `MAX_TARGET_INSTITUTIONS`. Call `recalculate`.
- `removeInstitution(userId, institutionId)`: Hard-delete. Call `recalculate`.

**Controller** — `src/modules/profile/controllers/preferences.controller.ts`:
- `GET /profile/preferences`
- `POST /profile/preferences/degrees`
- `DELETE /profile/preferences/degrees/:educationLevelId`
- `POST /profile/preferences/majors`
- `DELETE /profile/preferences/majors/:majorId`
- `POST /profile/preferences/institutions`
- `DELETE /profile/preferences/institutions/:institutionId`

---

### Track C — Reference: Special Statuses (parallel with A, B)

**Agent**: `oma-quick`

Add `getSpecialStatuses()` to `reference.service.ts`:
Returns `{ id, nameEn, nameAr }`.

Add `GET /reference/special-statuses` `@Public()`.

---

### Track D — Tests

**Agent**: `oma-reviewer`

Unit: `special-statuses.service.spec.ts`, `preferences.service.spec.ts` — all
operations, deduplication, limit enforcement.

E2E: full sequence; verify deduplication (same add twice → no error, no duplicate);
verify `GET /profile/preferences` returns unified object.

Also: verify `GET /profile/me` now returns non-null `specialStatuses` and
`targetPreferences` sub-arrays after data added.

Completion accuracy test: user with all groups filled → `completionPct = 100`.

Smoke + Postman: preferences and statuses with example payloads.

---

## Batch 5 — Completion Report Template

| Method | Path | Auth | Body / Params | Response |
|:---:|:---|:---:|:---|:---|
| `POST` | `/api/v1/profile/special-statuses` | Bearer | `{specialStatusId}` | Status record |
| `GET` | `/api/v1/profile/special-statuses` | Bearer | — | `[SpecialStatus]` |
| `DELETE` | `/api/v1/profile/special-statuses/:specialStatusId` | Bearer | — | 204 |
| `GET` | `/api/v1/profile/preferences` | Bearer | — | `{targetDegrees, targetMajors, targetInstitutions}` |
| `POST` | `/api/v1/profile/preferences/degrees` | Bearer | `{educationLevelId}` | Record |
| `DELETE` | `/api/v1/profile/preferences/degrees/:educationLevelId` | Bearer | — | 204 |
| `POST` | `/api/v1/profile/preferences/majors` | Bearer | `{majorId}` | Record |
| `DELETE` | `/api/v1/profile/preferences/majors/:majorId` | Bearer | — | 204 |
| `POST` | `/api/v1/profile/preferences/institutions` | Bearer | `{institutionId}` | Record |
| `DELETE` | `/api/v1/profile/preferences/institutions/:institutionId` | Bearer | — | 204 |
| `GET` | `/api/v1/reference/special-statuses` | Public | — | `[{ id, nameEn, nameAr }]` |
