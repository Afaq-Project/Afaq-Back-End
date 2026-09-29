# Edge Cases — Core Operations Module (Admin v1)

This is the acceptance edge-case inventory. Sources are limited to `spec.md` and `endpoints.md` for this feature.

---

## Auth & Permission Guard

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-001 | Request any `/operations/*` endpoint without a token | `401 UNAUTHORIZED`; no data exposed | endpoints auth convention; Constitution V | ☐ |
| EC-002 | Request any `/operations/*` endpoint with an expired or malformed token | `401 UNAUTHORIZED` | endpoints auth convention | ☐ |
| EC-003 | Authenticated user without the required permission guard (e.g., `users:read`) attempts access | `403 FORBIDDEN`; resource not reached | endpoints guard convention | ☐ |
| EC-004 | Token is valid but belongs to a suspended (`isActive: false`) user | `401 UNAUTHORIZED`; session cannot be refreshed | spec FR-006; auth module | ☐ |
| EC-005 | Token is valid but belongs to a soft-deleted (`deletedAt` set) user | `401 UNAUTHORIZED`; user locked out entirely | spec FR-004 | ☐ |

---

## Dashboard

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-006 | Dashboard stats requested with zero users in the database | Returns `{ total: 0, active: 0, matchable: 0, documents: 0 }` without error | spec FR-008 | ☐ |
| EC-007 | `matching.threshold` key is missing from `SystemSettings` | Fallback default of `60` is used; dashboard does not fail | spec FR-008; `system-settings.keys.ts` defaults | ☐ |
| EC-008 | `matching.threshold` key exists but contains an unparseable/invalid value | Fallback default of `60` is used; error is logged, dashboard does not fail | spec FR-008; Constitution X | ☐ |
| EC-009 | Dashboard stats include only active (non-deleted) users in the "total users" count | `deletedAt IS NULL` filter applied; soft-deleted users are excluded | spec FR-004, FR-008 | ☐ |

---

## User Management

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-010 | `GET /operations/users` with no filters | Paginated response with all non-deleted users returned | spec FR-001; endpoints §2 | ☐ |
| EC-011 | `GET /operations/users` with `search` matching no user | Empty paginated response `[]`; no error | spec FR-001; endpoints §2 | ☐ |
| EC-012 | `GET /operations/users/:id` for a non-existent or soft-deleted user UUID | `404 USER_NOT_FOUND` | endpoints §2 | ☐ |
| EC-013 | `GET /operations/users/:id` for an invalid UUID format | `400 VALIDATION_ERROR` | endpoints §2; Constitution IV | ☐ |
| EC-014 | Admin suspends an already-suspended user (`isActive` already `false`) | `200`; no error; idempotent — state remains `false` | spec FR-002; endpoints §2 | ☐ |
| EC-015 | Admin activates an already-active user (`isActive` already `true`) | `200`; no error; idempotent — state remains `true` | spec FR-002; endpoints §2 | ☐ |
| EC-016 | Admin suspends their own account | `200`; self-modification permitted; their current access token remains valid until expiry | spec FR-002; Session 2026-09-27 | ☐ |
| EC-017 | Admin soft-deletes an already soft-deleted user | `404 USER_NOT_FOUND`; no action taken | spec FR-004 | ☐ |
| EC-018 | Admin soft-deletes a user — verifies `deletedAt` is set and login is blocked | `200`; `deletedAt` timestamp is populated; subsequent login attempt returns `401` | spec FR-004; SC-002 | ☐ |
| EC-019 | `POST /operations/users/:id/password-reset` for a non-existent user ID | `404 USER_NOT_FOUND` | endpoints §2 | ☐ |
| EC-020 | `POST /operations/users/:id/password-reset` for a suspended user | `200`; reset email is still dispatched regardless of suspension state | spec FR-005 | ☐ |
| EC-021 | `POST /operations/users/:id/force-logout` for a user with no active session | `200`; no-op; no error | spec FR-006; endpoints §2 | ☐ |
| EC-022 | `POST /operations/users/:id/force-logout` for a non-existent user ID | `404 USER_NOT_FOUND` | endpoints §2 | ☐ |

---

## Bulk User Status

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-023 | Bulk status update with exactly 100 user IDs | `200`; all valid IDs are processed | spec FR-003; SC-007 | ☐ |
| EC-024 | Bulk status update with 101 user IDs | `400 VALIDATION_ERROR`; request rejected entirely before any update | spec FR-003; SC-007 | ☐ |
| EC-025 | Bulk status update with an empty `userIds` array | `400 VALIDATION_ERROR` | spec FR-003; Constitution IV | ☐ |
| EC-026 | Bulk status update where some IDs are valid and some are non-existent | Non-existent IDs are silently skipped; valid IDs are updated; `200` with partial-update summary | spec FR-003 | ☐ |
| EC-027 | Bulk status update with duplicate IDs in the array | Deduplication applied; each unique user updated once; `200` | spec FR-003 | ☐ |
| EC-028 | Bulk status update containing at least one invalid UUID format | `400 VALIDATION_ERROR`; entire request rejected | Constitution IV | ☐ |

---

## Role Assignment

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-029 | Assign a role that is already assigned to the user | `200` or `409 ROLE_ALREADY_ASSIGNED`; no duplicate pivot row created | endpoints §3 | ☐ |
| EC-030 | Assign a non-existent role ID to a user | `400 INVALID_ROLE` | endpoints §3 | ☐ |
| EC-031 | Revoke a role from a user who does not have that role | `404 USER_ROLE_NOT_FOUND` | endpoints §3 | ☐ |
| EC-032 | Admin assigns or modifies their own roles | `200`; self-modification is permitted | spec FR-007; Session 2026-09-27 | ☐ |

---

## System Settings

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-033 | `PATCH /operations/settings/:key` with a key that does not exist in the database | `404 SETTING_NOT_FOUND` (the setting must exist before it can be updated) | spec FR-012; endpoints §4 | ☐ |
| EC-034 | `PATCH /operations/settings/:key` with an invalid JSON value for a typed setting | `400 VALIDATION_ERROR` | spec FR-012; Constitution IV | ☐ |
| EC-035 | `PATCH /operations/settings/matching.threshold` with a value of `0` or `100` | Accepted and persisted; edge boundary values are valid | spec FR-008; endpoints §4 | ☐ |
| EC-036 | `PATCH /operations/settings/matching.threshold` with a negative value or value `> 100` | `400 VALIDATION_ERROR`; threshold must be a percentage (0–100) | spec FR-008 | ☐ |

---

## Audit Logs

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-037 | `GET /operations/audit-logs` with no filter returns paginated entries | `200`; all entries returned in reverse-chronological order by default | spec FR-014; endpoints §5 | ☐ |
| EC-038 | `GET /operations/audit-logs/:id` for a non-existent log ID | `404 AUDIT_LOG_NOT_FOUND` | endpoints §5 | ☐ |
| EC-039 | `GET /operations/audit-logs/:id` for an invalid UUID format | `400 VALIDATION_ERROR` | Constitution IV | ☐ |
| EC-040 | Admin performs an action via `/operations/*` — verify log entry is created | `ChangeLog` record is created with `oldData`, `newData`, and the acting admin's UUID as `changedBy` | spec FR-013; SC-005 | ☐ |
| EC-041 | Audit log entry `oldData`/`newData` must not contain raw passwords, tokens, or PII | Sensitive fields are excluded or redacted before logging | spec FR-013; Constitution IX | ☐ |

---

## Reference (Master) Data

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-042 | Create a new master data record with missing required field (`nameEn` or `nameAr`) | `400 VALIDATION_ERROR` | spec FR-009; Constitution IV | ☐ |
| EC-043 | Create a duplicate master data record (same `nameEn` and same parent) | `409 REFERENCE_DUPLICATE` | spec FR-009 | ☐ |
| EC-044 | Deactivate a master data record (`isActive: false`) | Record no longer appears in public reference endpoints; existing user profile data referencing it is unchanged | spec FR-010, FR-011; SC-004 | ☐ |
| EC-045 | Re-activate a master data record (`isActive: true`) | Record reappears in public reference endpoints | spec FR-010, FR-011 | ☐ |
| EC-046 | Update a master data record for a non-existent entity type (e.g., `/reference/foobar`) | `400 INVALID_ENTITY` or `404 NOT_FOUND` | endpoints §6 | ☐ |
| EC-047 | Update a master data record for a non-existent ID within a valid entity | `404 REFERENCE_NOT_FOUND` | endpoints §6 | ☐ |
| EC-048 | Create a `City` without supplying a valid `countryId` | `400 INVALID_COUNTRY` | spec FR-009; data model | ☐ |

---

## Document Oversight

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-049 | `GET /operations/documents` with no filters — returns all documents across all users | `200`; paginated list | spec FR-015; endpoints §8 | ☐ |
| EC-050 | `GET /operations/documents/:id` for a non-existent document ID | `404 DOCUMENT_NOT_FOUND` | endpoints §8 | ☐ |
| EC-051 | `GET /operations/documents/:id/download` generates a signed URL | `200`; signed URL returned with expiry; URL is not stored in DB | spec FR-016; endpoints §8 | ☐ |
| EC-052 | `DELETE /operations/documents/:id` — storage provider deletes successfully | `204`; DB record hard-deleted; no orphaned file | spec FR-017; SC-006 | ☐ |
| EC-053 | `DELETE /operations/documents/:id` — storage provider throws an error | `500 STORAGE_DELETE_FAILED`; DB record preserved for retry | spec FR-017; Session 2026-09-27 | ☐ |
| EC-054 | `DELETE /operations/documents/:id` — storage deletes but DB delete fails unexpectedly | No successful response returned; potential orphan scenario logged per Constitution IX | spec FR-017 | ☐ |
| EC-055 | `DELETE /operations/documents/:id` for a non-existent document ID | `404 DOCUMENT_NOT_FOUND` | endpoints §8 | ☐ |

---

## Cross-Cutting

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-056 | Send an unknown/extra DTO field on any mutation endpoint | `400 UNKNOWN_FIELD` | Constitution IV; ValidationPipe `forbidNonWhitelisted` | ☐ |
| EC-057 | Send wrong type (e.g., string for boolean `isActive`) | `400 VALIDATION_ERROR` | Constitution IV | ☐ |
| EC-058 | Internal service or database failure on any endpoint | Uniform `500 INTERNAL_ERROR`; no stack trace or raw Prisma output in response | Constitution IV, IX | ☐ |
| EC-059 | Inspect any success or error response envelope | Always matches `{ statusCode, message, data?, meta?, error?, timestamp }`; no raw model fields | endpoints convention; Constitution IV | ☐ |
| EC-060 | Audit log is NOT created when a read-only (`GET`) operation is performed | `ChangeLog` table has no new entry for `GET` requests | spec FR-013 | ☐ |
