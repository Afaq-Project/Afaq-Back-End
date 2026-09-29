# Core Operations Module (Admin v1) — Endpoints

**Suggested Module Name**: `Core Operations` (or `System Administration`). 
*Reasoning*: Naming the module based on its function (managing system data, master tables, users, and core configurations) clarifies its purpose. Functional endpoints belong to their respective domains and are protected by specific permission guards.

**Base URL**: `/api/v1/operations`
**Auth**: Bearer JWT required for all endpoints.
**Permissions**: Endpoints are protected by fine-grained permission guards (e.g., `@Permissions('users:manage')`, `@Permissions('reference:write')`), allowing flexible permission allocation across levels 1, 2, etc.
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

---

## Overview

| # | Method | Path | Auth/Guard | Purpose |
|:---:|:---:|:---|:---:|:---|
| **Dashboard** | | | | |
| 1 | `GET` | `/operations/dashboard/stats` | 🔒 `dashboard:read` | General statistics (user count, subscriptions, etc.) |
| **Users** | | | | |
| 2 | `GET` | `/operations/users` | 🔒 `users:read` | List and search user accounts |
| 3 | `GET` | `/operations/users/:id` | 🔒 `users:read` | Retrieve detailed user account & profile |
| 4 | `PATCH` | `/operations/users/:id/status` | 🔒 `users:write` | Enable/Disable (suspend) user account |
| 5 | `PATCH` | `/operations/users/bulk/status` | 🔒 `users:write` | Enable/Disable multiple accounts at once |
| 6 | `POST` | `/operations/users/:id/password-reset`| 🔒 `users:write` | Trigger password reset email flow |
| 7 | `POST` | `/operations/users/:id/force-logout` | 🔒 `users:write` | Invalidate active refresh tokens for the user |
| 8 | `DELETE` | `/operations/users/:id` | 🔒 `users:delete` | Soft delete user account | | 🔒 `users:write` | Invalidate active refresh tokens for the user |
| **Roles** | | | | |
| 9 | `GET` | `/operations/roles` | 🔒 `roles:read` | List available system roles |
| 10 | `POST` | `/operations/users/:id/roles` | 🔒 `roles:write` | Assign a role to a user |
| 11 | `DELETE` | `/operations/users/:id/roles/:roleId`| 🔒 `roles:write` | Revoke a role from a user |
| **Settings** | | | | |
| 12 | `GET` | `/operations/settings` | 🔒 `settings:read` | List system settings |
| 13 | `PATCH` | `/operations/settings/:key` | 🔒 `settings:write` | Update a specific system setting |
| **Audit** | | | | |
| 14 | `GET` | `/operations/audit-logs` | 🔒 `audit:read` | View system change logs |
| 15 | `GET` | `/operations/audit-logs/:id` | 🔒 `audit:read` | View specific audit log detail |
| 16 | `GET` | `/operations/audit-logs/export` | 🔒 `audit:read` | Export logs (CSV/Excel) |
| **Reference Data** | | | | |
| 17 | `POST` | `/operations/reference/:entity` | 🔒 `reference:write` | Create a new master data record |
| 18 | `PATCH` | `/operations/reference/:entity/:id` | 🔒 `reference:write` | Update/Deactivate a master data record |
| **Finance** | | | | |
| 19 | `GET` | `/operations/subscriptions` | 🔒 `finance:read` | List and search user subscriptions |
| 20 | `GET` | `/operations/payments` | 🔒 `finance:read` | List system payments |
| **Documents** | | | | |
| 21 | `GET` | `/operations/documents` | 🔒 `documents:read` | View all uploaded documents across users |
| 22 | `GET` | `/operations/documents/:id` | 🔒 `documents:read` | Document details metadata |
| 23 | `GET` | `/operations/documents/:id/download` | 🔒 `documents:read` | Download a specific document for review |
| 24 | `DELETE` | `/operations/documents/:id` | 🔒 `documents:delete`| Delete an inappropriate document |

---

## 1. Dashboard

### 1.1 `GET /api/v1/operations/dashboard/stats`
**Purpose**: Retrieve high-level metrics for the admin interface.
**Response**: Contains counts for total users, active subscriptions, total documents uploaded, etc.

---

## 2. User Management Endpoints

### 2.1 `GET /api/v1/operations/users`
**Purpose**: Retrieve a paginated, filterable list of users.
**Query Parameters**:
- `search`: String (searches email, firstName, lastName)
- `isActive`: Boolean
- `roleId`: Integer (filter by role)
- `page`, `limit`, `sort`, `order`

### 2.2 `GET /api/v1/operations/users/:id`
**Purpose**: Retrieve full details of a specific user, including their profile data, assigned roles, linked OAuth identities, and subscription status.

### 2.3 `PATCH /api/v1/operations/users/:id/status`
**Purpose**: Suspend or activate a user account.
**Body**: `{ "isActive": false, "reason": "Violation of terms" }`
**Note**: When a user is marked inactive, their persistent session tokens become invalid during the next token refresh check, essentially logging them out.

### 2.4 `PATCH /api/v1/operations/users/bulk/status`
**Purpose**: Suspend or activate multiple user accounts simultaneously.
**Body**: `{ "userIds": ["uuid1", "uuid2"], "isActive": false }`

### 2.5 `POST /api/v1/operations/users/:id/password-reset`
**Purpose**: Trigger a password reset email for a user.
**Implementation Detail**: The server will generate a secure reset token (e.g., standard forgot-password flow) and send an email to the user with a secure link to choose a new password. It does not return the new password in the API response.

### 2.7 `DELETE /api/v1/operations/users/:id`
**Purpose**: Perform a soft deletion of the user by setting the `deletedAt` timestamp.

### 2.6 `POST /api/v1/operations/users/:id/force-logout`
**Purpose**: Force an immediate invalidation of the user's active session.
**Implementation Detail**: This clears the user's active `refreshTokenRef` in the database or Redis store, preventing them from acquiring new short-lived access tokens. Once their current access token expires, they will be logged out.

---

## 3. Role & Access Management Endpoints

### 3.1 `GET /api/v1/operations/roles`
**Purpose**: Retrieve all available roles from the `Roles` table to populate admin dropdowns.

### 3.2 `POST /api/v1/operations/users/:id/roles`
**Purpose**: Assign a new role to a user.
**Body**: `{ "roleId": 2 }`

### 3.3 `DELETE /api/v1/operations/users/:id/roles/:roleId`
**Purpose**: Revoke a specific role from a user.

---

## 4. System Settings Management Endpoints

### 4.1 `GET /api/v1/operations/settings`
**Purpose**: List all system settings (e.g., profile completion weights, maximum upload sizes).

### 4.2 `PATCH /api/v1/operations/settings/:key`
**Purpose**: Update a specific system setting.

---

## 5. System Audit

### 5.1 `GET /api/v1/operations/audit-logs`
**Purpose**: View system-wide modifications (recorded in the `ChangeLog` table) to track which admin made what changes.

### 5.2 `GET /api/v1/operations/audit-logs/:id`
**Purpose**: Retrieve detailed information for a specific audit log entry, including full `oldData` and `newData` JSON payloads.

### 5.3 `GET /api/v1/operations/audit-logs/export`
**Purpose**: Export the filtered audit logs as a CSV or Excel file for compliance and external auditing.

---

## 6. Reference (Master) Data Management

The system relies on numerous master tables which are read-only for standard users but must be populated and maintained by admins. These include:
- `Countries` & `Cities`
- `Institutions`
- `MajorCategories` & `Majors`
- `EducationLevel`
- `MaritalStatuses`
- `SpecialStatuses`
- `StandardizedTests`
- `LanguagesMaster` & `ProficiencyLevels`
- `DocumentTypes` & `NotificationTypes`

### 6.1 `POST /api/v1/operations/reference/:entity`
**Purpose**: Create a new record in a specific reference table (e.g., `/operations/reference/institutions`).
**Body**: Entity-specific properties (e.g., `nameEn`, `nameAr`, `countryId`).

### 6.2 `PATCH /api/v1/operations/reference/:entity/:id`
**Purpose**: Partially update a reference record, most commonly used to **deactivate** a record by setting `isActive: false`.
**Body**: `{ "isActive": false, "nameEn": "Updated Name" }`
**Note**: We prefer deactivating (`isActive: false`) over hard-deleting reference data to preserve historical integrity in user profiles.

---

## 7. Financial Operations

### 7.1 `GET /api/v1/operations/subscriptions`
**Purpose**: List user subscriptions, filterable by status (`active`, `canceled`, `past_due`) and plan type. 

### 7.2 `GET /api/v1/operations/payments`
**Purpose**: View payment history, filterable by date, status, and user. Useful for auditing financial transactions.

---

## 8. Document Management

### 8.1 `GET /api/v1/operations/documents`
**Purpose**: View a global list of documents uploaded by users, filterable by `documentTypeId` and `userId`. Useful for auditing storage usage and reviewing uploaded content.

### 8.2 `GET /api/v1/operations/documents/:id`
**Purpose**: View detailed metadata for a specific document, such as size, MIME type, and creation date.

### 8.3 `GET /api/v1/operations/documents/:id/download`
**Purpose**: Generate a signed URL or stream the document file directly to the admin for review/auditing purposes.

### 8.4 `DELETE /api/v1/operations/documents/:id`
**Purpose**: Hard delete a document (both from the database and storage) if it violates terms of service or contains malicious content.
