# Tasks: Core Operations Module (Admin v1)

**Feature Branch**: `006-core-operations`
**Input**: `specs/006-core-operations/` — plan.md, spec.md, research.md, data-model.md, contracts/api.md, edge-cases.md, testing-strategy.md, security-controls.md

**Agent Roles**:
- 🎯 **Coordinator** — assigns tasks, verifies reports, never writes code
- ⚙️ **Executor** — implements code, fixes issues, never creates tests
- 🔬 **Testing Agent** — creates tests, reviews code, reports issues, never modifies source

**Workflow per task**: Coordinator assigns ➜ Executor implements ➜ Coordinator verifies ➜ Testing Agent tests + reviews ➜ Coordinator reviews report ➜ Executor fixes (if needed) ➜ Testing Agent re-verifies ➜ repeat until ✅

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase
- **[US#]**: User Story number from spec.md
- All file paths are repo-relative from project root

---

## Phase 1: Setup — Module Scaffold & Permissions Infrastructure

**Purpose**: Create the `OperationsModule` skeleton, `PermissionsGuard`, and `@Permissions()` decorator. This is the load-bearing foundation for every subsequent phase.

**Agent**: Coordinator assigns T001–T006 to Executor.

- [ ] T000 Verify `DEC-OPS-01` exists in `docx/decisions-log.md` documenting the `PermissionsGuard` + static role-permission map decision.
- [ ] T001 Create module directory structure `src/modules/operations/` with empty `controllers/`, `services/`, `dto/`, `guards/`, and `decorators/` subdirectories, plus `src/modules/operations/index.ts` and `src/modules/operations/operations.module.ts` with empty `@Module({ imports:[], controllers:[], providers:[], exports:[] })` declaration
- [ ] T002 Create `src/modules/operations/decorators/permissions.decorator.ts` — `@Permissions(...perms: string[])` using `SetMetadata(PERMISSIONS_KEY, perms)` mirroring the pattern in `src/common/decorators/roles.decorator.ts`
- [ ] T003 Create `src/modules/operations/guards/permissions.guard.ts` — `PermissionsGuard implements CanActivate`; reads required permissions from `@Permissions()` via `Reflector`; resolves user roles from `req.user.roles` (string[]); maps roles to permissions using the static `ROLE_PERMISSIONS_MAP` defined in `data-model.md §3`; throws `ForbiddenException` on mismatch; returns `true` if no permissions required (public route compat)
- [ ] T004 Register `OperationsModule` in `src/app.module.ts` imports array; verify `pnpm build` passes with zero errors
- [ ] T005 [P] Create `src/modules/operations/dto/common/paginated-query.dto.ts` — shared `page`, `limit`, `sort`, `order` query params with class-validator decorators and `@ApiPropertyOptional()` on each field; export from `src/modules/operations/dto/index.ts`
- [ ] T006 [P] Create `src/modules/operations/dto/common/api-response.dto.ts` — typed wrapper matching `{ statusCode, message, data?, meta?, timestamp }` envelope; export from dto index

**Testing Agent gate after Phase 1**:
- [ ] T007 Create `src/modules/operations/guards/permissions.guard.spec.ts` — unit tests for `PermissionsGuard`: (a) no required permissions → `true`; (b) user has matching role → `true`; (c) user lacks permission → `ForbiddenException`; (d) `system_admin` gets `documents:delete`, `content_admin` does not; (e) `req.user` missing → `ForbiddenException`. Coverage ≥ 80%.
- [ ] T008 Run `pnpm build`, `pnpm lint`, `pnpm test` — all pass; no regressions on existing test suite

**Checkpoint**: Module scaffolded, guard tested and verified. Phase 2 can begin.

---

## Phase 2: Foundational — Schema Migration + Audit Log Writer

**Purpose**: Two absolute prerequisites that every user story depends on: (1) `deleted_at` on users table, (2) `AuditLogWriterService` for mutation logging.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete and green.

**Agent**: Coordinator assigns T009–T013 to Executor.

- [ ] T009 Add `deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)` to `Users` model in `prisma/schema.prisma`; add `@@index([deletedAt])` to the `Users` index block; run `pnpm prisma migrate dev --name add-users-deleted-at`; verify migration file created in `prisma/migrations/`
- [ ] T010 Update `src/modules/auth/auth.service.ts` — `login()` method: add `deletedAt: null` to the user lookup `where` clause so soft-deleted users receive `401 UNAUTHORIZED`; update `refreshToken()` method: after fetching the user by ID, assert `user.deletedAt === null` and `user.isActive === true`, throw `UnauthorizedException` if either fails
- [ ] T011 [P] Update `src/modules/users/repositories/users.repository.ts` — add `deletedAt: null` filter to the default user lookup queries (`findById`, `findByEmail`) so soft-deleted users are excluded from normal lookups; deleted users remain queryable via a new `findByIdIncludeDeleted(id)` method for admin use only
- [ ] T012 Create `src/modules/operations/services/audit-log-writer.service.ts` — `@Injectable()` class with single public method `write(params: AuditWriteParams): Promise<void>`; `AuditWriteParams = { tableName: string; recordId: string; action: 'CREATE'|'UPDATE'|'DELETE'; oldData?: Record<string, unknown>; newData?: Record<string, unknown>; changedBy: string }`; before persisting: strip keys `['password', 'passwordHash', 'refreshToken', 'accessToken', 'hash', 'secret']` from both `oldData` and `newData`; write to `ChangeLog` via `PrismaService`; export from `OperationsModule`
- [ ] T013 Register `AuditLogWriterService` in `operations.module.ts` providers and exports; inject `PrismaService` into it; add `PrismaModule` (or `PrismaService` provider) to `OperationsModule` imports if not already globally provided

**Testing Agent gate after Phase 2**:
- [ ] T014 Update `src/modules/auth/auth.service.spec.ts` — add regression tests: (a) login with soft-deleted user returns `401`; (b) refresh token with soft-deleted user returns `401`; (c) login with suspended user (`isActive:false`) still returns `401` (already covered — verify not broken). Coverage must not regress.
- [ ] T015 Create `src/modules/operations/services/audit-log-writer.service.spec.ts` — unit tests: (a) writes correct `tableName`, `recordId`, `action`, `changedBy` to `ChangeLog`; (b) `password` field stripped from `oldData` before write; (c) `refreshToken` field stripped from `newData` before write; (d) `changedBy` UUID persisted exactly as provided; (e) Prisma failure throws and is not swallowed. Coverage ≥ 80%.
- [ ] T016 Run `pnpm prisma validate`, `pnpm build`, `pnpm lint`, `pnpm test` — all pass; migration file exists and is valid

**Checkpoint**: Schema migrated, auth flows updated, audit writer tested. All user story phases can now begin.

---

## Phase 3: User Story 1 — Admin Dashboard Statistics (P1) 🎯 MVP

**Goal**: Deliver `GET /operations/dashboard/stats` returning accurate user and document counts.

**Independent Test**: Call the endpoint with a valid `system_admin` JWT. Response matches `{ users: { total, active, suspended, matchable }, documents: { total } }` with no financial fields. Zero-data case returns all-zero counts. Threshold fallback works when `matching.threshold` is missing from DB.

**Agent**: Coordinator assigns T017–T022 to Executor.

### Implementation

- [ ] T017 Create `src/modules/operations/dto/dashboard/dashboard-stats.dto.ts` — `DashboardStatsDto` with nested `UsersStatsDto` and `DocumentsStatsDto`; all numeric fields with `@ApiProperty()`; no financial fields
- [ ] T018 Create `src/modules/operations/repositories/dashboard.repository.ts` — `DashboardRepository` wrapping the 4 parallel Prisma count queries (total users, active users, matchable profiles, total documents). Create `src/modules/operations/services/dashboard.service.ts` — `DashboardService` with `getStats(): Promise<DashboardStatsDto>`; fetches threshold via `SystemSettingsService.getNumber('matching.threshold', 60)` (import `SystemSettingsService` from profile module); injects `DashboardRepository` and `SystemSettingsService`.
- [ ] T019 Create `src/modules/operations/controllers/dashboard.controller.ts` — `@Controller('operations/dashboard')`, method `getStats()` on `GET /stats`; apply `@UseGuards(AuthGuard, PermissionsGuard)`, `@Permissions('dashboard:read')`; add `@ApiOperation`, `@ApiResponse(200)`, `@ApiResponse(401)`, `@ApiResponse(403)`, `@ApiTags('Operations — Dashboard')` decorators; return `DashboardStatsDto` wrapped in standard envelope
- [ ] T020 Register `DashboardService` and `DashboardController` in `OperationsModule`; add `SystemSettingsModule` (or `SystemSettingsService` provider) to `OperationsModule` imports

**Testing Agent gate after Phase 3**:
- [ ] T021 Create `src/modules/operations/services/dashboard.service.spec.ts` — unit tests: (a) all-zero DB → `{ users:{total:0,active:0,suspended:0,matchable:0}, documents:{total:0} }`; (b) `matching.threshold` missing from DB → fallback `60` used, no error; (c) `matching.threshold` key unparseable → fallback `60` used; (d) suspended users (`isActive:false`) not counted in active but counted in total; (e) soft-deleted users excluded from all counts. Coverage ≥ 80%.
- [ ] T022 Add E2E cases to `test/operations.e2e-spec.ts` (create file if not exists): (a) `GET /operations/dashboard/stats` with valid `system_admin` token → `200` correct shape; (b) no token → `401`; (c) `content_admin` token → `200` (has `dashboard:read`); (d) regular user token → `403`. Run `pnpm test` and `pnpm test:e2e`.

**Checkpoint**: Dashboard endpoint live and independently validated. MVP is demonstrable.

---

## Phase 4: User Story 2 — User Account Management & Suspension (P1)

**Goal**: Full user management — list, detail, suspend/activate, bulk status, password reset, force-logout, soft-delete.

**Independent Test**: Given a target user, an admin can search for them, suspend them (preventing token refresh), force-logout (invalidating all refresh tokens), trigger a password reset email, and soft-delete them. Bulk update of 100 IDs succeeds; 101 IDs rejected.

**Agent**: Coordinator assigns T023–T031 to Executor.

### DTOs

- [ ] T023 [P] Create `src/modules/operations/dto/users/user-list-query.dto.ts` — `search?: string`, `isActive?: boolean`, `roleId?: number`, extends `PaginatedQueryDto`; `@ApiPropertyOptional()` on each field
- [ ] T024 [P] Create `src/modules/operations/dto/users/update-user-status.dto.ts` — `{ isActive: boolean }` with `@IsBoolean()`, `@ApiProperty()`
- [ ] T025 [P] Create `src/modules/operations/dto/users/bulk-update-status.dto.ts` — `{ userIds: string[], isActive: boolean }`; `@IsUUID('4', { each: true })`, `@ArrayMinSize(1)`, `@ArrayMaxSize(100)` on `userIds`; `@IsBoolean()` on `isActive`; `@ApiProperty({ maxItems: 100 })` 
- [ ] T026 [P] Create `src/modules/operations/dto/users/user-summary.dto.ts` and `user-detail.dto.ts` — fields per `contracts/api.md §2`; `@ApiProperty()` on all fields; `deletedAt: string | null` included

### Service

- [ ] T027 Create `src/modules/operations/services/users-ops.service.ts` — `UsersOpsService` with methods: `listUsers(query)`, `getUserById(id)`, `setUserStatus(id, isActive, actorId)`, `bulkSetStatus(userIds[], isActive, actorId)`, `softDeleteUser(id, actorId)`, `triggerPasswordReset(id)`, `forceLogout(id)`; inject `PrismaService`, `AuditLogWriterService`, `AuthService` (for `revokeAllUserRefreshTokens`); all queries filter `deletedAt: null`; `getUserById` uses `findByIdIncludeDeleted` only for clarity error — if `deletedAt` is set, return `404`; `setUserStatus` writes to `ChangeLog`; `softDeleteUser` sets `deletedAt: new Date()`; `bulkSetStatus` skips non-existent IDs silently, deduplicates input, writes one `ChangeLog` entry per affected user; `triggerPasswordReset` delegates to existing auth password-reset flow (inject `AuthService` or password-reset sub-service)

### Controller

- [ ] T028 Create `src/modules/operations/controllers/users-ops.controller.ts` — `@Controller('operations/users')` with all 7 endpoints per `contracts/api.md §2`; each decorated with `@UseGuards(AuthGuard, PermissionsGuard)` and correct `@Permissions()`; `@Param('id') @IsUUID()` on all `:id` routes; `@Body()` with DTOs; full Swagger decorators including `@ApiOperation`, `@ApiResponse(200/201/204/400/401/403/404)`, `@ApiTags('Operations — Users')`
- [ ] T029 Register `UsersOpsService` and `UsersOpsController` in `OperationsModule`; add `AuthModule` to imports (for `AuthService.revokeAllUserRefreshTokens`)

**Testing Agent gate after Phase 4**:
- [ ] T030 Create `src/modules/operations/services/users-ops.service.spec.ts` — unit tests covering: EC-010–EC-028 edge cases; `setUserStatus` writes audit log with correct `oldData`/`newData`; `bulkSetStatus` skips non-existent IDs and deduplicates; `forceLogout` calls `AuthService.revokeAllUserRefreshTokens`; `softDeleteUser` sets `deletedAt` not `isActive`; `triggerPasswordReset` does NOT return any token. Coverage ≥ 80%.
- [ ] T031 Expand `test/operations.e2e-spec.ts` — E2E for all 7 user endpoints: ST-009 (suspend → refresh fails), ST-013 (bulk 101 rejected), ST-014 (password reset no token in response), ST-015 (force-logout → refresh fails), EC-016 (self-suspension permitted). Run full suite.

**Checkpoint**: User management fully implemented and tested.

---

## Phase 5: User Story 3 — Master Data Administration (P2)

**Goal**: Allow admins to create new reference records and deactivate existing ones via `POST/PATCH /operations/reference/:entity`.

**Independent Test**: Create a new Institution — appears in public dropdown. Deactivate a Major — hidden from public endpoint but preserved on existing user profiles.

**Agent**: Coordinator assigns T032–T038 to Executor.

### DTOs

- [ ] T032 [P] Create `src/modules/operations/dto/reference/create-reference.dto.ts` — `{ nameEn: string, nameAr: string, [parentId]?: string }`; `@IsString()`, `@IsNotEmpty()`, `@IsOptional()` on optional FK; `@ApiProperty()`
- [ ] T033 [P] Create `src/modules/operations/dto/reference/update-reference.dto.ts` — all fields optional; `isActive?: boolean`; `nameEn?: string`; `nameAr?: string`; `@IsOptional()` on each; `@ApiPropertyOptional()`

### Service

- [ ] T034 Create `src/modules/operations/repositories/reference.repository.ts` — `ReferenceRepository` that owns `REFERENCE_ENTITY_MAP` (per `data-model.md §4`) and handles Prisma dispatch (use a typed union or conditional delegation rather than `prisma[delegate]` string indexing, e.g., define `PrismaEntityDelegateMap` as a typed `Record<EntityKey, Prisma.XxxDelegate>`). Create `src/modules/operations/services/reference.service.ts` — `ReferenceService` with `createRecord(entity, dto, actorId)` (validates required fields, calls repository create) and `updateRecord(entity, id, dto, actorId)` (calls repository update); unknown entity → `BadRequestException('INVALID_ENTITY')`; not found → `NotFoundException('REFERENCE_NOT_FOUND')`; both methods write to `ChangeLog` via `AuditLogWriterService`; inject `ReferenceRepository`, `AuditLogWriterService`.

### Controller

- [ ] T035 Create `src/modules/operations/controllers/reference.controller.ts` — `@Controller('operations/reference')` with `POST /:entity` and `PATCH /:entity/:id`; `@Permissions('reference:write')`; full Swagger decorators; `@ApiTags('Operations — Reference Data')`
- [ ] T036 Register `ReferenceService` and `ReferenceController` in `OperationsModule`

**Testing Agent gate after Phase 5**:
- [ ] T037 Create `src/modules/operations/services/reference.service.spec.ts` — unit tests: EC-042–EC-048; unknown entity string → `BadRequestException`; non-existent ID → `NotFoundException`; missing `countryId` for Cities → validation error; create writes audit log; deactivate writes audit log. Coverage ≥ 80%.
- [ ] T038 Expand `test/operations.e2e-spec.ts` — E2E: create Institution → `201`; PATCH `isActive:false` → `200`; `GET /reference/institutions` (public) no longer contains deactivated item (ST-021); PATCH unknown entity → `400`; PATCH non-existent ID → `404`. Run full suite.

**Checkpoint**: Reference data administration live and validated.

---

## Phase 6: User Story 4 — System Settings Management (P2)

**Goal**: Allow admins to list and update `SystemSettings` entries including the `matching.threshold`.

**Independent Test**: Patch `matching.threshold` to `70`. Dashboard stats now reflect the new threshold. Patch with out-of-range value rejected.

**Agent**: Coordinator assigns T039–T044 to Executor.

### DTOs

- [ ] T039 [P] Create `src/modules/operations/dto/settings/update-setting.dto.ts` — `{ value: unknown }`; `@IsNotEmpty()`, `@ApiProperty({ description: 'JSON-compatible value' })`
- [ ] T040 [P] Create `src/modules/operations/dto/settings/setting.dto.ts` — `{ key: string, value: unknown, description: string|null, updatedAt: string }`; `@ApiProperty()` on each

### Service

- [ ] T041 Create `src/modules/operations/services/settings-ops.service.ts` — `SettingsOpsService` with `listSettings(): Promise<SettingDto[]>` (returns all `SystemSettings` rows) and `updateSetting(key, value, actorId): Promise<SettingDto>` (finds by `key`, throws `NotFoundException('SETTING_NOT_FOUND')` if absent, updates, writes to `ChangeLog` with `oldData` = `{ key, value: oldValue }` and `newData` = `{ key, value: newValue }`); inject `PrismaService`, `AuditLogWriterService`

### Controller

- [ ] T042 Create `src/modules/operations/controllers/settings-ops.controller.ts` — `@Controller('operations/settings')`; `GET /` with `@Permissions('settings:read')`; `PATCH /:key` with `@Permissions('settings:write')`; full Swagger; `@ApiTags('Operations — Settings')`
- [ ] T043 Register `SettingsOpsService` and `SettingsOpsController` in `OperationsModule`

**Testing Agent gate after Phase 6**:
- [ ] T044 Create `src/modules/operations/services/settings-ops.service.spec.ts` — unit tests: EC-033–EC-036; `updateSetting` for non-existent key → `NotFoundException`; write writes audit log; list returns all rows; `matching.threshold` boundary values `0` and `100` accepted (no range enforcement at service layer — that is a business-layer concern on read, not write). Coverage ≥ 80%. Add E2E: list settings → `200`; patch existing key → `200`; patch non-existent key → `404`; no token → `401`; `content_admin` on settings write → `403`. Run full suite.

**Checkpoint**: System settings management live. Dashboard threshold now configurable without redeployment.

---

## Phase 7: User Story 5 — Audit Log Review (P2)

**Goal**: Allow admins to list and view detailed audit log entries with actor information.

**Independent Test**: After suspending a user (Phase 4), list audit logs — entry appears with correct `changedBy` UUID. View detail — `oldData` and `newData` are correct; no `password` field visible.

**Agent**: Coordinator assigns T045–T050 to Executor.

### DTOs

- [ ] T045 [P] Create `src/modules/operations/dto/audit-logs/audit-log-query.dto.ts` — `tableName?`, `action?`, `changedBy?`, `from?`, `to?` (ISO date strings), extends `PaginatedQueryDto`; `@IsOptional()`, `@IsString()`, `@IsDateString()` as appropriate; `@ApiPropertyOptional()` on each
- [ ] T046 [P] Create `src/modules/operations/dto/audit-logs/audit-log-summary.dto.ts` and `audit-log-detail.dto.ts` — fields per `contracts/api.md §5`; `@ApiProperty()` on all; `oldData` and `newData` typed as `Record<string, unknown> | null`

### Service

- [ ] T047 Create `src/modules/operations/services/audit-logs.service.ts` — `AuditLogsService` with `listLogs(query): Promise<{ data: AuditLogSummaryDto[], meta: PaginationMeta }>` (paginated, filterable by `tableName`, `action`, `changedBy`, date range on `changedAt`; ordered `changedAt DESC` by default) and `getLogById(id): Promise<AuditLogDetailDto>` (full detail including `oldData` and `newData`; `NotFoundException('AUDIT_LOG_NOT_FOUND')` if missing); inject `PrismaService` only — this service is read-only, no audit writes

### Controller

- [ ] T048 Create `src/modules/operations/controllers/audit-logs.controller.ts` — `@Controller('operations/audit-logs')`; `GET /` with `@Permissions('audit:read')`; `GET /:id` with `@Permissions('audit:read')`; full Swagger; `@ApiTags('Operations — Audit Logs')`
- [ ] T049 Register `AuditLogsService` and `AuditLogsController` in `OperationsModule`

**Testing Agent gate after Phase 7**:
- [ ] T050 Create `src/modules/operations/services/audit-logs.service.spec.ts` — unit tests: EC-037–EC-041; `getLogById` with non-existent ID → `NotFoundException`; `getLogById` with invalid UUID format → validation error at controller level (mock in service spec as bad input); list with date range filter returns only matching entries; `oldData`/`newData` returned as-is (no stripping at read time — stripping happens at write time in `AuditLogWriterService`). Coverage ≥ 80%. Add E2E: list → `200`; detail → `200` with `oldData`/`newData`; no password fields in payloads (ST-020); `GET` operations do NOT create new `ChangeLog` entries (ST-025). Run full suite.

**Checkpoint**: Audit log review live. Operators can trace all admin actions.

---

## Phase 8: User Story 6 — Document Oversight (P2)

**Goal**: Allow admins to list, view, download, and hard-delete any user's documents with storage-first deletion safety.

**Independent Test**: Download a document as admin — signed URL returned without ownership check. Delete a document — storage-first deletion; storage failure returns `500` and preserves DB record.

**Agent**: Coordinator assigns T051–T057 to Executor.

### DTOs

- [ ] T051 [P] Create `src/modules/operations/dto/documents/document-query.dto.ts` — `userId?: string`, `documentTypeId?: string`, extends `PaginatedQueryDto`; `@IsUUID()` validators; `@ApiPropertyOptional()`
- [ ] T052 [P] Create `src/modules/operations/dto/documents/document-summary.dto.ts` and `document-detail.dto.ts` — fields per `contracts/api.md §7`; `storagePath` MUST NOT appear in either DTO; `@ApiProperty()` on all fields
- [ ] T053 [P] Create `src/modules/operations/dto/documents/download-url.dto.ts` — `{ url: string, expiresIn: number }` with `@ApiProperty()`

### Service

- [ ] T054 Create `src/modules/operations/services/documents-ops.service.ts` — `DocumentsOpsService` with: `listDocuments(query)` (paginated, filterable by `userId` and `documentTypeId`, no ownership filter); `getDocumentById(id)` (metadata only, `NotFoundException('DOCUMENT_NOT_FOUND')` if missing, `storagePath` excluded from returned DTO); `downloadDocument(id)` (fetch document, call `StorageService.getSignedUrl(storagePath, 900)`, return `{ url, expiresIn: 900 }` — NO `DocumentOwnershipGuard` here); `deleteDocument(id, actorId)` (fetch doc to get `storagePath` → call `StorageService.delete(storagePath)` → if throws, throw `InternalServerErrorException('STORAGE_DELETE_FAILED')`, DB record preserved → if OK, call `prisma.documents.delete({ where: { id } })` → write audit log); inject `PrismaService`, `StorageService`, `AuditLogWriterService`

### Controller

- [ ] T055 Create `src/modules/operations/controllers/documents-ops.controller.ts` — `@Controller('operations/documents')` with 4 endpoints per `contracts/api.md §7`; `@Permissions('documents:read')` on list/detail/download; `@Permissions('documents:delete')` on delete; NO `DocumentOwnershipGuard` applied anywhere; full Swagger; `@ApiTags('Operations — Documents')`
- [ ] T056 Register `DocumentsOpsService` and `DocumentsOpsController` in `OperationsModule`; add `StorageModule` (or `StorageService`) to imports

**Testing Agent gate after Phase 8**:
- [ ] T057 Create `src/modules/operations/services/documents-ops.service.spec.ts` — unit tests: EC-049–EC-055; `deleteDocument` storage failure → `InternalServerErrorException('STORAGE_DELETE_FAILED')` and Prisma delete NOT called; `deleteDocument` storage success → Prisma delete called then audit log written (assert call order via spies); `downloadDocument` calls `StorageService.getSignedUrl` with correct `storagePath` and `900` TTL; `storagePath` field absent from `getDocumentById` return value; `content_admin` can list/download but not delete (guard test in E2E). Coverage ≥ 80%. Add E2E: ST-016 (storage failure), ST-017 (success), ST-018 (admin bypass, no ownership guard), SC-OPS-009 (storage-first order). Run full suite.

**Checkpoint**: Document oversight live with storage-first safety guarantee.

---

## Phase 9: User Story (Support) — Role Assignment Endpoints

**Goal**: Allow admins to list available roles, assign a role to a user, and revoke a role from a user.

**Independent Test**: Assign `content_admin` role to a regular user — they can now access `audit:read` endpoints. Revoke role — access denied again.

**Agent**: Coordinator assigns T058–T063 to Executor.

### DTOs

- [ ] T058 [P] Create `src/modules/operations/dto/roles/assign-role.dto.ts` — `{ roleId: number }`; `@IsInt()`, `@Min(1)`, `@ApiProperty()`
- [ ] T059 [P] Create `src/modules/operations/dto/roles/role.dto.ts` — `{ id: number, name: string, description: string|null, isActive: boolean }`; `@ApiProperty()`

### Service

- [ ] T060 Create `src/modules/operations/services/roles-ops.service.ts` — `RolesOpsService` with: `listRoles()` (return all `Roles` where `isActive: true`); `assignRole(userId, roleId, actorId)` (verify user exists — `NotFoundException`; verify role exists — `BadRequestException('INVALID_ROLE')`; check `UserRoles` for existing assignment — if found and `isActive: true`, throw `ConflictException('ROLE_ALREADY_ASSIGNED')`; otherwise upsert `UserRoles` with `isActive: true`; write audit log); `revokeRole(userId, roleId, actorId)` (verify user + role assignment exists — `NotFoundException('USER_ROLE_NOT_FOUND')` if not; soft-deactivate by setting `isActive: false`; write audit log); inject `PrismaService`, `AuditLogWriterService`
  
### Controller

- [ ] T061 Create `src/modules/operations/controllers/roles-ops.controller.ts` — `@Controller('operations/roles')` with: `GET /` (`@Permissions('roles:read')`); `POST /users/:userId` (`@Permissions('roles:write')`, ensure no route collision with UsersOpsController); `DELETE /users/:userId/:roleId` (`@Permissions('roles:write')`, use `@Param('roleId', ParseIntPipe)` or `@IsInt()` depending on global pipes); full Swagger; `@ApiTags('operations/roles')`
- [ ] T062 Register `RolesOpsService` and `RolesOpsController` in `OperationsModule`

**Testing Agent gate for Phase 9**:
- [ ] T063 Create `src/modules/operations/services/roles-ops.service.spec.ts` — unit tests: EC-029–EC-032; assign non-existent role → `BadRequestException`; assign already-assigned role → `ConflictException`; revoke role user doesn't have → `NotFoundException`; self-assignment permitted (no guard blocks it); audit log written on assign and revoke. Coverage ≥ 80%. Add E2E: `GET /roles` → `200` list; `POST /users/:id/roles` → `201`; duplicate → `409`; `DELETE /users/:id/roles/:roleId` for non-existent → `404`. Run full suite.

**Checkpoint**: Role management live. Admin level changes are auditable.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, Swagger completeness, Postman collection, and full integration validation.

**Agent**: Coordinator assigns T064–T068 to Executor; T069–T071 to Testing Agent.

- [ ] T064 Audit all 7 controllers in `src/modules/operations/controllers/` — verify every method has `@ApiOperation({ summary, description })`, `@ApiResponse` for all documented status codes (200/201/204/400/401/403/404/409/500), and `@ApiTags('operations/...')` with correct sub-tag
- [ ] T065 [P] Add all new `/operations/*` endpoints to `Levora_API.postman_collection.json` per `spec.md §3.3 (FR-012)` — include request bodies, example UUIDs, and expected responses for happy-path and at least one error path per endpoint
- [ ] T066 [P] Update `README.md` — add `OperationsModule` to the module list with a brief description and reference to `specs/006-core-operations/quickstart.md` for setup steps
- [ ] T067 Verify `operations.module.ts` correctly imports `AuthModule`, `SystemSettingsModule` (or its service), `StorageModule` — run `pnpm build` with zero errors and zero circular-dependency warnings
- [ ] T068 Run `pnpm lint --fix` across `src/modules/operations/` — resolve all lint errors; run `pnpm format` to enforce uniform formatting

**Testing Agent full-suite gate**:
- [ ] T069 Run complete security test sweep per `security-testing.md` — ST-001 through ST-025: each test case verified against the running application or mocked E2E harness; document any gaps or deviations
- [ ] T070 Run `pnpm test` — verify unit test coverage ≥ 80% for every new service (`dashboard`, `users-ops`, `audit-log-writer`, `settings-ops`, `audit-logs`, `reference`, `documents-ops`, `roles-ops`, `permissions.guard`); report actual coverage percentages
- [ ] T071 Run `pnpm test:e2e` and `pnpm build` — all 12 quickstart validation steps from `quickstart.md` pass against local running app; zero build errors; zero lint errors; final green report to Coordinator

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Scaffold)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 ✅
- **⚠️ Phase 3–9 (User Stories)**: ALL depend on Phase 2 completion
- **Phase 10 (Polish)**: Depends on Phases 3–9 being complete

### User Story Dependencies (Phases 3–9)

After Phase 2 completes, phases 3–9 may proceed **in the order shown** (sequential per plan.md task cycle). Within the 3-agent workflow they are sequential by design — one task cycle at a time.

| Phase | Depends On |
|:---:|:---|
| Phase 3 (Dashboard) | Phase 2 only |
| Phase 4 (Users) | Phase 2 only |
| Phase 5 (Reference Data) | Phase 2 only |
| Phase 6 (Settings) | Phase 2 only |
| Phase 7 (Audit Logs) | Phase 2 + Phase 4 (to have data) |
| Phase 8 (Documents) | Phase 2 only |
| Phase 9 (Roles) | Phase 2 + Phase 4 (user lookup shared) |

### Within Each Phase

```
DTOs [P] ──► Service ──► Controller ──► Module Registration
                                              │
                                        Testing Agent
                                        (unit + E2E)
                                              │
                                        Coordinator ✅
```

---

## Parallel Opportunities

### Phase 1 — Parallel (different files, no conflict)
```
Task: T005 — PaginatedQueryDto
Task: T006 — ApiResponseDto
```

### Phase 2 — Parallel
```
Task: T011 — UsersRepository soft-delete update
```

### Phase 4 — DTOs Parallel
```
Task: T023 — UserListQueryDto
Task: T024 — UpdateUserStatusDto
Task: T025 — BulkUpdateStatusDto
Task: T026 — UserSummaryDto / UserDetailDto
```

### Phase 8 — DTOs Parallel
```
Task: T051 — DocumentQueryDto
Task: T052 — DocumentSummaryDto / DocumentDetailDto
Task: T053 — DownloadUrlDto
```

---

## Implementation Strategy

### MVP (Phases 1–3 only)

1. Phase 1: Scaffold + Guard
2. Phase 2: Migration + Audit Writer
3. Phase 3: Dashboard endpoint
4. **STOP and VALIDATE**: Dashboard accessible, permissions guard enforced, audit logging functional
5. Demonstrable to stakeholders

### Incremental Delivery

| Milestone | Phases | Delivers |
|:---|:---:|:---|
| MVP | 1–3 | Dashboard stats, permissions infra, audit foundation |
| Core Admin | 4 | Full user management (suspend, delete, force-logout) |
| Data Control | 5–6 | Reference data + settings management |
| Observability | 7 | Audit log review |
| Document Safety | 8 | Document oversight with storage-first deletion |
| Access Control | 9 | Role assignment |
| Production-Ready | 10 | Swagger, Postman, full security sweep |

---

## Notes

- `[P]` = different files, no conflicting dependencies — safe for parallel execution within a phase
- Every task has an exact file path — no ambiguity for the Executor Agent
- Testing Agent tasks are co-located with their implementation phase for traceability
- Coordinator must read actual generated files before approving each task — not just the Executor's report
- A human software engineer is monitoring this plan — quality and security are non-negotiable
