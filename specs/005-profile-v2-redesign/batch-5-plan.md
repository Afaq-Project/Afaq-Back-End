# Batch 5: Special Statuses & Target Preferences Plan

## Prerequisite verification

**1. Verify prior batch controllers are registered:**
```
2:import { ProfileController } from './controllers/profile.controller';
3:import { ProfileService } from './services/profile.service';
4:import { SystemSettingsService } from './services/system-settings.service';
6:import { ReferenceController } from './controllers/reference.controller';
7:import { ReferenceService } from './services/reference.service';
9:import { DocumentsController } from './controllers/documents.controller';
10:import { DocumentsService } from './services/documents.service';
11:import { StorageServiceProvider } from './storage/storage.service';
12:import { LocalStorageController } from './controllers/local-storage.controller';
13:import { LocalStorageService } from './storage/local-storage.service';
16:import { EducationsController } from './controllers/educations.controller';
17:import { EducationsService } from './services/educations.service';
19:import { LanguagesController } from './controllers/languages.controller';
20:import { LanguagesService } from './services/languages.service';
22:import { TestResultsController } from './controllers/test-results.controller';
23:import { TestResultsService } from './services/test-results.service';
25:import { SpecialStatusesController } from './controllers/special-statuses.controller';
26:import { SpecialStatusesService } from './services/special-statuses.service';
28:import { PreferencesController } from './controllers/preferences.controller';
29:import { PreferencesService } from './services/preferences.service';
33:    ProfileController,
34:    ReferenceController,
35:    DocumentsController,
36:    LocalStorageController,
37:    EducationsController,
38:    LanguagesController,
39:    TestResultsController,
40:    SpecialStatusesController,
41:    PreferencesController,
44:    ProfileService,
45:    SystemSettingsService,
46:    ReferenceService,
47:    DocumentsService,
48:    StorageServiceProvider,
49:    LocalStorageService,
50:    EducationsService,
51:    LanguagesService,
52:    TestResultsService,
53:    SpecialStatusesService,
54:    PreferencesService,
56:  exports: [ProfileService, SystemSettingsService],
```

**2. Start the server and confirm prior routes are mapped:**
```
[10:06:41.981] INFO (13962): ProfileController {/api/profile} (version: 1):
[10:06:41.981] INFO (13962): Mapped {/api/profile/me, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/profile/personal, PATCH} (version: 1) route
[10:06:41.981] INFO (13962): ReferenceController {/api/reference} (version: 1):
[10:06:41.981] INFO (13962): Mapped {/api/reference/languages, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/proficiency-levels, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/countries, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/cities, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/marital-statuses, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/education-levels, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/app-languages, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/major-categories, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/majors, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/institutions, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/standardized-tests, GET} (version: 1) route
[10:06:41.981] INFO (13962): Mapped {/api/reference/special-statuses, GET} (version: 1) route
```

**3. Reach a Batch 4 endpoint over HTTP:**
```
200
```

## Task List & Dependency Graph
- **Track A (SpecialStatusesService)**
  - T071: Create `create-special-status.dto.ts`
  - T072: Create `special-statuses.service.ts`
  - T073: Create `special-statuses.controller.ts` and `special-status-ownership.guard.ts`
- **Track B (PreferencesService)**
  - T075: Create `add-degree.dto.ts`, `add-major.dto.ts`, `add-institution.dto.ts`
  - T076: Create `preferences.service.ts`
  - T077: Create `preferences.controller.ts` and `preference-ownership.guard.ts`
- **Track C (Reference Endpoint)**
  - T079: Add `getSpecialStatuses()` to `reference.service.ts`
  - T080: Add `GET /reference/special-statuses` to `reference.controller.ts`
- **Track E (Route Registration)** (Sequential, after A, B, C)
  - T074, T078: Register controllers and services in `profile.module.ts` (Already registered, but will verify)

## Files Touched by Each Executor
- **Track A (oma-editor):**
  - `src/modules/profile/dto/create-special-status.dto.ts`
  - `src/modules/profile/services/special-statuses.service.ts`
  - `src/modules/profile/controllers/special-statuses.controller.ts`
  - `src/modules/profile/guards/special-status-ownership.guard.ts`
- **Track B (oma-editor):**
  - `src/modules/profile/dto/add-degree.dto.ts`
  - `src/modules/profile/dto/add-major.dto.ts`
  - `src/modules/profile/dto/add-institution.dto.ts`
  - `src/modules/profile/services/preferences.service.ts`
  - `src/modules/profile/controllers/preferences.controller.ts`
  - `src/modules/profile/guards/preference-ownership.guard.ts`
- **Track C (oma-quick):**
  - `src/modules/profile/services/reference.service.ts`
  - `src/modules/profile/controllers/reference.controller.ts`
- **Track E (oma-editor):**
  - `src/modules/profile/profile.module.ts`

## Acceptance Criteria
- **Special Statuses:**
  - `POST /profile/special-statuses` returns `200 OK` (idempotent add, no duplicates).
  - `GET /profile/special-statuses` returns statuses.
  - `DELETE /profile/special-statuses/:id` hard-deletes, returns `204`.
- **Target Preferences:**
  - `POST /profile/preferences/(degrees|majors|institutions)` returns `200 OK` (idempotent), limits enforced (409 on new add exceeding max).
  - `GET /profile/preferences` returns `{ targetDegrees, targetMajors, targetInstitutions }`.
  - `DELETE /profile/preferences/(degrees|majors|institutions)/:id` hard-deletes, returns `204`.
- **Reference:**
  - `GET /reference/special-statuses` returns statuses array.
- **Invariant:** `completionPct` reaches 100 when all groups are filled.

## Risk Register
1. **Idempotency vs 409:** Returning 409 on repeat-adds instead of 200 OK. *Mitigation: Use strict Prisma upsert (or INSERT ... ON CONFLICT DO NOTHING).*
2. **Missing PK constraint logic:** Using surrogate IDs. *Mitigation: Explicitly enforce composite PK usage.*
3. **Completion Calculation Error:** Not reaching 100%. *Mitigation: E2E test verifying EC-057.*
4. **Endpoint Reachability:** 404s due to missing controller mappings. *Mitigation: Gate 6 HTTP probes by Orchestrator.*
5. **Route De-registration:** Accidental removal in Track E. *Mitigation: `grep` check in Orchestrator gates.*

## Route Registration Verification
`SpecialStatusesController`, `PreferencesController`, `SpecialStatusesService`, and `PreferencesService` must be registered in `profile.module.ts` and reachable over HTTP before Batch 5 is done.

## Idempotency Correctness
POST to these endpoints must return `200 OK`, never `409`, on repeat-adds. The `MAX_*` limit is the **only** path that returns `409`, and only on a genuinely new add.

## Pivot-table PK
`(userId, specialStatusId)`, `(userId, educationLevelId)`, `(userId, majorId)`, `(userId, institutionId)` — no surrogate `id` exists on these tables. The Prisma model reflects this structure, which must be adhered to.
