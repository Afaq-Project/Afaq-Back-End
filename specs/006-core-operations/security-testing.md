# Security Testing — Core Operations Module (Admin v1)

This document verifies the controls in `security-controls.md`; it does not restate them.

---

## Security Test Register

| ID | Control Ref | Test Case | Expected Result | Layer |
|:---|:---|:---|:---|:---|
| ST-001 | SC-OPS-001 | Request any `/operations/*` route without a token | `401 UNAUTHORIZED` | E2E |
| ST-002 | SC-OPS-001 | Request with a malformed/corrupted JWT | `401 UNAUTHORIZED` | E2E |
| ST-003 | SC-OPS-001 | Request with an expired JWT | `401 UNAUTHORIZED` | E2E |
| ST-004 | SC-OPS-001, SC-OPS-004 | Token belonging to a suspended (`isActive: false`) user used after suspension | `401 UNAUTHORIZED` on next token refresh; current access token expires naturally | Integration |
| ST-005 | SC-OPS-002 | Authenticated user without `users:read` calls `GET /operations/users` | `403 FORBIDDEN`; service not reached | Integration |
| ST-006 | SC-OPS-002 | Authenticated user without `documents:delete` calls `DELETE /operations/documents/:id` | `403 FORBIDDEN`; no storage call made | Integration |
| ST-007 | SC-OPS-002 | Authenticated user without `reference:write` calls `POST /operations/reference/:entity` | `403 FORBIDDEN` | Integration |
| ST-008 | SC-OPS-003 | Send `changedBy` or `actorId` in the request body of any mutation endpoint | `400 UNKNOWN_FIELD`; audit log uses JWT identity | E2E |
| ST-009 | SC-OPS-004 | Token refresh attempted after admin sets user to `isActive: false` | `401 UNAUTHORIZED` on refresh | Integration |
| ST-010 | SC-OPS-004 | Login attempted by a user whose `deletedAt` is set | `401 UNAUTHORIZED` | Integration |
| ST-011 | SC-OPS-005 | Send an undeclared extra field on `PATCH /operations/users/:id/status` | `400 UNKNOWN_FIELD` | E2E |
| ST-012 | SC-OPS-005 | Send `isActive` as a string (`"false"`) instead of boolean | `400 VALIDATION_ERROR` | E2E |
| ST-013 | SC-OPS-006 | `PATCH /operations/users/bulk/status` with 101 user IDs | `400 VALIDATION_ERROR`; no records updated | Unit, E2E |
| ST-014 | SC-OPS-007 | `POST /operations/users/:id/password-reset` — inspect API response body | Response contains only a success message; no token or password returned | E2E |
| ST-015 | SC-OPS-008 | `POST /operations/users/:id/force-logout` — verify token invalidation | Subsequent token refresh by the target user returns `401` | Integration |
| ST-016 | SC-OPS-009 | `DELETE /operations/documents/:id` — storage provider throws | `500 STORAGE_DELETE_FAILED`; DB record remains; no orphaned file cleanup attempted after failure | Unit, E2E |
| ST-017 | SC-OPS-009 | `DELETE /operations/documents/:id` — storage succeeds | `204`; DB record hard-deleted; storage call precedes DB delete in execution order | Unit, E2E |
| ST-018 | SC-OPS-010 | Admin calls `GET /operations/documents/:id/download` — verify no `DocumentOwnershipGuard` is triggered | `200`; signed URL returned; ownership guard is bypassed; `documents:read` permission guard is the only gate | Integration |
| ST-019 | SC-OPS-011 | Admin suspends a user — inspect `ChangeLog` entry | Entry has `oldData`, `newData`, and `changedBy` equal to the admin's UUID | Integration |
| ST-020 | SC-OPS-011 | `ChangeLog` entry for user update — inspect `oldData`/`newData` for sensitive fields | No `password`, JWT tokens, or PII fields (beyond UUID/email if explicitly included) appear in log payloads | Integration |
| ST-021 | SC-OPS-012 | Deactivate an Institution; then call the public `GET /reference/institutions` endpoint | Deactivated institution does not appear in public response; `UserEducations` FK still resolves when fetching the user's education | Integration |
| ST-022 | SC-OPS-013 | Force an internal service error on any `/operations/*` endpoint | Response envelope is `{ statusCode: 500, message: "...", error: "...", timestamp: "..." }`; no stack trace or Prisma internals | Integration |
| ST-023 | SC-OPS-013 | Sweep all success responses from operations endpoints | No raw Prisma model fields (e.g., `_count`, raw join objects) exposed; only explicit DTO fields | E2E |
| ST-024 | SC-OPS-014 | Static grep of operations module source files | No `process.env` direct access in service or controller files; no hardcoded secrets or tokens | Static |
| ST-025 | SC-OPS-015 | Admin calls `GET /operations/audit-logs` — inspect `ChangeLog` table before and after | No new `ChangeLog` entry is created for the read operation | Integration |

---

## Authentication Tests

ST-001–004 cover missing, malformed, expired, and suspended/deleted-user token behavior for SC-OPS-001 and SC-OPS-004.

## Permission Guard Tests

ST-005–007 cover per-endpoint guard enforcement for SC-OPS-002, verifying that `403 FORBIDDEN` is returned before the service is invoked.

## Identity Derivation Tests

ST-008 verifies SC-OPS-003: the acting admin identity is always derived from the JWT, never from the request body.

## Session Invalidation Tests

ST-009–010 and ST-015 cover force-logout and state-based lockout for SC-OPS-004 and SC-OPS-008.

## Input Validation Tests

ST-011–013 cover extra fields, wrong types, and the bulk cap limit for SC-OPS-005 and SC-OPS-006.

## Password Reset Security Tests

ST-014 covers response hygiene for the admin-triggered password reset for SC-OPS-007.

## Storage-First Deletion Tests

ST-016–017 cover failure-preserves-record and success-hard-deletes for SC-OPS-009, mirroring the approach from Feature 005 EC-050/EC-052.

## Admin Document Access Tests

ST-018 verifies that the admin download route bypasses `DocumentOwnershipGuard` while still requiring the `documents:read` permission for SC-OPS-010.

## Audit Integrity Tests

ST-019–020 and ST-025 verify that mutations are logged with the correct actor, sensitive fields are excluded, and read operations do not generate log entries for SC-OPS-011 and SC-OPS-015.

## Master Data Isolation Tests

ST-021 verifies the deactivation isolation guarantee: hidden from public endpoints but FK-safe on existing user data for SC-OPS-012.

## Data Exposure Tests

ST-022–023 and ST-024 cover response shaping, error envelope hygiene, and source-level secret exclusion for SC-OPS-013 and SC-OPS-014.

---

## Required Coverage Notes

- Every SC-OPS-001 through SC-OPS-015 is covered by at least one ST entry.
- The permission guard matrix is ST-005–007; each checks guard-before-service behavior.
- Storage-first deletion is ST-016–017 and maps to EC-052–053.
- The admin document bypass is ST-018, mapping to EC-051.
- Rate limiting, CORS, dependency scanning, and filename path-traversal are not declared in the spec; they are not surfaced as acceptance criteria.
