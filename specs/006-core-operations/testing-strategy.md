# Testing Strategy — Core Operations Module (Admin v1)

---

## 1. Testing Philosophy

Unit tests isolate service-level business logic: permission logic, audit logging, bulk-cap enforcement, settings fallback, and storage-first deletion sequencing. Integration/E2E tests prove the NestJS HTTP contract, JWT/permission-guard execution, DTO validation, Prisma persistence, and the response envelope together. This follows Constitution VI; external services (storage, email) and production data are never used in tests.

---

## 2. Test Pyramid

The work is service-heavy for audit logging, document deletion, and bulk operations. Target the required service-unit suite as the broad base, integration/E2E coverage for all critical mutation paths and permission guard flows, and no browser/UI layer (none is specified).

---

## 3. Test Layers

| Layer | Scope | Tools | Doubles | When |
|:---|:---|:---|:---|:---|
| Unit | Service rules: bulk-cap validation, settings fallback, storage-first deletion order, audit log field exclusions, force-logout token clearing | Jest | Mock Prisma, `SystemSettingsService`, `StorageService`, `RedisService`; no live services | Local and `pnpm test` |
| Integration/E2E | HTTP routes, `PermissionsGuard`, JWT guard, `ValidationPipe`, response envelopes, persisted mutations, permission-before-service ordering | Jest + Supertest | Test database + fixtures; mock `StorageService` for deterministic failure paths; mock email for password reset | Local and CI `pnpm test:e2e` |
| Smoke | Endpoint reachability for all `/operations/*` routes with a valid admin token | Existing smoke test tooling | No production data | Per plan batch |

Permission guards are **real** in E2E tests. Guard-before-service assertions use a mocked service in focused controller/guard integration tests. Prisma is mocked only for unit tests. `StorageService` is mocked for upload/delete failure path simulations.

---

## 4. Coverage Requirements

- Every FR (FR-001 through FR-017), every error key, every permission guard, and every edge case in `edge-cases.md` is mandatory coverage.
- Every service named by Constitution VI requires Arrange-Act-Assert unit tests.
- All critical mutation flows (status change, force-logout, document delete, bulk update) require integration coverage.
- Read-only (`GET`) operations require E2E coverage for envelope shape, pagination, and filter correctness.
- `ChangeLog` write behavior (mutation → log entry) and non-write behavior (GET → no log entry) are mandatory integration-test items.
- Generated Prisma output, external cloud behavior, email delivery, and browser rendering are not test scope.

---

## 5. Test Data Management

Use isolated test records and clean up between test cases. Before test runs, seed:
- At least two user accounts: one with `system_admin` role, one with `user` role (no admin permissions).
- A third user to be used as the "target" for suspension, deletion, force-logout, and password reset scenarios.
- A set of master data records (Institution, Major, Country) with `isActive: true`.
- A `SystemSettings` record for `matching.threshold` (value: `60`).
- At least one `Document` record associated with the target user.
- A `ChangeLog` record for audit log read tests.

Tests never use production data or a live storage provider (Constitution VI).

---

## 6. Naming Conventions

Use the following file names:
- `operations.service.spec.ts` — unit tests for the operations service.
- `users-admin.service.spec.ts` — unit tests for user management sub-service.
- `documents-admin.service.spec.ts` — unit tests for document oversight sub-service.
- `reference.service.spec.ts` — unit tests for master data service.
- `test/operations.e2e-spec.ts` — HTTP-level integration tests for all `/operations/*` routes.

`describe` names the endpoint or service method. `it` states Given-When-Then behavior and may append `[EC-0xx]` / `[FR-xxx]` / `[ST-0xx]`.

---

## 7. Regression Policy

Every defect fix adds a failing regression test that would have caught it before the fix. This is mandatory under Constitution VI. Link the test to the relevant FR, edge-case ID, and defect reference in the fix PR.

---

## 8. CI Integration

Every PR runs `pnpm build`, `pnpm lint`, and `pnpm test`. Critical route coverage also runs `pnpm test:e2e` per batch gate. Husky/lint-staged runs lint/type-check pre-commit.

---

## 9. Batch-Level Gates

| Batch | Gate Evidence | Edge Cases |
|:---:|:---|:---|
| 1 | Dashboard stats endpoint: zero-data, threshold fallback, correct matchable count | EC-006–009 |
| 2 | User list/detail, status toggle (suspend/activate/self), soft-delete, JWT lockout | EC-010–018 |
| 3 | Force-logout token invalidation, password reset response hygiene | EC-019–022; ST-014–015 |
| 4 | Bulk status update: 100-cap enforcement, partial skip, dedup | EC-023–028; ST-013 |
| 5 | Role assignment: duplicate, invalid role, self-modification | EC-029–032 |
| 6 | Settings list/update: boundary values, unknown key, invalid JSON | EC-033–036 |
| 7 | Audit logs: list/detail, log entry content, no log on GET | EC-037–041; ST-019–020, ST-025 |
| 8 | Reference data: create, deactivate, reactivate, FK isolation | EC-042–048; ST-021 |
| 9 | Document list/detail/download/delete: storage-first, orphan prevention, admin bypass | EC-049–055; ST-016–018 |

---

## 10. Traceability Matrix

| FR | Test File(s) | Test Case(s) | Layer |
|:---|:---|:---|:---|
| FR-001 | `operations.e2e-spec.ts` | List users with search/filter/pagination | E2E |
| FR-002 | `users-admin.service.spec.ts`, `operations.e2e-spec.ts` | Toggle `isActive`; idempotent suspend; self-suspend | Unit, E2E |
| FR-003 | `users-admin.service.spec.ts`, `operations.e2e-spec.ts` | Bulk at 100; bulk at 101; empty array; partial-skip | Unit, E2E |
| FR-004 | `users-admin.service.spec.ts`, `operations.e2e-spec.ts` | Soft-delete sets `deletedAt`; login blocked after | Unit, E2E |
| FR-005 | `operations.e2e-spec.ts` | Password reset response has no token; dispatches email | E2E |
| FR-006 | `users-admin.service.spec.ts`, `operations.e2e-spec.ts` | Force-logout clears token ref; next refresh → `401` | Unit, Integration |
| FR-007 | `operations.e2e-spec.ts` | Admin assigns own role; no `403` | E2E |
| FR-008 | `operations.service.spec.ts`, `operations.e2e-spec.ts` | Dashboard zero-data; correct matchable count; threshold fallback | Unit, E2E |
| FR-009 | `reference.service.spec.ts`, `operations.e2e-spec.ts` | Create master record; required field validation | Unit, E2E |
| FR-010 | `reference.service.spec.ts`, `operations.e2e-spec.ts` | Deactivate and reactivate master record | Unit, E2E |
| FR-011 | `reference.service.spec.ts`, `operations.e2e-spec.ts` | Deactivated record absent from public endpoint; FK intact on user profile | Integration, E2E |
| FR-012 | `operations.e2e-spec.ts` | List settings; update `matching.threshold`; invalid value rejected | E2E |
| FR-013 | `operations.service.spec.ts`, `operations.e2e-spec.ts` | Mutation creates `ChangeLog` with correct `changedBy`; no PII in payload | Integration |
| FR-014 | `operations.e2e-spec.ts` | List audit logs; detail view shows `oldData`, `newData`, actor UUID | E2E |
| FR-015 | `operations.e2e-spec.ts` | List all documents across users with filter | E2E |
| FR-016 | `documents-admin.service.spec.ts`, `operations.e2e-spec.ts` | Admin download generates signed URL; ownership guard bypassed | Unit, E2E |
| FR-017 | `documents-admin.service.spec.ts`, `operations.e2e-spec.ts` | Storage-first delete succeeds; storage failure preserves DB record | Unit, E2E |
