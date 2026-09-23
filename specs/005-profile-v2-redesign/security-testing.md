# Security Testing — Profile Module v2 Redesign

This document verifies the controls in `security-controls.md`; it does not restate them. Cases marked **auth-spec gap** are required by the requested test outline but have no Profile v2 source behavior beyond the generic `401` rule, so their expected authentication semantics must be confirmed against the auth specification before implementation.

## Security Test Register

| ID | Control Ref | Test Case | Expected Result | Layer |
|:---|:---|:---|:---|:---|
| ST-001 | SC-001 | Protected profile route without token | `401 UNAUTHORIZED` | E2E |
| ST-002 | SC-001 | Protected route with malformed token | `401 UNAUTHORIZED` | E2E |
| ST-003 | SC-001 | Protected route with expired token | `401 UNAUTHORIZED` | E2E |
| ST-004 | SC-001 | Valid token for deleted/inactive user (**auth-spec gap**) | Assert `401` only after auth spec supplies user-status behavior | Integration |
| ST-005 | SC-002 | Login response and decoded token inspection | Response has only access/refresh tokens; JWT has no profile fields | E2E |
| ST-006 | SC-003, SC-004 | User A GETs User B education | `404 EDUCATION_NOT_FOUND`; service not reached when guard is isolated | Integration |
| ST-007 | SC-003, SC-004 | User A reads/updates/deletes User B test result | `404 TEST_RESULT_NOT_FOUND`; guard precedes service | Integration |
| ST-008 | SC-003, SC-004 | User A deletes User B special status/preference | Corresponding `404`; guard precedes service | Integration |
| ST-009 | SC-003, SC-004, SC-010 | User A downloads/deletes User B document | `404 DOCUMENT_NOT_FOUND`; no storage call | Integration |
| ST-010 | SC-003 | Send `userId` body/query attempt on protected mutation | `400 UNKNOWN_FIELD`; authority remains JWT-derived | E2E |
| ST-011 | SC-005 | Request each listed public reference endpoint without token | `200` for all 13 allowlisted paths | E2E |
| ST-012 | SC-006 | Send extra DTO field | `400 UNKNOWN_FIELD` | E2E |
| ST-013 | SC-006 | Send wrong type or missing required field | `400 VALIDATION_ERROR` | E2E |
| ST-014 | SC-006 | Send invalid UUID, date, score, pagination, or out-of-range field | Documented `400` error key | E2E |
| ST-015 | SC-007 | Exercise invalid FKs, duplicate records, limits, dates, GPA, score step/range | Exact documented 400/409 key per endpoint table | Unit, E2E |
| ST-016 | SC-008, SC-014 | Inspect success response DTO fields | No raw Prisma-only/internal fields; `password` never appears | E2E |
| ST-017 | SC-008, SC-014 | Force typed/unexpected error | Envelope contains documented key/status and no stack trace | Integration |
| ST-018 | SC-008 | Inspect document list/profile response | No file binary or stored signed URL is returned | E2E |
| ST-019 | SC-009 | Upload MIME outside allowed list | `400 INVALID_MIME_TYPE` | E2E |
| ST-020 | SC-009 | Upload at max byte limit / one byte over | At limit accepted; over `400 FILE_TOO_LARGE` | Unit, E2E |
| ST-021 | SC-009 | Upload declared type whose inspected content differs | `400 DOCUMENT_TYPE_MISMATCH`; no accepted record | Unit, E2E |
| ST-022 | SC-009 | Upload missing file, invalid type, malicious/path-traversal display name | Missing/type exact errors; filename behavior is **spec gap**—no filename rejection requirement is declared | E2E |
| ST-023 | SC-010 | Owner requests document download URL | Fresh authenticated signed URL has `expiresIn: 900`; not persisted | Unit, E2E |
| ST-024 | SC-011 | Storage delete throws | `500 STORAGE_DELETE_FAILED`; DB record remains | Unit, E2E |
| ST-025 | SC-011 | Storage delete succeeds | `204`; DB row hard-deleted and no recalculation | Unit, E2E |
| ST-026 | SC-011 | DB delete fails after storage success | No successful response; assert implementation handles potential orphan according to DEC-PROF-09 (**failure compensation is not specified**) | Unit |
| ST-027 | SC-012 | Start application with required environment variable missing | Startup fails descriptively | Integration |
| ST-028 | SC-012 | SystemSettings key missing/unparseable | Code fallback is used; application does not fail | Unit |
| ST-029 | SC-012, SC-014 | Static grep/log-capture test around secrets/tokens/PII | No secret in source logs or emitted log payloads | Static, Integration |
| ST-030 | SC-013 | Auth password persistence/comparison inspection | bcrypt hash used; plaintext never stored/compared | Unit |
| ST-031 | SC-014 | Sweep authenticated and public success/error responses | No password, token, raw JWT, PII log leak, stack trace, or unspecified internal model | E2E |
| ST-032 | SC-015 | Mutation audit/log capture | Change event is recorded without passwords/tokens/raw JWT/PII | Integration |

## Authentication Tests

ST-001–005 cover missing, malformed, expired, deleted/inactive (**auth-spec gap**), and valid token payload behavior for SC-001–002.

## Authorization Tests

ST-006–011 cover cross-user access and modification, JWT-derived authority, and every declared public endpoint for SC-003–005.

## Input Validation Tests

ST-012–015 cover extra fields, wrong/missing types, out-of-range values, and Profile v2 domain validation for SC-006–007.

## Ownership Guard Tests

ST-006–009 cover each declared ownership guard’s mismatch → `404` behavior and assert, in isolated integration coverage, that it executes before the service.

## File Upload Security Tests

ST-019–022 cover MIME, at/over size boundary, content mismatch, and the undeclared filename-policy gap for SC-009.

## Storage-First Deletion Tests

ST-024–026 cover failure-preserves-record, success-hard-deletes, and the explicitly unspecified DB-failure-after-storage-success case for SC-011.

## Secrets & Configuration Tests

ST-027–030 cover fail-fast required configuration, fallbacks, log hygiene, and bcrypt for SC-012–013.

## Data Exposure Tests

ST-016–018, ST-029, and ST-031 cover DTO-only responses, no raw models, no stacks, and no password/token exposure for SC-008 and SC-014.

## Required Coverage Notes

- The test IDs cover every SC-001 through SC-015 at least once.
- The guarded endpoint matrix is ST-006–009; each checks mismatch → `404` and guard-before-service behavior.
- File upload and deletion security is ST-019–026 and maps to EC-043–053.
- The requested rate-limit, CORS, dependency-scan, deleted-user/inactive-user, path-traversal filename, and DB-delete-after-storage-failure checks have no Profile v2 requirement. They are surfaced above as gaps rather than silently converted into acceptance criteria.
