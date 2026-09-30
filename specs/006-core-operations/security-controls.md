# Security Controls — Core Operations Module (Admin v1)

Controls below are traceable to the Constitution, `spec.md`, `endpoints.md`, and finalized clarification decisions. "Not specified" sections deliberately do not introduce requirements.

---

## Control Register

| ID | Control | Location (File / Layer) | Enforcement Mechanism | Verification Test |
|:---|:---|:---|:---|:---|
| SC-OPS-001 | Require valid JWT on every `/operations/*` route | Global auth guard; operations controllers | Passport/JWT guard; `401 UNAUTHORIZED` | ST-001–004 |
| SC-OPS-002 | Enforce fine-grained permission guard per endpoint (e.g., `users:read`, `documents:delete`) | `PermissionsGuard`; `@Permissions()` decorator on each controller method | Guard rejects with `403 FORBIDDEN` before reaching the service | ST-005–007 |
| SC-OPS-003 | Derive acting admin identity only from JWT; never accept `actorId` or `changedBy` from request body | Service layer / audit logging layer | `req.user.id` is the only authority; DTO whitelist rejects body fields | ST-008 |
| SC-OPS-004 | Suspend/deleted users cannot obtain new access tokens | Auth refresh flow; `isActive` and `deletedAt` checks on token refresh | Guard reads user state from DB on each refresh; returns `401` if `isActive: false` or `deletedAt` is set | ST-009–010 |
| SC-OPS-005 | Reject unknown and malformed request data on all mutation endpoints | Global `ValidationPipe`; per-endpoint DTOs | `whitelist: true`, `forbidNonWhitelisted: true`; `400 UNKNOWN_FIELD` / `VALIDATION_ERROR` | ST-011–012 |
| SC-OPS-006 | Bulk status update MUST be capped at 100 user IDs per request | Bulk status DTO (`@ArrayMaxSize(100)`) | `class-validator` rejects arrays > 100; `400 VALIDATION_ERROR` | ST-013 |
| SC-OPS-007 | Password reset MUST NOT expose raw or temporary passwords in the API response | Password reset service / DTO | Response contains only a confirmation message; token dispatched via email only | ST-014 |
| SC-OPS-008 | Force-logout invalidates the refresh token reference immediately | `OauthIdentities.refreshTokenRef` or Redis session store | Token reference cleared atomically; subsequent refresh calls return `401` | ST-015 |
| SC-OPS-009 | Document deletion MUST be storage-first; DB record preserved on storage failure | Documents service + StorageService adapter | Storage delete precedes DB delete; `500 STORAGE_DELETE_FAILED` preserves DB record | ST-016–017 |
| SC-OPS-010 | Admin document download bypasses user-ownership guard but requires admin permission | Documents service / admin controller path | `documents:read` permission guard used; no `DocumentOwnershipGuard` on the admin download route | ST-018 |
| SC-OPS-011 | Audit log entries MUST record `oldData`, `newData`, and the acting admin's UUID; MUST NOT log passwords, tokens, or PII | `ChangeLog` service / audit interceptor | Sensitive field exclusion applied before persisting; Constitution IX | ST-019–020 |
| SC-OPS-012 | Master data deactivation hides records from public endpoints but does not break existing profile FK references | Reference data service / public reference controller | `isActive: false` filter applied on public queries; no cascade delete or nullification of profile FKs | ST-021 |
| SC-OPS-013 | Shape every response and error explicitly; no raw Prisma models or stack traces | Controllers, DTOs, `GlobalExceptionFilter` | Explicit response DTOs; uniform error envelope; no `prisma.` internals exposed | ST-022–023 |
| SC-OPS-014 | Keep secrets out of source and logs; fail fast on missing required configuration | `ConfigService`; `.env.example`; startup validation | No `process.env` direct access in services/controllers; startup validation per Constitution X | ST-024 |
| SC-OPS-015 | Audit log READ operations (`GET`) MUST NOT create `ChangeLog` entries | Service layer / audit interceptor scoping | Interceptor or annotation restricts logging to mutating operations only | ST-025 |

---

## Authentication

SC-OPS-001 and SC-OPS-004 cover the JWT requirement and the behavior for suspended/deleted users. Token issuance and refresh behavior follows the auth-module specification. The operations module does not manage token creation — it relies on the shared auth guard.

## Authorization

SC-OPS-002–003 cover permission-guard enforcement and JWT-derived identity. The permission guard (`PermissionsGuard`) must execute **before** any service call. Admin self-modification (SC-OPS-002 does not block it) is explicitly permitted per `Session 2026-09-27`.

## Bulk Operation Safety

SC-OPS-006 addresses the risk of unbounded write operations. The 100-record cap is enforced at the DTO validation layer, preventing any service-level processing of oversized payloads.

## Password & Session Security

SC-OPS-007 ensures the admin-triggered password reset flow follows the same secure email-token pattern as the self-service reset flow. SC-OPS-008 ensures the force-logout is immediate at the token-store level, not deferred.

## Storage-First Deletion

SC-OPS-009 follows the same principle established in Feature 005 (DEC-PROF-09): storage removal precedes DB deletion, so a storage failure leaves a recoverable database record instead of an unreachable orphan file.

## Audit Integrity

SC-OPS-011 and SC-OPS-015 together ensure the `ChangeLog` is complete for mutations, clean of sensitive data, and not polluted by read operations.

## Rate Limiting

No rate-limit requirements are declared in `spec.md` for the `/operations/*` namespace. This baseline adds none.

## CORS

No CORS-specific requirements are declared for the operations module. This baseline adds none.

## Compliance Mapping

No compliance standard is declared in this feature's sources. Data-minimization requirements do not extend beyond the explicit DTO/output and log-exclusion rules defined in Constitution IX and SC-OPS-011.
