# Testing Strategy — Profile Module v2 Redesign

## 1. Testing Philosophy

Unit tests isolate calculation, validation, normalization, deduplication, limit, storage-order, and configuration behavior. Integration/E2E tests prove the Nest HTTP contract, JWT/guard execution, DTO validation, Prisma persistence, and response envelope together. This follows Constitution VI; external services and production data are never used.

## 2. Test Pyramid

The specified work is service-heavy: target the required service-unit suite as the broad base, integration/E2E coverage for every critical mutation and auth flow, and no browser/UI layer (none is specified). T027, T028, T043, T054, T066, T081, T082, and T093 define the unit base; T029, T030, T044, T055, T067, T083, and T094 define endpoint coverage.

## 3. Test Layers

| Layer | Scope | Tools | Doubles | When |
|:---|:---|:---|:---|:---|
| Unit | Service rules, errors, calculations, fallbacks, normalization, storage sequence (Constitution VI; T027, T028, T043, T054, T066, T081, T082, T093) | Jest | Mock Prisma/SystemSettings/StorageService; no live services | Local and `pnpm test` |
| Integration/E2E | HTTP routes, Global ValidationPipe, JWT, guards, response envelope, persisted mutations (Constitution IV–VI; T029, T030, T044, T055, T067, T083, T094) | Jest + Supertest | Test database/fixtures; mock StorageService only for deterministic failure | Local and CI `pnpm test:e2e` |
| Smoke | Batch endpoint reachability and documented basic flows (plan batch structure) | Existing `tests/levora-smoke-tests.json` | No production data | Each batch per plan | 

Guards are real in E2E tests; guard-before-service assertions use a mocked service in focused controller/guard integration tests. Prisma is mocked only for unit tests. Storage is mocked for upload/delete failure paths (T093–T094).

## 4. Coverage Requirements

- Every FR in the matrix below, every error key, guard, public endpoint, limit, idempotent POST, completion boundary, and storage-first outcome is mandatory.
- Services named by Constitution VI require Arrange-Act-Assert unit tests.
- Auth flows and critical mutations require integration coverage.
- Generated Prisma output, external cloud behavior, browser rendering, and an unspecified CORS/rate-limit/dependency scanner are not test scope because no source artifact defines them.

## 5. Test Data Management

Use isolated test records/factories and cleanup between cases. Before Batch 1 test runs seed the masters listed in `data-model.md`; reference loader data follows plan loading order. Fixtures must include two users, active master records, score ranges/steps, settings defaults and override values. Tests never use production data or a live storage provider (Constitution VI; plan reference-data strategy).

## 6. Naming Conventions

Use the task-prescribed filenames: `*.service.spec.ts` for unit tests, `test/profile.e2e-spec.ts` and `test/auth.e2e-spec.ts` for HTTP tests. `describe` names the endpoint/service; `it` states Given-When-Then behavior and may append `[T0xx]` / `[FR-xxx]`. Examples are planning names, not new requirements.

## 7. Regression Policy

Every defect fix adds a failing regression test that would have caught it before the fix. This is mandatory under Constitution VI. Link the test to the relevant FR, endpoint error key, and defect reference in the fix PR.

## 8. CI Integration

Every PR runs `pnpm build`, `pnpm lint`, and `pnpm test`; critical route coverage also runs `pnpm test:e2e` per batch gates. Husky/lint-staged runs lint/type-check pre-commit. The artifacts specify no nightly-only suite, so no nightly requirement is asserted.

## 9. Batch-Level Gates

| Batch | Gate evidence | Source |
|:---:|:---|:---|
| 1 | Auth tokens-only, eight-section profile, personal/location and reference endpoints, build and tests | plan Batch 1; T027–030 |
| 2 | Education FK CRUD, GPA normalization/rules, duplicate/limit/ownership paths | plan Batch 2; T043–044 |
| 3 | Language CRUD, native flag, proficiency ordering, duplicate/limit paths | plan Batch 3; T054–055 |
| 4 | Test CRUD, min/max and step validation, duplicate/limit paths | plan Batch 4; T066–067 |
| 5 | Status/preference idempotency, per-relation limits, guards, 100% completion | plan Batch 5; T081–083 |
| 6 | File constraints/content inspection, storage-first hard delete, signed URL, no recalculation | plan Batch 6; T093–094 |

## 10. Traceability Matrix

| FR | Test File(s) | Test Case(s) | Layer |
|:---|:---|:---|:---|
| FR-001 | `profile.service.spec.ts`, `profile.e2e-spec.ts` | creates empty profile at signup; GET profile | Unit, E2E |
| FR-002 | `profile.service.spec.ts` | profile uses account `userId` | Unit |
| FR-003 | `profile.service.spec.ts`, `profile.e2e-spec.ts` | partial personal update preserves unrelated fields | Unit, E2E |
| FR-004 | all profile service specs | mutation invokes synchronous `recalculate` | Unit |
| FR-005 | `profile.service.spec.ts` | recalculation always increments matching version | Unit |
| FR-006 | `profile.service.spec.ts`, `auth.e2e-spec.ts` | account/profile identity and tokens remain separate | Unit, E2E |
| FR-007 | `profile.e2e-spec.ts` | computed fields rejected as unknown | E2E |
| FR-008 | `profile.service.spec.ts`, `profile.e2e-spec.ts` | empty/partial/all-groups completion totals | Unit, E2E |
| FR-009 | `profile.service.spec.ts`, `documents.service.spec.ts` | excluded fields/documents do not alter completion | Unit |
| FR-009b | `profile.service.spec.ts`, `profile.e2e-spec.ts` | bio configured boundary | Unit, E2E |
| FR-010 | `system-settings.service.spec.ts`, `profile.service.spec.ts` | parsed/default/unparseable settings, 100% group-total invariant, proportional component scaling | Unit |
| FR-011 | `profile.service.spec.ts`, `profile.e2e-spec.ts` | threshold false→true and true→false | Unit, E2E |
| FR-012 | `profile.e2e-spec.ts` | matchability direct-write rejected | E2E |
| FR-014 | `educations.service.spec.ts`, `profile.e2e-spec.ts` | master FK validation | Unit, E2E |
| FR-015 | `educations.service.spec.ts` | primary/optional distinct minor | Unit |
| FR-016 | `educations.service.spec.ts`, `profile.e2e-spec.ts` | three GPA scales and normalized score | Unit, E2E |
| FR-017 | `educations.service.spec.ts`, `profile.e2e-spec.ts` | duplicate education conflict | Unit, E2E |
| FR-018 | `educations.service.spec.ts` | configurable education maximum | Unit |
| FR-018b | `educations.service.spec.ts`, `profile.e2e-spec.ts` | current/date/minor create-update rules | Unit, E2E |
| FR-019 | `languages.service.spec.ts`, `profile.e2e-spec.ts` | master proficiency validation | Unit, E2E |
| FR-020 | `languages.service.spec.ts`, `profile.e2e-spec.ts` | native flag persists | Unit, E2E |
| FR-021 | `languages.service.spec.ts` | configurable language maximum | Unit |
| FR-022 | `test-results.service.spec.ts`, `profile.e2e-spec.ts` | standardized-test FK validation | Unit, E2E |
| FR-023 | `test-results.service.spec.ts`, `profile.e2e-spec.ts` | min/max and score-step boundaries | Unit, E2E |
| FR-024 | `test-results.service.spec.ts`, `profile.e2e-spec.ts` | duplicate test conflict | Unit, E2E |
| FR-025 | `test-results.service.spec.ts` | configurable test maximum | Unit |
| FR-026 | `special-statuses.service.spec.ts`, `profile.e2e-spec.ts` | status master FK and CRUD | Unit, E2E |
| FR-027 | `special-statuses.service.spec.ts`, `profile.e2e-spec.ts` | repeat status is silent upsert | Unit, E2E |
| FR-028 | `preferences.service.spec.ts`, `profile.e2e-spec.ts` | target-degree FK and CRUD | Unit, E2E |
| FR-029 | `preferences.service.spec.ts`, `profile.e2e-spec.ts` | target-major FK and CRUD | Unit, E2E |
| FR-030 | `preferences.service.spec.ts`, `profile.e2e-spec.ts` | target-institution FK and CRUD | Unit, E2E |
| FR-031 | `preferences.service.spec.ts`, `profile.e2e-spec.ts` | repeat preference is silent upsert | Unit, E2E |
| FR-032 | `preferences.service.spec.ts` | category-specific configured maxima | Unit |
| FR-033 | `documents.service.spec.ts`, `profile.e2e-spec.ts` | required document type and upload/list | Unit, E2E |
| FR-033b | `documents.service.spec.ts`, `profile.e2e-spec.ts` | configured size/MIME boundaries | Unit, E2E |
| FR-033c | `documents.service.spec.ts`, `profile.e2e-spec.ts` | inspected-content mismatch | Unit, E2E |
| FR-033d | `documents.service.spec.ts`, `profile.e2e-spec.ts` | database-write failure after upload triggers storage cleanup | Unit, E2E |
| FR-034 | `documents.service.spec.ts`, `profile.e2e-spec.ts` | storage-first failure preserves DB record | Unit, E2E |
| FR-035 | `documents.service.spec.ts`, `profile.e2e-spec.ts` | permanent hard delete | Unit, E2E |
| FR-036 | `documents.service.spec.ts`, `profile.e2e-spec.ts` | authenticated 15-minute signed URL | Unit, E2E |
| FR-037 | `profile.e2e-spec.ts` | all reference routes are token-free | E2E |
| FR-038 | `profile.e2e-spec.ts` | each required reference collection route | E2E |
| FR-039 | `profile.e2e-spec.ts` | master items expose `nameEn` and `nameAr` | E2E |
| FR-040 | `profile.e2e-spec.ts` | country/major/institution search and filters | E2E |
| FR-041 | migration/schema review tests | no skills/FieldOfStudy endpoint or schema artifact remains | Integration |
