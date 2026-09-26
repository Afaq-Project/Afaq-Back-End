# Batch 2: Education Section — Implementation Plan

## 1. Task List and Dependency Graph

**Track A (Sequential — Blocks Tracks B and C)**
- **T035**: Update `scripts/load-reference-data.ts` to support a `--sample` flag for development-mode seeding (20 countries, 50 cities, 8 major categories, ≥40 majors, 30 institutions).
- **T036**: Run `pnpm ts-node scripts/load-reference-data.ts --sample` to seed the database.

**Track B (Parallel with Track C — Runs after Track A)**
- **T037**: Rewrite `src/modules/profile/dto/create-education.dto.ts`.
- **T038**: Create `src/modules/profile/dto/update-education.dto.ts`.
- **T039**: Rewrite `src/modules/profile/services/educations.service.ts`.
- **T040**: Update `src/modules/profile/controllers/educations.controller.ts`.

**Track C (Parallel with Track B — Runs after Track A)**
- **T041**: Add education reference endpoints to `src/modules/profile/services/reference.service.ts`.
- **T042**: Add routes to `src/modules/profile/controllers/reference.controller.ts`.

**Track D (Tests — Handled by QA-Agent later)**
- **T043**: Create `src/modules/profile/services/educations.service.spec.ts`.
- **T044**: Update `test/profile.e2e-spec.ts`.

## 2. Files to be Touched by Executor

*Note: The Executor agent will strictly touch production files only.*
1. `scripts/load-reference-data.ts`
2. `src/modules/profile/dto/create-education.dto.ts`
3. `src/modules/profile/dto/update-education.dto.ts`
4. `src/modules/profile/services/educations.service.ts`
5. `src/modules/profile/controllers/educations.controller.ts`
6. `src/modules/profile/services/reference.service.ts`
7. `src/modules/profile/controllers/reference.controller.ts`

## 3. Acceptance Criteria per Endpoint

- **`POST /api/v1/profile/educations`**
  - All FKs (`educationLevelId`, `institutionId`, `majorId`, `minorMajorId`) must be valid UUIDs and exist.
  - `minorMajorId` must differ from `majorId`.
  - Date clearing rule: If `isCurrent` is true, `endDate` is set to null. If false, `expectedGraduationDate` is set to null.
  - `endDate` must be >= `startDate`.
  - GPA is normalized to 4.0 scale based on `gpaRaw` and `gpaScale`.
  - Uniqueness constraint enforced: `(userId, institutionId, majorId, educationLevelId)` → 409 Conflict.
  - Exceeding `MAX_EDUCATIONS` limit returns 409 Conflict.
  - Mutating triggers `ProfileService.recalculate()`.
- **`GET /api/v1/profile/educations`**
  - Returns array of education records sorted by `updatedAt DESC` (fallback `createdAt DESC`), including embedded relation objects (`educationLevel`, `institution`, `major`, `minorMajor`).
- **`GET /api/v1/profile/educations/:id`**
  - Returns a single record. IDOR prevention: if not found or belongs to another user, returns 404.
- **`PATCH /api/v1/profile/educations/:id`**
  - Partial updates only. Validates dates and uniqueness rules against merged state.
  - GPA is recomputed only if `gpaRaw` or `gpaScale` changed.
  - Date clearing rule is applied.
  - Ownership checked, returning 404 on mismatch. Trigger recalculate.
- **`DELETE /api/v1/profile/educations/:id`**
  - Hard-deletes the record. Trigger recalculate (drops completion by 25 if the only education record). Ownership checked (404 on mismatch).
- **`GET /api/v1/reference/major-categories`**
  - Public route. Paginated, sortable, filterable by `search` and `isActive`.
- **`GET /api/v1/reference/majors`**
  - Public route. Paginated, sortable, filterable by `search` and `categoryId`.
- **`GET /api/v1/reference/institutions`**
  - Public route. Paginated, sortable, filterable by `search`, `countryId`, `cityId`.

## 4. Risk Register (Top 5) and Mitigations

1. **Information Disclosure via Resource IDOR:**
   - *Mitigation*: Ownership guards/checks must explicitly return `404 Not Found` (not `403 Forbidden`) if a UUID belonging to another user is queried, modified, or deleted to prevent ID enumeration.
2. **Date Constraint Evasion (`isCurrent` semantics):**
   - *Mitigation*: Server-side overrides. The backend must forcefully clear `endDate` or `expectedGraduationDate` based on `isCurrent`, ignoring any contradictory client input.
3. **Race Conditions on Uniqueness Limits:**
   - *Mitigation*: The `(userId, institutionId, majorId, educationLevelId)` constraint relies on a database unique index. The application must gracefully map Prisma unique constraint violations (P2002) to `409 Conflict`.
4. **Floating-point Imprecision in GPA Normalization:**
   - *Mitigation*: Implement formulas strictly. `gpaRaw / 5 * 4` and `gpaRaw / 100 * 4`. Handled securely on the server side so clients cannot spoof high GPAs.
5. **Test File Modification by Executor:**
   - *Mitigation*: Hard constraints placed on Executor to touch **only** the 7 production files listed above. The QA-Agent exclusively touches test files in Gate 3.
