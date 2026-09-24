# Batch 3: Languages Section — Implementation Plan

## 1. Task List and Dependency Graph

**Track A (Writes production service + DTOs)**
- **T048**: Rewrite `src/modules/profile/dto/create-language.dto.ts`
- **T049**: Create `src/modules/profile/dto/update-language.dto.ts` as `PartialType(CreateLanguageDto)`
- **T050**: Rewrite `src/modules/profile/services/languages.service.ts`
- **T051**: Update `src/modules/profile/controllers/languages.controller.ts`

**Track B (Writes reference endpoints)**
- **T052**: Update `src/modules/profile/services/reference.service.ts` to change `getLanguages()` select and add `getProficiencyLevels()`
- **T053**: Update `src/modules/profile/controllers/reference.controller.ts` to verify `GET /reference/languages` is `@Public()` and add `GET /reference/proficiency-levels`

**Track C (Sequential Route Registration)**
- **Registration Task**: Uncomment and register `LanguagesController` and `LanguagesService` in `src/modules/profile/profile.module.ts`. Must run after Track A and B.

**Track QA (Validation and Endpoint Verification scripts)**
- **T054**: Create `src/modules/profile/services/languages.service.spec.ts`
- **T055**: Extend `test/profile.e2e-spec.ts` with Batch 3 scenarios
- **Endpoint Script**: Create `scripts/test-batch3.sh`

*Dependency Graph:*
- Track A and Track B run in parallel.
- Track C runs after Track A and Track B complete.
- Track QA runs after Track A, B, and C complete (during the QA Review Gate).

---

## 2. File Modifiers

**Executor Agent (Track A/B/C)**
Will touch exactly and only the following files:
- `src/modules/profile/dto/create-language.dto.ts`
- `src/modules/profile/dto/update-language.dto.ts`
- `src/modules/profile/services/languages.service.ts`
- `src/modules/profile/controllers/languages.controller.ts`
- `src/modules/profile/services/reference.service.ts`
- `src/modules/profile/controllers/reference.controller.ts`
- `src/modules/profile/profile.module.ts`

**QA-Agent (Track QA)**
Will touch exactly and only the following files:
- `src/modules/profile/services/languages.service.spec.ts`
- `test/profile.e2e-spec.ts`
- `scripts/test-batch3.sh`

---

## 3. Acceptance Criteria per Endpoint

| Endpoint | Expected Behavior |
| --- | --- |
| `POST /profile/languages` | Validates `languageId` & `proficiencyLevelId`; saves with `isNative`; enforces max languages; unique `(userId, languageId)` check (409); calls recalculate. |
| `GET /profile/languages` | Returns all language records embedded with `language` and `proficiencyLevel` names. |
| `GET /profile/languages/:languageId` | Returns single language record or 404 if not found. |
| `PATCH /profile/languages/:languageId` | Partially updates `proficiencyLevelId` or `isNative`; calls recalculate. Fails with 400 if `languageId` provided in body. |
| `DELETE /profile/languages/:languageId` | Hard-deletes language record; calls recalculate. |
| `GET /reference/languages` | `@Public()`; Returns `id`, `nameEn`, `nameAr`, `isoCode`. |
| `GET /reference/proficiency-levels` | `@Public()`; Returns proficiency levels ordered by `sortOrder` ascending. |

---

## 4. Risk Register (Top 5)

1. **Risk: Route Registration Missed** - Batch 2 had issues where endpoints were unroutable. 
   *Mitigation*: Implement a strict Orchestrator verification step (Gate 6) to verify routes are registered in `profile.module.ts` and reachable via raw HTTP probes before proceeding.
2. **Risk: Missing Unique Constraint Checks** - Users could accidentally add the same language twice.
   *Mitigation*: Thorough testing in E2E tests, verifying that duplicates return a `409 LANGUAGE_DUPLICATE` error.
3. **Risk: Boundary Violations by Agents** - Agents may mistakenly modify files outside their domain (e.g. Executor writing tests).
   *Mitigation*: Enforced via strict Orchestrator-level Git diff and boundaries checks prior to progressing through gates.
4. **Risk: TypeScript Compilation Shortcuts** - Using `@ts-ignore` or `as any` to bypass strict types in updated DTOs or Services.
   *Mitigation*: Automatic `grep` checks after Executor deliverables to fail any report using banned patterns.
5. **Risk: Test Weakening** - Tests might be relaxed to force a passing build instead of fixing underlying logic.
   *Mitigation*: Orchestrator verifies zero skipped tests (`it.skip`) or modified assertions via Git diff.

---

## 5. Mandatory Route Registration Verification (Gate 6)

Before Batch 3 is considered done, the Orchestrator **must manually verify**:
1. `LanguagesController` and `LanguagesService` are present and uncommented in `src/modules/profile/profile.module.ts`.
2. A local NestJS server startup log (`pnpm start:dev`) shows the routes are mapped.
3. Raw HTTP `curl` probes to every endpoint in Batch 3 return expected domain-level responses (e.g., 401 Unauthorized or 400 Validation Error) and **not** `404 Cannot POST/GET/PATCH/DELETE` routing errors.
