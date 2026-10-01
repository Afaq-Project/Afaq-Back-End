# Email Module & Auth Upgrades — Endpoints

**Feature**: 007-email-auth-upgrades
**Base URL**: `/auth`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/auth/register` | 🌐 | Create new account, send verification email (no tokens returned) |
| 2 | `POST` | `/auth/login` | 🌐 | Authenticate user (blocked if unverified or password reset required) |
| 3 | `GET` | `/auth/verify-email` | 🌐 | Mark account as verified using token |
| 4 | `POST` | `/auth/resend-verification` | 🌐 | Invalidate previous token and send fresh verification email |
| 5 | `POST` | `/auth/forgot-password` | 🌐 | Send password reset link email |
| 6 | `POST` | `/auth/reset-password` | 🌐 | Set new password using reset token |
| 7 | `POST` | `/auth/change-password` | 🔒 | Update password for authenticated user |

---

## 1. `POST /auth/register` [PUBLIC]

### Purpose
Create a new user account. Dispatches a verification email immediately on success. **Does not return JWT tokens**.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/auth/register` |
| **Auth** | 🌐 Public |
| **Headers** | `Content-Type: application/json` |
| **Body** | `RegisterDto` (existing) |

### Body — `RegisterDto`

| Field | Type | Validation | Description |
|:---|:---|:---|:---|
| `email` | `string` | `@IsEmail`, `@IsNotEmpty` | Unique account email |
| `password` | `string` | `@IsString`, `@MinLength(8)`, `@Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)` | Secure password |
| `firstName` | `string` | `@IsString`, `@IsNotEmpty` | User first name |
| `lastName` | `string` | `@IsString`, `@IsNotEmpty` | User last name |

### Response — `201 Created`

```json
{
  "success": true,
  "status": 201,
  "message": "Registration successful. Please check your email to verify your account.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure (e.g. weak password) |
| `409` | `AUTH_EMAIL_TAKEN` | `Email already in use` | Email exists in `users` table |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure or SMTP issue |

---

## 2. `POST /auth/login` [PUBLIC]

### Purpose
Authenticate a user. Now blocked for unverified users and users flagged for forced reset.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/auth/login` |
| **Auth** | 🌐 Public |
| **Headers** | `Content-Type: application/json` |
| **Body** | `LoginDto` (existing) |

### Body — `LoginDto`

| Field | Type | Validation | Description |
|:---|:---|:---|:---|
| `email` | `string` | `@IsEmail`, `@IsNotEmpty` | Registered email |
| `password` | `string` | `@IsString`, `@IsNotEmpty` | Password |

### Response — `200 OK` (unchanged)

```json
{
  "success": true,
  "status": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "user": { ... }
  },
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `401` | `AUTH_INVALID_CREDENTIALS` | `Invalid credentials` | Wrong password or email |
| `403` | `AUTH_EMAIL_NOT_VERIFIED` | `Email not verified` | Valid credentials, but `isEmailVerified` = false |
| `403` | `AUTH_PASSWORD_RESET_REQUIRED` | `Password reset required` | `passwordResetRequired` = true |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 3. `GET /auth/verify-email` [PUBLIC]

### Purpose
Consume a single-use verification token from an email link to mark the account as verified.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/auth/verify-email` |
| **Auth** | 🌐 Public |
| **Query Params** | `token` (string, required) |
| **Body** | None |

### Response — `200 OK`

```json
{
  "success": true,
  "status": 200,
  "message": "Email verified successfully. You may now log in.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Missing token parameter |
| `400` | `AUTH_TOKEN_INVALID` | `Invalid or expired verification token` | Token not found in Redis, or already consumed |
| `400` | `AUTH_ALREADY_VERIFIED` | `Account is already verified` | `isEmailVerified` is already true |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 4. `POST /auth/resend-verification` [PUBLIC]

### Purpose
Invalidates any pending verification tokens for the user and emails a fresh one. Rate-limited to 1 request per minute per email.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/auth/resend-verification` |
| **Auth** | 🌐 Public |
| **Headers** | `Content-Type: application/json` |
| **Body** | `ResendVerificationDto` |

### Body — `ResendVerificationDto`

| Field | Type | Validation | Description |
|:---|:---|:---|:---|
| `email` | `string` | `@IsEmail`, `@IsNotEmpty` | Account email |

### Response — `200 OK`

```json
{
  "success": true,
  "status": 200,
  "message": "If this email is registered and unverified, a new verification email has been sent.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```
*Note: Returns 200 OK with this generic message even if the email is not found or is already verified, preventing email enumeration.*

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Invalid email format |
| `429` | `THROTTLE_EXCEEDED` | `Too Many Requests` | Exceeded 1 request/min for this email |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 5. `POST /auth/forgot-password` [PUBLIC]

### Purpose
Request a password reset link to be sent to the user's email. Rate-limited to 1 request per minute per email.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/auth/forgot-password` |
| **Auth** | 🌐 Public |
| **Headers** | `Content-Type: application/json` |
| **Body** | `ForgotPasswordDto` |

### Body — `ForgotPasswordDto`

| Field | Type | Validation | Description |
|:---|:---|:---|:---|
| `email` | `string` | `@IsEmail`, `@IsNotEmpty` | Account email |

### Response — `200 OK`

```json
{
  "success": true,
  "status": 200,
  "message": "If this email is registered, a password reset link has been sent.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```
*Note: Returns 200 OK regardless of whether the account exists (anti-enumeration).*

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Invalid email format |
| `429` | `THROTTLE_EXCEEDED` | `Too Many Requests` | Exceeded 1 request/min for this email |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 6. `POST /auth/reset-password` [PUBLIC]

### Purpose
Consume a single-use reset token and set a new password. Revokes all active refresh tokens and increments the token version to immediately invalidate current sessions.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/auth/reset-password` |
| **Auth** | 🌐 Public |
| **Headers** | `Content-Type: application/json` |
| **Body** | `ResetPasswordDto` |

### Body — `ResetPasswordDto`

| Field | Type | Validation | Description |
|:---|:---|:---|:---|
| `token` | `string` | `@IsString`, `@IsNotEmpty` | Reset token from email link |
| `password` | `string` | `@IsString`, `@MinLength(8)`, `@Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)` | Secure new password |
| `confirmPassword` | `string` | Matches `password` | Confirmation field |

### Response — `200 OK`

```json
{
  "success": true,
  "status": 200,
  "message": "Password has been reset successfully. Please log in with your new password.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Format validation failure |
| `400` | `AUTH_PASSWORDS_DO_NOT_MATCH` | `Passwords do not match` | `password` !== `confirmPassword` |
| `400` | `AUTH_TOKEN_INVALID` | `Invalid or expired reset token` | Token not found in Redis, or already consumed |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 7. `POST /auth/change-password`

### Purpose
Change password for an authenticated user. Requires valid current password. Revokes all refresh tokens EXCEPT the one for the current session.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/auth/change-password` |
| **Auth** | 🔒 Bearer JWT |
| **Headers** | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| **Body** | `ChangePasswordDto` |

### Body — `ChangePasswordDto`

| Field | Type | Validation | Description |
|:---|:---|:---|:---|
| `currentPassword` | `string` | `@IsString`, `@IsNotEmpty` | User's current password |
| `newPassword` | `string` | `@IsString`, `@MinLength(8)`, `@Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)` | Secure new password |
| `confirmNewPassword` | `string` | Matches `newPassword` | Confirmation field |

### Response — `200 OK`

```json
{
  "success": true,
  "status": 200,
  "message": "Password changed successfully. Other active sessions have been signed out.",
  "data": null,
  "timestamp": "2026-09-29T12:00:00.000Z"
}
```

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Format validation failure |
| `400` | `AUTH_PASSWORDS_DO_NOT_MATCH` | `Passwords do not match` | `newPassword` !== `confirmNewPassword` |
| `400` | `AUTH_CURRENT_PASSWORD_INCORRECT` | `Current password is incorrect` | `currentPassword` hash validation failed |
| `400` | `AUTH_NO_PASSWORD_ACCOUNT` | `Cannot change password for SSO-only account` | User has no password set (OAuth login only) |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |
