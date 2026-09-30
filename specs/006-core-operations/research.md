# Research — Core Operations Module (Admin v1)

**Branch**: `006-core-operations` | **Date**: 2026-09-28

---

## 1. Force-Logout Implementation

**Decision**: Use `AuthService.revokeAllUserRefreshTokens(userId)`.

**Finding**: The method already exists in [`src/modules/auth/auth.service.ts`](file:///home/abood/Project/Afaq/Afaq-backend/src/modules/auth/auth.service.ts). It uses a Redis pipeline to delete every token hash stored under `rt:user:{userId}` and all individual `rt:{userId}:{hash}` keys atomically.

**Implication**: The `OperationsModule` must import `AuthModule` (or only the `AuthService`) to call this method. No new implementation is required — just wiring and exposure via the new controller.

---

## 2. Permission Guard Strategy

**Decision**: Extend the existing `RolesGuard` pattern. Do NOT create a bespoke `PermissionsGuard` from scratch; instead model the new guard on [`src/common/guards/roles.guard.ts`](file:///home/abood/Project/Afaq/Afaq-backend/src/common/guards/roles.guard.ts).

**Finding**: The existing guard uses `@Roles()` decorator + `Reflector`. The operations module will follow the same pattern with a new `@Permissions()` decorator referencing granular strings (`users:read`, `users:write`, `users:delete`, `roles:read`, `roles:write`, `reference:write`, `settings:read`, `settings:write`, `audit:read`, `documents:read`, `documents:delete`, `dashboard:read`). The guard reads the user's roles from `req.user` and resolves the allowed permissions from a static map.

**Rationale**: This avoids a DB round-trip per request. A static role-to-permissions map in the guard covers the current two admin levels (`content_admin`, `system_admin`). This map can be moved to DB later without API changes.

---

## 3. Audit Logging Strategy

**Decision**: Implement a shared `AuditLogService` in the operations module that wraps a `PrismaService` write to `ChangeLog`. Call it from the service layer (not an interceptor) so the actor ID is already resolved.

**Finding**: The `ChangeLog` schema already exists with fields: `id`, `tableName`, `recordId`, `action`, `oldData`, `newData`, `changedBy`, `changedAt`. No migration is required.

**Rationale**: Interceptor-based logging makes actor-ID injection awkward; service-layer calls give full control over what goes into `oldData`/`newData` (enabling sensitive field stripping before the log write).

---

## 4. `deletedAt` Soft-Delete for Users

**Decision**: Add a `deletedAt` column to the `users` table via a Prisma migration.

**Finding**: The `Users` model currently has no `deletedAt` field. A new field `deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)` must be added. An index on this field is recommended since all user queries will filter `deletedAt IS NULL`. The `AuthService.refreshToken` flow must be updated to check `deletedAt IS NULL` alongside `isActive: true`, locking deleted users out.

**Migration risk**: Low — nullable field addition is backward-compatible.

---

## 5. Password Reset Flow

**Decision**: Reuse the existing `forgot-password` email flow already implemented in `AuthService` (or its password-reset sub-service). The admin endpoint simply triggers that same flow for a target user ID without requiring the user to request it themselves.

**Finding**: Search revealed the auth module has a `forgotPassword` or reset-token flow. The operations endpoint calls this on behalf of the admin. The API response returns only a success envelope — no token or password is included.

---

## 6. Dashboard Statistics Query Strategy

**Decision**: Run four parallel `prisma.$queryRaw` or `prisma.count()` calls wrapped in a `Promise.all`, not a single complex join.

**Finding**: The four counts (total users, active users, matchable profiles, total documents) span different tables with different filters. Parallelizing them minimizes response latency and keeps each query simple and indexable. The `matching.threshold` value is fetched from `SystemSettingsService` with a code-level default of `60` as the fallback (already implemented in [`system-settings.service.ts`](file:///home/abood/Project/Afaq/Afaq-backend/src/modules/profile/services/system-settings.service.ts)).

---

## 7. Matchable Profile Count Query

**Decision**: `SELECT COUNT(*) FROM user_profiles WHERE completion_pct >= $threshold AND is_draft = false`.

**Finding**: `UserProfiles` already has a `completionPct` field managed by the profile service. The threshold is read from `SystemSettings` via `SystemSettingsService.getNumber('matching.threshold', 60)`. Soft-deleted users are excluded via a JOIN on `users WHERE deleted_at IS NULL AND is_active = true`.

---

## 8. Module Architecture

**Decision**: Create a new `OperationsModule` at `src/modules/operations/` following the Domain-Driven modular pattern used by `profile` and `users`.

**Structure**:
```
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
│   ├── reference.service.ts
│   └── documents-ops.service.ts
├── dto/
│   ├── users/ (status-update.dto.ts, bulk-status.dto.ts, ...)
│   ├── roles/ (assign-role.dto.ts)
│   ├── settings/ (update-setting.dto.ts)
│   ├── reference/ (create-reference.dto.ts, update-reference.dto.ts)
│   └── documents/ (document-query.dto.ts)
├── guards/
│   └── permissions.guard.ts
└── decorators/
    └── permissions.decorator.ts
```

**Rationale**: Follows Constitution XI module boundary rules. Each service has a single responsibility; the module explicitly exports only what other modules need (e.g., `AuditLogService`). Cross-cutting concerns (`AuthService`, `SystemSettingsService`, `StorageService`) are imported via their owning modules.

---

## 9. Reference Data Endpoint Strategy

**Decision**: Use a single `entity` route param resolved via a `ReferenceEntityResolver` that maps entity strings to Prisma delegates.

**Finding**: The master tables (`Institutions`, `Majors`, `Countries`, `Cities`, etc.) all follow the same `nameEn`/`nameAr`/`isActive` pattern. A resolver map approach avoids 20+ duplicate controller methods while remaining type-safe. Unknown entity strings return `400 INVALID_ENTITY`.

---

## 10. Alternatives Considered

| Topic | Rejected Alternative | Reason |
|:---|:---|:---|
| Force-logout | Clearing `refreshTokenRef` in DB | Redis already owns session state; `revokeAllUserRefreshTokens` is already implemented |
| Permission guard | DB-driven permissions per request | Adds a DB round-trip per request; overkill for v1 with two admin levels |
| Audit logging | AOP interceptor on all mutation routes | Hard to inject actor ID cleanly; service-layer calls are explicit and testable |
| Reference endpoints | Separate controller per entity | 15+ controllers for identical logic; resolver map is DRY and maintainable |
| Dashboard queries | Single complex JOIN | Harder to read, test, and optimize; parallel simple queries are equivalent in performance |
