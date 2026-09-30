# Edge Cases — Email Module & Authentication Upgrades

This is the acceptance edge-case inventory. Sources are limited to `spec.md` and `data-model.md`.

## Email Verification

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-001 | Unverified user attempts login | `401 AUTH_EMAIL_NOT_VERIFIED` returned; no tokens issued | FR-029; spec User Story 1 | ☐ |
| EC-002 | Token expiration mid-flight | If token expires while user is loading or submitting verification, returns `400 INVALID_OR_EXPIRED_TOKEN` | FR-007 | ☐ |
| EC-003 | Rapid concurrent resend requests | First request succeeds; subsequent requests within 1 minute return `429 TOO_MANY_REQUESTS`; token from first request remains valid | FR-010 | ☐ |
| EC-004 | Replay attack on consumed token | Second attempt on a consumed verification token returns `400 INVALID_OR_EXPIRED_TOKEN`; tokens are hard-deleted on first use | FR-009; data-model §2.1 | ☐ |
| EC-005 | User clicks older verification link after resending | Previous token was explicitly invalidated on new request; returns `400 INVALID_OR_EXPIRED_TOKEN` | FR-010; data-model §2.1 | ☐ |
| EC-006 | Registration, verification, or login with mixed-casing email | System normalizes/lowercases email to ensure reliable match regardless of input case | spec implicitly | ☐ |

## Password Reset & Change

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-007 | Forgot password requested for unregistered email | `200 OK` with neutral message; no email sent; prevents enumeration | FR-012 | ☐ |
| EC-008 | User submits multiple password reset requests | First request succeeds; subsequent within 1 minute return `429 TOO_MANY_REQUESTS`; token from first request remains valid | FR-011 | ☐ |
| EC-009 | Forgot password requested for SSO-only account | Neutral `200 OK` response or graceful omission; no enumeration leak | FR-012; spec User Story 2 | ☐ |
| EC-010 | Authenticated password change with wrong current password | `400 INVALID_CURRENT_PASSWORD`; no hash update; session remains active | FR-019 | ☐ |
| EC-011 | New password does not meet complexity rules | `400 VALIDATION_ERROR` (weak password) before any hash comparison | FR-021 | ☐ |
| EC-012 | New password and confirmation do not match | `400 VALIDATION_ERROR` (passwords do not match) before any hash comparison | FR-020 | ☐ |
| EC-013 | Authenticated password change on SSO-only account | `400 CANNOT_CHANGE_SSO_PASSWORD` explicitly rejecting request | FR-023 | ☐ |

## Forced Reset & Session Invalidation

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-014 | Forced reset triggered for an active user | `passwordResetRequired` set true; `tokenVersion` increments; active sessions immediately fail JWT validation | FR-024, FR-025 | ☐ |
| EC-015 | Forced reset applied to an SSO-only account | Clear status returned to caller (not applicable); no change to account | FR-028 | ☐ |
| EC-016 | User with forced reset attempts standard login | `401 PASSWORD_RESET_REQUIRED` returned instead of invalid credentials; no token issued | FR-026 | ☐ |
| EC-017 | Forced reset occurs while user actively changing password | If forced reset increments `tokenVersion` first, password change fails (JWT invalid). If password change finishes first, forced reset invalidates the *new* password and sessions | FR-025; data-model §2.3 | ☐ |
| EC-018 | User with forced reset completes email-based password reset | New password set; `passwordResetRequired` becomes false; `passwordResetRequiredAt` cleared; all active sessions revoked | data-model §1.1; FR-015 | ☐ |
| EC-019 | Forced reset applied to user who already requested a reset token | Forced flag is set. User can complete reset using their pending email link, which successfully clears the forced state | data-model §1.1 | ☐ |

## Mail Infrastructure & Integration

| ID | Scenario | Expected Behavior | Source | Covered by Test |
|:---|:---|:---|:---|:---:|
| EC-020 | SMTP server unreachable at application startup | Application continues starting gracefully; email dispatch fails later when explicitly invoked | spec Edge Cases | ☐ |
| EC-021 | Email dispatch fails during registration or forgot-password | Error logged; exception bubbles up resulting in `500 INTERNAL_SERVER_ERROR` | spec User Story 4 | ☐ |
| EC-022 | Development mode (`MAIL_PREVIEW=true`) | Emails captured locally (e.g., Mailpit); no external SMTP connections attempted | FR-004 | ☐ |
