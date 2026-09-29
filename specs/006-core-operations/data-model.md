# Data Model — Core Operations Module (Admin v1)

**Branch**: `006-core-operations` | **Date**: 2026-09-28

Sources: `spec.md`, `prisma/schema.prisma`, `research.md`

---

## 1. Schema Changes (Migration Required)

### 1.1 Add `deleted_at` to `users` Table

**Status**: NEW FIELD — migration required.

```prisma
model Users {
  // ... existing fields ...
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz(6)

  @@index([deletedAt])  // add to existing @@index block
}
```

**Impact**: 
- All user queries in the operations module MUST filter `WHERE deleted_at IS NULL` to exclude soft-deleted users.
- The `AuthService.refreshToken()` and `AuthService.login()` flows MUST add a `deletedAt: null` check alongside `isActive: true`.
- No other existing data is affected (nullable addition is backward-compatible).

---

## 2. Existing Schema Entities (Read-Only for Operations)

### 2.1 `Users`

| Field | Type | Notes |
|:---|:---|:---|
| `id` | `UUID` PK | |
| `email` | `String` unique | |
| `firstName` | `String?` | |
| `lastName` | `String?` | |
| `isActive` | `Boolean` | Toggled by suspend/activate endpoints |
| `deletedAt` | `DateTime?` | **NEW** — soft-delete field |
| `createdAt` | `DateTime` | |

### 2.2 `Roles`

| Field | Type | Notes |
|:---|:---|:---|
| `id` | `Int` PK | auto-increment |
| `name` | `String` unique | e.g. `user`, `content_admin`, `system_admin` |
| `isActive` | `Boolean` | |

### 2.3 `UserRoles`

| Field | Type | Notes |
|:---|:---|:---|
| `id` | `UUID` PK | |
| `userId` | `UUID` FK → `Users` | |
| `roleId` | `Int` FK → `Roles` | |
| `isActive` | `Boolean` | |

### 2.4 `SystemSettings`

| Field | Type | Notes |
|:---|:---|:---|
| `key` | `String` PK (varchar 100) | e.g. `matching.threshold` |
| `value` | `Json` | Parsed by `SystemSettingsService` |
| `description` | `String?` | Human-readable description |
| `updatedAt` | `DateTime` | Auto-updated |

### 2.5 `ChangeLog`

| Field | Type | Notes |
|:---|:---|:---|
| `id` | `UUID` PK | |
| `tableName` | `String` | e.g. `users`, `system_settings` |
| `recordId` | `UUID` | ID of the changed record |
| `action` | `String` | e.g. `UPDATE`, `DELETE` |
| `oldData` | `Json?` | State before change (sensitive fields stripped) |
| `newData` | `Json?` | State after change (sensitive fields stripped) |
| `changedBy` | `UUID?` | Admin user UUID from JWT |
| `changedAt` | `DateTime` | Indexed for time-range queries |

### 2.6 `Documents`

| Field | Type | Notes |
|:---|:---|:---|
| `id` | `UUID` PK | |
| `userId` | `UUID` FK → `UserProfiles` | |
| `displayName` | `String` | |
| `storagePath` | `String` | Used to call `StorageService.delete(storagePath)` |
| `mimeType` | `String` | |
| `sizeBytes` | `Int` | |
| `documentTypeId` | `UUID` FK → `DocumentTypes` | |
| `createdAt` | `DateTime` | |

---

## 3. Permission → Role Map (Static, v1)

The `PermissionsGuard` resolves permissions from this in-code map:

| Permission | Roles Granted |
|:---|:---|
| `dashboard:read` | `content_admin`, `system_admin` |
| `users:read` | `content_admin`, `system_admin` |
| `users:write` | `content_admin`, `system_admin` |
| `users:delete` | `system_admin` |
| `roles:read` | `content_admin`, `system_admin` |
| `roles:write` | `system_admin` |
| `settings:read` | `system_admin` |
| `settings:write` | `system_admin` |
| `audit:read` | `content_admin`, `system_admin` |
| `reference:write` | `content_admin`, `system_admin` |
| `documents:read` | `content_admin`, `system_admin` |
| `documents:delete` | `system_admin` |

---

## 4. Reference Entity Map

The `POST/PATCH /operations/reference/:entity` endpoints resolve the `:entity` param to a Prisma delegate:

| Entity Param | Prisma Model | Required Fields |
|:---|:---|:---|
| `countries` | `Countries` | `nameEn`, `nameAr` |
| `cities` | `Cities` | `nameEn`, `nameAr`, `countryId` |
| `institutions` | `Institutions` | `nameEn`, `nameAr` |
| `major-categories` | `MajorCategories` | `nameEn`, `nameAr` |
| `majors` | `Majors` | `nameEn`, `nameAr`, `categoryId` |
| `education-levels` | `EducationLevel` | `nameEn`, `nameAr` |
| `marital-statuses` | `MaritalStatuses` | `nameEn`, `nameAr` |
| `special-statuses` | `SpecialStatuses` | `nameEn`, `nameAr` |
| `standardized-tests` | `StandardizedTests` | `nameEn`, `nameAr`, `minScore`, `maxScore`, `scoreStep` |
| `languages` | `LanguagesMaster` | `nameEn`, `nameAr` |
| `proficiency-levels` | `ProficiencyLevels` | `nameEn`, `nameAr`, `rank` |
| `document-types` | `DocumentTypes` | `nameEn`, `nameAr` |
| `notification-types` | `NotificationTypes` | `nameEn`, `nameAr` |

Unknown entity strings → `400 INVALID_ENTITY`.

---

## 5. State Transitions

### User Account States

```
ACTIVE (isActive: true, deletedAt: null)
  │
  ├─[PATCH /status isActive:false]──► SUSPENDED (isActive: false, deletedAt: null)
  │                                         │
  │                                         └─[PATCH /status isActive:true]──► ACTIVE
  │
  └─[DELETE /users/:id]──► SOFT-DELETED (deletedAt: DateTime, isActive: any)
                                   │
                                   └── TERMINAL — no recovery endpoint in v1
```

### Document States

```
EXISTS (storagePath valid, DB record present)
  │
  └─[DELETE /documents/:id]──► Storage delete attempt
        │
        ├─[Storage OK]──► DB hard-delete ──► GONE (204)
        │
        └─[Storage FAIL]──► DB preserved ──► ERROR (500, retryable)
```
