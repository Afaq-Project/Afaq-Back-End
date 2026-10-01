# API Contracts: Email Module & Auth Upgrades

**Feature**: 007-email-auth-upgrades
**Date**: 2026-09-29
**Base URL**: `/auth`
**Envelope**: All responses follow `{ statusCode, message, data, timestamp }`

> **Auth notation**: 🔓 = public (`@Public()` decorator required). 🔒 = requires valid JWT (`JwtAuthGuard`).

---

## Modified Endpoints

### POST /auth/register — Modified

**Auth**: 🔓 Public
**Change**: Response no longer returns tokens. Returns acknowledgment only.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "Secure123",
  "firstName": "Ahmad",
  "lastName": "Al-Sayed"
}
```

**Response — 201 Created**:
```json
{
  "success": true,
  "status": 201,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Error Cases**:
| Status | Code | Condition |
|:---|:---|:---|
| 409 | `AUTH_EMAIL_TAKEN` | Email already registered |
| 400 | `VALIDATION_ERROR` | Invalid email, weak password, missing fields |

---

### POST /auth/login — Modified

**Auth**: 🔓 Public
**Change**: Two new rejection states added on top of existing invalid-credentials rejection.

**Request Body**: *(unchanged)*

**New Error Cases** (in addition to existing `401 AUTH_INVALID_CREDENTIALS`):
| Status | Code | Condition |
|:---|:---|:---|
| 403 | `AUTH_EMAIL_NOT_VERIFIED` | Correct credentials but email not verified |
| 403 | `AUTH_PASSWORD_RESET_REQUIRED` | Admin-forced reset is pending; user must reset password |

**Successful response**: *(unchanged — returns accessToken + refreshToken)*

---

## New Endpoints

### GET /auth/verify-email — New

**Auth**: 🔓 Public
**Rate Limit**: Global IP throttle only (no per-email limit needed — token is required)
**Purpose**: Consume a verification token from an email link and mark the account as verified.

**Query Parameters**:
| Param | Type | Required | Description |
|:---|:---|:---|:---|
| `token` | string | Yes | Raw verification token from email link |

**Example**: `GET /auth/verify-email?token=abc123...`

**Response — 200 OK**:
```json
{
  "success": true,
  "status": 200,
  "message": "Email verified successfully. You may now log in.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Error Cases**:
| Status | Code | Condition |
|:---|:---|:---|
| 400 | `AUTH_TOKEN_INVALID` | Token not found in Redis (invalid, expired, or already used) |
| 400 | `AUTH_ALREADY_VERIFIED` | Account is already verified |

---

### POST /auth/resend-verification — New

**Auth**: 🔓 Public
**Rate Limit**: 1 request per minute per email address (`EmailRateLimitGuard`)
**Purpose**: Request a fresh verification email. Invalidates the previous token.

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response — 200 OK** *(always, regardless of whether email exists — no enumeration)*:
```json
{
  "success": true,
  "status": 200,
  "message": "If this email is registered and unverified, a new verification email has been sent.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Error Cases**:
| Status | Code | Condition |
|:---|:---|:---|
| 429 | `THROTTLE_EXCEEDED` | Rate limit exceeded (1 per minute per email) |
| 400 | `VALIDATION_ERROR` | Invalid email format |

---

### POST /auth/forgot-password — New

**Auth**: 🔓 Public
**Rate Limit**: 1 request per minute per email address (`EmailRateLimitGuard`)
**Purpose**: Request a password reset email. Returns neutral response regardless of email existence.

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response — 200 OK** *(always — no email enumeration)*:
```json
{
  "success": true,
  "status": 200,
  "message": "If this email is registered, a password reset link has been sent.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Error Cases**:
| Status | Code | Condition |
|:---|:---|:---|
| 429 | `THROTTLE_EXCEEDED` | Rate limit exceeded (1 per minute per email) |
| 400 | `VALIDATION_ERROR` | Invalid email format |

---

### POST /auth/reset-password — New

**Auth**: 🔓 Public
**Rate Limit**: Global IP throttle only
**Purpose**: Set a new password using a valid reset token.

**Request Body**:
```json
{
  "token": "rawResetTokenFromEmail",
  "password": "NewSecure456",
  "confirmPassword": "NewSecure456"
}
```

**Response — 200 OK**:
```json
{
  "success": true,
  "status": 200,
  "message": "Password has been reset successfully. Please log in with your new password.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Error Cases**:
| Status | Code | Condition |
|:---|:---|:---|
| 400 | `AUTH_TOKEN_INVALID` | Reset token not found, expired, or already used |
| 400 | `AUTH_PASSWORDS_DO_NOT_MATCH` | `password` ≠ `confirmPassword` |
| 400 | `AUTH_PASSWORD_TOO_WEAK` | Password fails complexity policy (min 8, ≥1 letter, ≥1 digit) |

**Side effects on success**:
- `Users.password` updated (bcrypt hash)
- `Users.passwordResetRequired` set to `false`
- `Users.passwordResetRequiredAt` set to `null`
- All refresh tokens for the user revoked (`revokeAllUserRefreshTokens`)
- Token version incremented (`tv:{userId}`)
- Reset token Redis keys deleted

---

### POST /auth/change-password — New

**Auth**: 🔒 JWT required
**Rate Limit**: Global IP throttle
**Purpose**: Change password for a currently authenticated user.

**Request Body**:
```json
{
  "currentPassword": "OldSecure123",
  "newPassword": "NewSecure456",
  "confirmNewPassword": "NewSecure456"
}
```

**Response — 200 OK**:
```json
{
  "success": true,
  "status": 200,
  "message": "Password changed successfully. Other active sessions have been signed out.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

**Error Cases**:
| Status | Code | Condition |
|:---|:---|:---|
| 400 | `AUTH_CURRENT_PASSWORD_INCORRECT` | `currentPassword` does not match stored hash |
| 400 | `AUTH_PASSWORDS_DO_NOT_MATCH` | `newPassword` ≠ `confirmNewPassword` |
| 400 | `AUTH_PASSWORD_TOO_WEAK` | New password fails complexity policy |
| 400 | `AUTH_NO_PASSWORD_ACCOUNT` | SSO-only account (null password hash) |

**Side effects on success**:
- `Users.password` updated (bcrypt hash)
- All refresh tokens except the current session revoked
- Current session's access token NOT blacklisted (user stays logged in)

---

## Internal Service Contract (No HTTP Endpoint)

### AuthService.forcePasswordReset(targetUserId: string): Promise\<void\>

**Caller**: Future `AdminModule` (after this spec). `AuthModule` must export `AuthService`.
**Auth requirement at call site**: Enforced by caller (admin role check in future admin module).

**Behaviour**:
1. Load user by `targetUserId` → verify exists (throws `NotFoundException` if not)
2. Check if SSO-only account (null `password`) → return early with status `{ applicable: false }` rather than throwing
3. Invalidate password: set `Users.password = null` (or a sentinel — implementation decision for executor)
4. Set `Users.passwordResetRequired = true`, `Users.passwordResetRequiredAt = now()`
5. Revoke all refresh tokens: `revokeAllUserRefreshTokens(targetUserId)`
6. Increment token version: `INCR tv:{targetUserId}` → invalidates all active access tokens on next request

**Does NOT**: Send any email. Does NOT log audit entry (caller's responsibility).

---

## Mail Module Contract (Internal)

### MailService.sendVerificationEmail(to, firstName, verificationUrl): Promise\<void\>
### MailService.sendPasswordResetEmail(to, firstName, resetUrl): Promise\<void\>

Both methods:
- Accept typed parameters (no raw template context object leak)
- Throw `InternalServerErrorException` on SMTP failure (caught by GlobalExceptionFilter)
- Log `error` level on failure with recipient (not token) for debugging
- Are async (fire-and-forget is acceptable; errors are still caught and logged)
