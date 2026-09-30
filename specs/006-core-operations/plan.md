# Implementation Plan: Core Operations Module (Admin v1)

**Branch**: `006-core-operations` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/006-core-operations/spec.md`

---

## Summary

Introduce a new `OperationsModule` at `/api/v1/operations` that provides authorized administrative control over users, roles, system settings, audit logs, reference (master) data, and documents. The module uses a fine-grained `PermissionsGuard`, logs all mutations to the `ChangeLog` table, and delegates force-logout to the existing `AuthService.revokeAllUserRefreshTokens()`. A one-field schema migration adds `deleted_at` to the `users` table for soft-deletion support.

---

## Technical Context

**Language/Version**: TypeScript (strict mode) — Node.js LTS

**Primary Dependencies**: NestJS, Prisma ORM, class-validator, class-transformer, ioredis (via `RedisService`), `@nestjs/swagger`

**Storage**: PostgreSQL (via Prisma) + Redis (refresh token revocation via existing `RedisService`)

**Testing**: Jest (unit) + Supertest (E2E) — see `testing-strategy.md`

**Target Platform**: Linux server (NestJS HTTP service)

**Project Type**: REST API web service

**Performance Goals**: Dashboard stats endpoint < 500ms p95 under normal load (4 parallel DB queries).

**Constraints**: Bulk update cap = 100 user IDs. All secrets via `ConfigService`. No `process.env` in services/controllers.

**Scale/Scope**: Modest admin user base (< 50 admins). Primarily low-frequency operations.

---

## Constitution Check

| Rule | Status | Notes |
|:---|:---:|:---|
| No business logic in Controllers | ✅ | All logic in Services; controllers are thin |
| Controller → Service → Repository flow | ✅ | No service cross-calls to controllers |
| UUID primary keys with `gen_random_uuid()` | ✅ | All new records follow existing convention |
| Migrations for every schema change | ✅ | `deletedAt` field requires a migration |
| `isActive` index for filtered queries | ✅ | `deletedAt` index to be added in migration |
| JWT auth + `PermissionsGuard` | ✅ | New guard follows existing `RolesGuard` pattern |
| Secrets via `ConfigService` only | ✅ | No hardcoded values |
| `bcrypt` for passwords | ✅ | Not touched by this module |
| `GlobalExceptionFilter` for uniform errors | ✅ | Inherited; no custom exception filter needed |
| Constitution VI: 80% unit test coverage on new Services | ✅ Required | Testing Agent enforces this gate |
| `pnpm build` + `pnpm lint` + `pnpm test` gates | ✅ Required | Enforced at end of each task cycle |
| `@ApiOperation`, `@ApiResponse`, `@ApiProperty` on all endpoints | ✅ Required | Executor Agent responsibility |
| `.env.example` updated for new env vars | N/A | No new env vars introduced |

---

## Project Structure

### Documentation (this feature)

```text
specs/006-core-operations/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── api.md           ← Phase 1 output
├── edge-cases.md
├── security-controls.md
├── security-testing.md
├── testing-strategy.md
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code

```text
src/modules/operations/
├── operations.module.ts
├── index.ts
├── controllers/
│   ├── dashboard.controller.ts
│   ├── users-ops.controller.ts
│   ├── roles-ops.controller.ts
│   ├── settings-ops.controller.ts
│   ├── audit-logs.controller.ts
│   ├── reference.controller.ts
│   └── documents-ops.controller.ts
├── services/
│   ├── dashboard.service.ts
│   ├── users-ops.service.ts
│   ├── roles-ops.service.ts
│   ├── settings-ops.service.ts
│   ├── audit-logs.service.ts
│   ├── audit-log-writer.service.ts   ← shared, wraps ChangeLog writes
│   ├── reference.service.ts
│   └── documents-ops.service.ts
├── dto/
│   ├── dashboard/
│   ├── users/
│   ├── roles/
│   ├── settings/
│   ├── reference/
│   └── documents/
├── guards/
│   └── permissions.guard.ts
└── decorators/
    └── permissions.decorator.ts

test/
└── operations.e2e-spec.ts
```

---

## Agent Roles & Workflow

This plan is executed by **three OmA agents** operating in a strict sequential loop per task:

```
Coordinator ──assigns──► Executor ──reports──► Coordinator ──verifies──►
Testing Agent ──reports issues──► Coordinator ──assigns fix──► Executor ──►
Coordinator ──verifies fix──► Testing Agent ──re-verifies──► (repeat until ✅)
```

### Coordinator Agent
- **Writes no code.**
- Assigns tasks to Executor and Testing agents in order.
- Verifies Executor reports against reality (reads actual files; does not trust self-report).
- Verifies Testing reports for completeness and accuracy.
- Declares a task complete only when Testing Agent confirms all checks pass.
- A human software engineer is monitoring all output — quality is non-negotiable.

### Executor Agent
- **Creates no tests.**
- Implements the assigned task following Constitution, spec, research, and contract artifacts.
- Reports to Coordinator: files created/modified, key decisions, any deviations from plan.
- Fixes issues flagged by the Testing Agent when assigned by Coordinator.

### Testing Agent
- **Never modifies source code.**
- Creates unit and E2E tests per `testing-strategy.md` and `edge-cases.md`.
- Reviews code for correctness, security, and spec compliance.
- Reports to Coordinator: test results, failing test IDs, root causes, and affected FRs.
- Re-verifies after Executor fixes are applied.

---

## Execution Tasks

Tasks are executed **sequentially**. Each task completes its full Coordinator → Executor → Testing cycle before the next begins.

---

### Task 1 — Schema Migration: Add `deleted_at` to Users

**Assigned to**: Executor Agent

**Scope**:
- Add `deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)` to the `Users` Prisma model.
- Add `@@index([deletedAt])` to the `Users` model.
- Run `pnpm prisma migrate dev --name add-users-deleted-at`.
- Update `AuthService.refreshToken()` to reject tokens where `deletedAt IS NOT NULL`.
- Update `AuthService.login()` to reject login where `deletedAt IS NOT NULL`.
- Update `UsersRepository.findById()` (or equivalent) to exclude soft-deleted users from default lookups.

**Acceptance Gate** (Testing Agent):
- EC-005, EC-018: Soft-deleted user cannot refresh token or login.
- Migration runs successfully on a clean DB.
- `pnpm build` and `pnpm test` pass with zero regressions.

---

### Task 2 — Module Scaffold: `PermissionsGuard` + `OperationsModule` Skeleton

**Assigned to**: Executor Agent

**Scope**:
- Create `src/modules/operations/guards/permissions.guard.ts` implementing `CanActivate`.
  - Reads required permissions from `@Permissions()` decorator via `Reflector`.
  - Resolves user roles from `req.user.roles` (array of role name strings).
  - Maps roles → permissions using the static map in `data-model.md §3`.
  - Returns `403 FORBIDDEN` if permission not satisfied.
- Create `src/modules/operations/decorators/permissions.decorator.ts`.
- Create `src/modules/operations/operations.module.ts` (empty controllers/providers list for now).
- Register `OperationsModule` in `AppModule`.
- Ensure the module builds successfully.

**Acceptance Gate** (Testing Agent):
- ST-005, ST-006, ST-007: Guard correctly enforces permissions per role.
- ST-008: `changedBy` in body is rejected.
- `pnpm build`, `pnpm lint`, `pnpm test` pass.

---

### Task 3 — Audit Log Writer Service

**Assigned to**: Executor Agent

**Scope**:
- Create `src/modules/operations/services/audit-log-writer.service.ts`.
- Method: `write(params: { tableName, recordId, action, oldData?, newData?, changedBy })`.
- Before persisting: strip sensitive keys (`password`, `refreshToken`, `accessToken`, `hash`) from `oldData` and `newData`.
- Writes to `ChangeLog` via `PrismaService`.
- Export `AuditLogWriterService` from `OperationsModule` for use by other module services if needed.

**Acceptance Gate** (Testing Agent):
- ST-019: Mutation creates log with correct `changedBy`.
- ST-020: No sensitive fields in `oldData`/`newData`.
- Unit test coverage ≥ 80% on `AuditLogWriterService`.
- `pnpm test` passes.

---

### Task 4 — Dashboard Endpoint

**Assigned to**: Executor Agent

**Scope**:
- Create `DashboardRepository` in `src/modules/operations/repositories` to wrap the 4 parallel Prisma count queries:
  1. Total non-deleted users.
  2. Active non-deleted users.
  3. Matchable profiles (join `UserProfiles` where `completionPct >= threshold`).
  4. Total documents.
- Create `DashboardService` with method `getStats()`.
- Fetch `matching.threshold` from `SystemSettingsService` with fallback `60`.
- Inject `DashboardRepository` and `SystemSettingsService` into `DashboardService`.
- Create `DashboardController` with `GET /operations/dashboard/stats` using `@Permissions('dashboard:read')`.
- Swagger decorators on controller and response DTO.

**Acceptance Gate** (Testing Agent):
- EC-006: Zero-data case returns all-zero counts.
- EC-007, EC-008: Threshold fallback works correctly.
- EC-009: Soft-deleted users excluded from counts.
- Unit test coverage ≥ 80% on `DashboardService`.
- E2E: `GET /operations/dashboard/stats` returns correct envelope.

---

### Task 5 — User Management Endpoints

**Assigned to**: Executor Agent

**Scope**:
- Create `UsersOpsService` with:
  - `listUsers(query)` — paginated, filterable, search.
  - `getUserById(id)` — full detail including roles and profile summary.
  - `setUserStatus(id, isActive, actorId)` — toggle + audit log write.
  - `bulkSetStatus(userIds[], isActive, actorId)` — max 100, partial-skip non-existent, audit log per affected user.
  - `softDeleteUser(id, actorId)` — set `deletedAt`, audit log write.
  - `triggerPasswordReset(id)` — call existing auth reset flow.
  - `forceLogout(id)` — call `AuthService.revokeAllUserRefreshTokens(id)`.
- Create `UsersOpsController` with all 7 endpoints.
- All mutation endpoints write to `ChangeLog` via `AuditLogWriterService`.
- Swagger on all methods and DTOs.

**Acceptance Gate** (Testing Agent):
- EC-010 through EC-028: Full user management edge case coverage.
- ST-009, ST-010, ST-013, ST-014, ST-015: Session security tests.
- SC-OPS-003: `changedBy` from JWT, never body.
- Unit test coverage ≥ 80% on `UsersOpsService`.
- E2E coverage for all 7 endpoints.

---

### Task 6 — Role Assignment Endpoints

**Assigned to**: Executor Agent

**Scope**:
- Create `RolesOpsService` with:
  - `listRoles()` — return all active roles.
  - `assignRole(userId, roleId)` — idempotent or conflict error.
  - `revokeRole(userId, roleId)` — error if not assigned.
- Create `RolesOpsController` with 3 endpoints.
- Audit log on assign and revoke.
- Swagger on all methods and DTOs.

**Acceptance Gate** (Testing Agent):
- EC-029 through EC-032: Role edge cases.
- Unit coverage ≥ 80% on `RolesOpsService`.
- E2E for all 3 endpoints.

---

### Task 7 — System Settings Endpoints

**Assigned to**: Executor Agent

**Scope**:
- Create `SettingsOpsService` with:
  - `listSettings()` — return all rows from `SystemSettings`.
  - `updateSetting(key, value)` — find + update; `404` if key not found.
- Create `SettingsOpsController` with 2 endpoints.
- Audit log on update.
- Swagger on all methods and DTOs.

**Acceptance Gate** (Testing Agent):
- EC-033 through EC-036: Settings edge cases (boundary values, unknown key, invalid JSON).
- Unit coverage ≥ 80% on `SettingsOpsService`.
- E2E for both endpoints.

---

### Task 8 — Audit Logs Endpoints

**Assigned to**: Executor Agent

**Scope**:
- Create `AuditLogsService` with:
  - `listLogs(query)` — paginated, filterable by `tableName`, `action`, `changedBy`, date range.
  - `getLogById(id)` — full detail with `oldData`, `newData`.
- Create `AuditLogsController` with 2 endpoints.
- No audit log written for read operations (GET only).
- Swagger on all methods and DTOs.

**Acceptance Gate** (Testing Agent):
- EC-037 through EC-041: Audit log edge cases.
- ST-025: No `ChangeLog` entry for GET operations.
- Unit coverage ≥ 80% on `AuditLogsService`.
- E2E for both endpoints.

---

### Task 9 — Reference Data Endpoints

**Assigned to**: Executor Agent

**Scope**:
- Create `ReferenceRepository` to own `REFERENCE_ENTITY_MAP` (see `data-model.md §4`) and handle Prisma dispatch with type safety.
- Create `ReferenceService` with:
  - `createRecord(entity, dto)` — validate required fields, call repository insert.
  - `updateRecord(entity, id, dto)` — validate entity, call repository partial update.
- Unknown entity param → `400 INVALID_ENTITY`.
- Create `ReferenceController` with 2 endpoints.
- Audit log on create and update.
- Swagger on all methods.

**Acceptance Gate** (Testing Agent):
- EC-042 through EC-048: Reference data edge cases.
- ST-021: Deactivated record absent from public reference endpoint; FK intact on existing profiles.
- Unit coverage ≥ 80% on `ReferenceService`.
- E2E for both endpoints including deactivation isolation.

---

### Task 10 — Document Oversight Endpoints

**Assigned to**: Executor Agent

**Scope**:
- Create `DocumentsOpsService` with:
  - `listDocuments(query)` — paginated, filterable by `userId` and `documentTypeId`.
  - `getDocumentById(id)` — metadata (NO `storagePath` in response DTO).
  - `downloadDocument(id)` — generate signed URL via `StorageService`; no `DocumentOwnershipGuard`.
  - `deleteDocument(id)` — storage-first: call `StorageService.delete(storagePath)`; if OK → hard-delete DB record; if FAIL → throw `500 STORAGE_DELETE_FAILED`, preserve DB record.
- Create `DocumentsOpsController` with 4 endpoints.
- Audit log on delete only.
- Swagger on all methods and DTOs.

**Acceptance Gate** (Testing Agent):
- EC-049 through EC-055: Document oversight edge cases.
- ST-016, ST-017, ST-018: Storage-first deletion and admin bypass.
- SC-OPS-009, SC-OPS-010: Security controls verified.
- Unit coverage ≥ 80% on `DocumentsOpsService`.
- E2E for all 4 endpoints.

---

### Task 11 — Final Integration: Swagger, Build, and Full Suite

**Assigned to**: Executor Agent (Swagger/build) + Testing Agent (full suite)

**Executor scope**:
- Ensure all controllers have `@ApiTags('operations/...')` with the correct sub-tag.
- Ensure all DTOs have `@ApiProperty()` on every field.
- Verify `pnpm build` and `pnpm lint` pass with zero errors.

**Testing Agent scope**:
- Run `pnpm test` — all unit tests pass, coverage ≥ 80% per service.
- Run `pnpm test:e2e` — all E2E scenarios from `testing-strategy.md` pass.
- Run all security tests from `security-testing.md` (ST-001 through ST-025).
- Run `pnpm build` and `pnpm lint` — zero errors.
- Verify all 12 quickstart validation steps pass against the running app.
- Final report to Coordinator: full green or list of remaining issues.

---

## Complexity Tracking

No Constitution violations. The plan follows all established patterns.
