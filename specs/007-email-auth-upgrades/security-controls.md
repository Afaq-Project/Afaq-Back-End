# Security Controls — Email Module & Auth Upgrades

## Control Register

| ID | Control | Location (File / Layer) | Enforcement Mechanism | Verification Test |
|:---|:---|:---|:---|:---|
| SC-001 | Unverified accounts cannot authenticate | Auth Controller / Service | Explicit `isEmailVerified` check before issuing tokens; returns `403 AUTH_EMAIL_NOT_VERIFIED` | ST-001 |
| SC-002 | Verification and reset tokens are strictly single-use | Auth Service / Redis | Atomic `DEL` on token keys immediately upon use; prevents replay | ST-002 |
| SC-003 | New token requests invalidate prior tokens | Auth Service / Redis | `vt:current:{userId}` / `prt:current:{userId}` pointer overwrites | ST-003 |
| SC-004 | Email-scoped rate limiting (1 request / minute) | `EmailRateLimitGuard` | Redis-backed sliding window per email address, bypassing IP limits | ST-004, ST-005 |
| SC-005 | Prevent user enumeration on recovery endpoints | Auth Controller | Generic success response regardless of email existence | ST-006, ST-007 |
| SC-006 | Active JWT invalidation via Token Versioning | `JwtStrategy` / Redis | Compare JWT `tokenVersion` claim with Redis `tv:{userId}`; reject if mismatched | ST-008 |
| SC-007 | Refresh token revocation on credential changes | Auth Service | Delete all refresh token sessions for the user on reset/forced-reset | ST-009 |
| SC-008 | Require current password for authenticated changes | Auth Controller | bcrypt compare `currentPassword` before update | ST-010 |
| SC-009 | Ephemeral storage of tokens with strict TTL | Redis | 24h TTL for verification; 1h TTL for reset | ST-011 |
| SC-010 | Admin forced-reset locks account until self-recovery | Auth Service / Controller | `passwordResetRequired` boolean checked at login; returns `403 AUTH_PASSWORD_RESET_REQUIRED` | ST-012 |

## Authentication Bypass Prevention
SC-001 ensures registration provides zero access until the email is verified, fully closing the unverified-access gap.

## Token Replay & Lifecycle
SC-002, SC-003, and SC-009 ensure tokens cannot be reused, intercepted post-consumption, or accumulated.

## Enumeration & Abuse
SC-004 and SC-005 prevent attackers from scanning for valid accounts or flooding inboxes, explicitly tracking by email rather than IP.

## JWT Revocation
SC-006 is a critical architectural upgrade. By injecting `tokenVersion` into JWTs and checking it against a Redis counter, the system can instantly invalidate "stateless" JWTs during a forced reset (SC-010), closing the natural expiry window vulnerability.
