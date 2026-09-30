# Security Testing — Email Module & Auth Upgrades

This document verifies the controls defined in `security-controls.md`.

## Security Test Register

| ID | Control Ref | Test Case | Expected Result | Layer |
|:---|:---|:---|:---|:---|
| ST-001 | SC-001 | Attempt login with valid credentials but unverified email | `403 AUTH_EMAIL_NOT_VERIFIED` and no tokens returned | E2E |
| ST-002 | SC-002 | Token Replay: Attempt to consume a verification/reset token twice | First attempt succeeds (`200`); second attempt fails (`400 AUTH_TOKEN_INVALID`) | E2E |
| ST-003 | SC-003 | Request reset token A, request reset token B, attempt to use A | Request A fails (`400 AUTH_TOKEN_INVALID`), request B succeeds | E2E |
| ST-004 | SC-004 | Email-scoped Rate Limit: Request `forgot-password` twice in 60s for the same email | Second request returns `429 THROTTLE_EXCEEDED` | E2E |
| ST-005 | SC-004 | Email-scoped Rate Limit Bypass: Request `forgot-password` for two different emails from the same IP within 60s | Both requests succeed (`200`), proving rate limit is email-scoped, not strictly IP-scoped | E2E |
| ST-006 | SC-005 | User Enumeration: Request `forgot-password` for an unregistered email | Returns `200` generic success message, identical to a registered email response | E2E |
| ST-007 | SC-005 | User Enumeration: Request `resend-verification` for an unregistered email | Returns `200` generic success message | E2E |
| ST-008 | SC-006 | JWT Invalidation: Trigger forced-reset, then use an existing active access token | `401 UNAUTHORIZED` due to `tokenVersion` mismatch | E2E |
| ST-009 | SC-007 | Refresh Revocation: Use a refresh token after a successful password reset | `401 UNAUTHORIZED`, refresh session is revoked | E2E |
| ST-010 | SC-008 | Authenticated Change: Change password with incorrect `currentPassword` | `400 AUTH_CURRENT_PASSWORD_INCORRECT` | E2E |
| ST-011 | SC-009 | Token Expiry: Attempt to use a verification token older than 24 hours | `400 AUTH_TOKEN_INVALID` (simulated by TTL expiry) | Integration |
| ST-012 | SC-010 | Forced Reset Lockout: Attempt login after an admin forced reset | `403 AUTH_PASSWORD_RESET_REQUIRED` and no tokens returned | E2E |

## Token Replay Attacks
ST-002 and ST-003 explicitly prove that a token cannot be stolen and reused after consumption, nor can an old token be used if a new one was requested.

## Authentication Bypass
ST-001 asserts the hard verification gate.

## Email-Scoped Limits
ST-004 and ST-005 verify that attackers cannot bypass the rate limit by rotating IPs, nor are legitimate distinct users blocked if they share a NAT IP.

## Token Versioning (JWT Invalidation)
ST-008 is the critical test for the stateless JWT revocation mechanism. It proves that the auth system can forcibly evict active sessions mid-flight by incrementing the token version.
