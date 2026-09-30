# API Contracts — Core Operations Module (Admin v1)

**Branch**: `006-core-operations` | **Date**: 2026-09-28

**Base URL**: `/api/v1/operations`
**Auth**: Bearer JWT required for all endpoints.
**Response Envelope**: `{ statusCode: number, message: string, data?: T, meta?: PaginationMeta, timestamp: string }`
**Error Envelope**: `{ statusCode: number, message: string, error: string, timestamp: string }`

---

## Common Types

```typescript
// Pagination meta (on list responses)
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Standard success
interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  timestamp: string;
}
```

---

## 1. Dashboard

### `GET /operations/dashboard/stats`
**Permission**: `dashboard:read`

**Response `data`**:
```typescript
{
  users: {
    total: number;       // all non-deleted users
    active: number;      // isActive: true, deletedAt: null
    suspended: number;   // isActive: false, deletedAt: null
    matchable: number;   // completionPct >= matching.threshold, deletedAt: null
  };
  documents: {
    total: number;       // all document records
  };
}
```

---

## 2. Users

### `GET /operations/users`
**Permission**: `users:read`

**Query Params**: `search?: string`, `isActive?: boolean`, `roleId?: number`, `page?: number` (default 1), `limit?: number` (default 20), `sort?: string`, `order?: 'asc'|'desc'`

**Response `data`**: `UserSummaryDto[]`
```typescript
interface UserSummaryDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: string;
  deletedAt: string | null;
  roles: string[];
}
```

---

### `GET /operations/users/:id`
**Permission**: `users:read`

**Response `data`**: `UserDetailDto`
```typescript
interface UserDetailDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  roles: string[];
  profile: {
    completionPct: number;
    isMatchable: boolean;
  } | null;
}
```

**Errors**: `404 USER_NOT_FOUND`, `400 VALIDATION_ERROR`

---

### `PATCH /operations/users/:id/status`
**Permission**: `users:write`

**Body**:
```typescript
{ isActive: boolean }
```
**Response**: `204 No Content`

**Errors**: `404 USER_NOT_FOUND`, `400 VALIDATION_ERROR`

---

### `PATCH /operations/users/bulk/status`
**Permission**: `users:write`

**Body**:
```typescript
{ userIds: string[]; isActive: boolean }  // userIds: max 100
```

**Response `data`**:
```typescript
{ updated: number; skipped: number }
```

**Errors**: `400 VALIDATION_ERROR` (if > 100 IDs or empty array)

---

### `POST /operations/users/:id/password-reset`
**Permission**: `users:write`

**Body**: none

**Response**: `200`
```typescript
{ message: "Password reset email dispatched." }
```

**Errors**: `404 USER_NOT_FOUND`

---

### `POST /operations/users/:id/force-logout`
**Permission**: `users:write`

**Body**: none

**Response**: `204 No Content`

**Errors**: `404 USER_NOT_FOUND`

---

### `DELETE /operations/users/:id`
**Permission**: `users:delete`

**Body**: none

**Response**: `204 No Content` (sets `deletedAt`)

**Errors**: `404 USER_NOT_FOUND`

---

## 3. Roles

### `GET /operations/roles`
**Permission**: `roles:read`

**Response `data`**: `RoleDto[]`
```typescript
interface RoleDto {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
}
```

---

### `POST /operations/users/:id/roles`
**Permission**: `roles:write`

**Body**:
```typescript
{ roleId: number }
```

**Response**: `201 Created`

**Errors**: `404 USER_NOT_FOUND`, `400 INVALID_ROLE`, `409 ROLE_ALREADY_ASSIGNED`

---

### `DELETE /operations/users/:id/roles/:roleId`
**Permission**: `roles:write`

**Response**: `204 No Content`

**Errors**: `404 USER_NOT_FOUND`, `404 USER_ROLE_NOT_FOUND`

---

## 4. Settings

### `GET /operations/settings`
**Permission**: `settings:read`

**Response `data`**: `SettingDto[]`
```typescript
interface SettingDto {
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
}
```

---

### `PATCH /operations/settings/:key`
**Permission**: `settings:write`

**Body**:
```typescript
{ value: unknown }
```

**Response**: `200`
```typescript
interface SettingDto { key: string; value: unknown; updatedAt: string; }
```

**Errors**: `404 SETTING_NOT_FOUND`, `400 VALIDATION_ERROR`

---

## 5. Audit Logs

### `GET /operations/audit-logs`
**Permission**: `audit:read`

**Query Params**: `tableName?: string`, `action?: string`, `changedBy?: string`, `from?: string (ISO date)`, `to?: string (ISO date)`, `page?`, `limit?`

**Response `data`**: `AuditLogSummaryDto[]`
```typescript
interface AuditLogSummaryDto {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  changedBy: string | null;
  changedAt: string;
}
```

---

### `GET /operations/audit-logs/:id`
**Permission**: `audit:read`

**Response `data`**: `AuditLogDetailDto`
```typescript
interface AuditLogDetailDto {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedBy: string | null;
  changedAt: string;
}
```

**Errors**: `404 AUDIT_LOG_NOT_FOUND`, `400 VALIDATION_ERROR`

---

## 6. Reference Data

### `POST /operations/reference/:entity`
**Permission**: `reference:write`

**Body**: Entity-specific (see `data-model.md` entity map). At minimum: `nameEn: string`, `nameAr: string`, plus required parent FKs.

**Response**: `201 Created`
```typescript
{ id: string; nameEn: string; nameAr: string; isActive: boolean; }
```

**Errors**: `400 INVALID_ENTITY`, `400 VALIDATION_ERROR`, `400 INVALID_COUNTRY` (Cities), `409 REFERENCE_DUPLICATE`

---

### `PATCH /operations/reference/:entity/:id`
**Permission**: `reference:write`

**Body**: Partial entity fields, e.g. `{ isActive: false }` or `{ nameEn: "Updated" }`

**Response**: `200` with updated entity object.

**Errors**: `400 INVALID_ENTITY`, `404 REFERENCE_NOT_FOUND`, `400 VALIDATION_ERROR`

---

## 7. Documents

### `GET /operations/documents`
**Permission**: `documents:read`

**Query Params**: `userId?: string`, `documentTypeId?: string`, `page?`, `limit?`

**Response `data`**: `DocumentSummaryDto[]`
```typescript
interface DocumentSummaryDto {
  id: string;
  userId: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  documentTypeId: string;
  createdAt: string;
}
```

---

### `GET /operations/documents/:id`
**Permission**: `documents:read`

**Response `data`**: `DocumentDetailDto`
```typescript
interface DocumentDetailDto {
  id: string;
  userId: string;
  displayName: string;
  storagePath: string;  // NOT exposed; omit from response DTO
  mimeType: string;
  sizeBytes: number;
  documentTypeId: string;
  createdAt: string;
  updatedAt: string | null;
}
```

> **Note**: `storagePath` must NOT appear in the API response. It is internal.

**Errors**: `404 DOCUMENT_NOT_FOUND`, `400 VALIDATION_ERROR`

---

### `GET /operations/documents/:id/download`
**Permission**: `documents:read`

**Response `data`**:
```typescript
{ url: string; expiresIn: number; }  // expiresIn: 900 (seconds)
```

**Errors**: `404 DOCUMENT_NOT_FOUND`

---

### `DELETE /operations/documents/:id`
**Permission**: `documents:delete`

**Response**: `204 No Content`

**Errors**: `404 DOCUMENT_NOT_FOUND`, `500 STORAGE_DELETE_FAILED`
