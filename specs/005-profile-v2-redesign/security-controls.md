# Security Controls — Profile Module v2 Redesign

Controls below are traceable to the Constitution, Profile v2 artifacts, and finalized decisions. “Not specified” sections deliberately do not introduce requirements.

## Control Register

| ID | Control | Location (File / Layer) | Enforcement Mechanism | Verification Test |
|:---|:---|:---|:---|:---|
| SC-001 | Require valid JWT on every non-`@Public()` route (Constitution V; endpoints auth convention) | Global auth guard; profile controllers | Passport/JWT guard; `401 UNAUTHORIZED` | ST-001–004 |
| SC-002 | Keep auth responses and JWT payload profile-free (DEC-AUTH-04–05) | Auth DTO/processor layer | Tokens-only response; payload stable account fields only | ST-005 |
| SC-003 | Derive ownership identity only from JWT (Constitution V) | Ownership-guard layer | `req.user.id`; never request `userId` | ST-006–010 |
| SC-004 | Hide resource existence across users (endpoints ownership rules) | Education/TestResult/SpecialStatus/Preference/Document ownership guards | Foreign resource resolves to `404`, not `403` | ST-006–010 |
| SC-005 | Allow only the documented reference routes without JWT (FR-037; DEC-PROF-16; endpoints) | Reference controllers | `@Public()` allowlist: `/reference/countries`, `/cities`, `/marital-statuses`, `/education-levels`, `/app-languages`, `/major-categories`, `/majors`, `/institutions`, `/languages`, `/proficiency-levels`, `/standardized-tests`, `/special-statuses`, `/document-types` | ST-011 |
| SC-006 | Reject unknown and malformed request data (Constitution IV; endpoints validation) | Global `ValidationPipe`; DTOs | `whitelist: true`, `forbidNonWhitelisted: true`; `400 UNKNOWN_FIELD`/`VALIDATION_ERROR` | ST-012–014 |
| SC-007 | Validate master FKs and domain constraints before write (FR-014–032; endpoints) | Profile service layer | Typed errors for invalid IDs, dates, score range/step, duplicate/limits | ST-015 |
| SC-008 | Shape every response and error explicitly (Constitution IV, IX; endpoints convention) | Controllers, DTOs, GlobalExceptionFilter | No raw Prisma models; uniform envelope; no stack traces | ST-016–018 |
| SC-009 | Constrain document uploads (FR-033–033c; endpoints §6) | Documents service + StorageService adapter | Required file/type, configurable byte/MIME whitelist, content inspection, count limit | ST-019–022 |
| SC-010 | Keep document access owner-only and time-bounded (FR-036; endpoints §6) | DocumentOwnershipGuard + StorageService | Authenticated owner only; on-demand signed URL with 900-second expiry | ST-009, ST-023 |
| SC-011 | Delete documents storage-first and permanently (FR-034–035; DEC-PROF-09–10) | Documents service + StorageService | Delete storage before DB; preserve DB on storage failure; hard-delete on success | ST-024–026 |
| SC-012 | Keep secrets/configuration out of source and logs; fail fast for required configuration (Constitution V, X) | Config module / `ConfigService` / `.env.example` | Environment-backed, startup validation; no direct service/controller `process.env`; no secret logs | ST-027–029 |
| SC-013 | Hash and compare passwords with bcrypt only (Constitution V) | Auth service | bcrypt; plaintext storage/comparison forbidden | ST-030 |
| SC-014 | Exclude passwords, tokens, raw JWT payloads, PII, internal errors, and storage binary from logs/responses (Constitution IV, IX) | DTO/controller/filter/logger layer | Explicit DTOs; GlobalExceptionFilter; Logger restrictions | ST-016–018, ST-029, ST-031 |
| SC-015 | Record data changes without logging prohibited sensitive data (Constitution IX; complete-schema ChangeLog) | Audit/ChangeLog schema and logging layer | ChangeLog records mutation context; Constitution IX exclusions apply | ST-032 |

## Authentication

SC-001 and SC-002 are the declared authentication controls. JWT issuance/validation is Constitution V; endpoints define missing/invalid/expired token behavior. The Profile v2 artifacts do not define token expiry values, refresh endpoint behavior, deleted-user behavior, or inactive-user behavior; those cases must be traced to the auth-module specification before implementation, rather than invented here.

## Authorization

SC-003–005 cover identity derivation, ownership hiding, and the exact public allowlist. Guarded routes are education `:id`, test-result `:id`, special-status deletion, preference deletion, and document `:id` download/delete (endpoints §§2, 4–6).

## Input Validation

SC-006 and SC-007 apply the Constitution IV pipe configuration and Profile v2 DTO/domain rules.

## Output Sanitization

SC-008 and SC-014 require DTO-shaped envelopes and prevent raw Prisma models, stacks, and prohibited data exposure (Constitution IV and IX).

## Rate Limiting

No Profile v2 source artifact declares rate limits for auth, upload, password reset, or any other route. This baseline adds none.

## File Upload Security

SC-009 requires byte/MIME/type/count checks and actual-content verification, not declaration-only trust (FR-033–033c).

## Storage-First Deletion

SC-011 follows DEC-PROF-09: storage removal precedes DB deletion so storage failure leaves a recoverable record instead of an unreachable orphan.

## Secrets Management

SC-012 is Constitution V and X: environment/config service only, startup validation, and no secret logging.

## Password Handling

SC-013 is Constitution V’s bcrypt-only rule.

## Data Exposure Prevention

SC-014 applies the explicit exclusions in Constitution IV and IX; it does not add undeclared field rules.

## CORS

No Profile v2 source declares allowed origins or exposed headers. This baseline adds no CORS acceptance criterion.

## Audit Logging

SC-015 covers ChangeLog while retaining Constitution IX exclusions.

## Dependency Security

No Profile v2 source declares scanning/updating policy. This baseline adds none.

## Compliance Mapping

No compliance standard (including GDPR) is declared in the Profile v2 sources; data-minimization claims must not be expanded beyond explicit DTO/output and log-exclusion rules.
