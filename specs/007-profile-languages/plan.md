# Implementation Plan: Profile Languages (Batch 3)

**Branch**: `007-profile-languages` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)

**Prerequisite**: Batch 2 Review Gate PASSED (`006-profile-education`).

**Unblocks**: `008-profile-tests`

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Summary

Batch 3 — Languages Section. Rewrite `LanguagesService`, update DTOs, add proficiency
levels reference endpoint. Update completion engine to include languages group (10%).

**Review Gate**: Language CRUD works with structured proficiency level IDs. `isNative`
flag saves correctly. `nameEn`/`nameAr` are returned (not old `name`). Completion
reflects 10% language group. All tests pass.

---

## Batch 3 — Parallel Execution Plan

### Track A — LanguagesService + DTOs + Controller

**Agent**: `oma-editor`

**Step A.1** — Rewrite `src/modules/profile/dto/create-language.dto.ts`:
- `languageId: string` (UUID, required) — FK to `LanguagesMaster`
- `proficiencyLevelId: string` (UUID, required) — FK to `ProficiencyLevels`
- `isNative?: boolean` (default false)

`UpdateLanguageDto` = `PartialType(CreateLanguageDto)`.

**Step A.2** — Rewrite `src/modules/profile/services/languages.service.ts`:
- `create(userId, dto)`: Validate language and proficiency level exist. Enforce
  `MAX_LANGUAGES`. Unique constraint: `(userId, languageId)`. Save with
  `userId set to the authenticated user's ID`. Call `ProfileService.recalculate(userId)`.
- `findAll(userId)`: Include `{ language: { select: { nameEn, nameAr } }, proficiencyLevel: { select: { nameEn, nameAr } } }`.
- `findOne(userId, languageId)`: Same includes. 404 if not found.
- `update(userId, languageId, dto)`: Update `proficiencyLevelId`, `isNative`. Call
  `ProfileService.recalculate(userId)`.
- `delete(userId, languageId)`: Hard-delete. Call `ProfileService.recalculate(userId)`.

---

### Track B — Reference: Languages + Proficiency Levels (parallel with A)

**Agent**: `oma-quick`

Update `reference.service.ts`:
- Update `getLanguages()` — select `{ nameEn, nameAr }` instead of `{ name }`.
- Add `getProficiencyLevels()`: returns `{ id, nameEn, nameAr, sortOrder }` ordered by sortOrder ascending.

Update `reference.controller.ts`:
- Verify `GET /reference/languages` is `@Public()` ✅
- Add `GET /reference/proficiency-levels` `@Public()`

---

### Track C — Tests (parallel with A and B)

**Agent**: `oma-reviewer`

Unit: `languages.service.spec.ts` — CRUD, uniqueness, MAX_LANGUAGES, `nameEn/nameAr` in return.

E2E: language CRUD, duplicate rejection (409), proficiency level reference.

Smoke + Postman: language records with `proficiencyLevelId`, show `nameEn/nameAr` in response.

---

## Batch 3 — Completion Report Template

| Method | Path | Auth | Body / Params | Response |
|:---:|:---|:---:|:---|:---|
| `POST` | `/api/v1/profile/languages` | Bearer | `{languageId, proficiencyLevelId, isNative?}` | Language record |
| `GET` | `/api/v1/profile/languages` | Bearer | — | `[LanguageRecord]` |
| `GET` | `/api/v1/profile/languages/:languageId` | Bearer | — | LanguageRecord |
| `PATCH` | `/api/v1/profile/languages/:languageId` | Bearer | UpdateLanguageDto | Updated record |
| `DELETE` | `/api/v1/profile/languages/:languageId` | Bearer | — | 204 |
| `GET` | `/api/v1/reference/languages` | Public | — | `[{ id, nameEn, nameAr }]` |
| `GET` | `/api/v1/reference/proficiency-levels` | Public | — | `[{id, nameEn, nameAr, sortOrder}]` |
