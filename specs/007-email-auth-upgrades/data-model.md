# Data Model: Email Module & Auth Upgrades

**Feature**: 007-email-auth-upgrades
**Date**: 2026-09-29
**Source**: `specs/007-email-auth-upgrades/spec.md` + `research.md`

---

## 1. Database Schema Changes

### 1.1 `Users` Table — New Columns

Two columns are added to the existing `users` table. No existing columns are modified.

| Column | Type | Default | Nullable | Purpose |
|:---|:---|:---|:---|:---|
| `password_reset_required` | `BOOLEAN` | `false` | No | Flag set by forced-reset; blocks login until reset is complete |
| `password_reset_required_at` | `TIMESTAMPTZ` | — | Yes | Timestamp of when the forced reset was triggered (audit) |

**Prisma model addition** (inside existing `model Users {}`):
```prisma
passwordResetRequired   Boolean   @default(false) @map("password_reset_required")
passwordResetRequiredAt DateTime? @map("password_reset_required_at") @db.Timestamptz(6)
```

**Migration name**: `add_password_reset_required_to_users`
**Command**: `npx prisma migrate dev --name add_password_reset_required_to_users`

**State transitions for `passwordResetRequired`**:
```
false ──[admin forced reset]──► true
true  ──[user completes reset-password flow]──► false (+ passwordResetRequiredAt cleared)
```

**No index**: The field is always read as part of a `findUnique({ where: { email } })` at login — no additional index needed.

---

## 2. Redis Key Namespaces

All new keys follow the existing project convention (`{prefix}:{userId}:{hash}` or `{prefix}:{userId}`).

### 2.1 Email Verification Tokens

| Key | Type | TTL | Value | Description |
|:---|:---|:---|:---|:---|
| `vt:{userId}:{sha256Hash}` | String | 86400s (24h) | `"1"` | Existence sentinel for a specific verification token |
| `vt:current:{userId}` | String | 86400s (24h) | SHA-256 hash | Pointer to the currently active verification token hash |

**Invalidation on resend**: Atomic pipeline — DEL old existence key → SET new existence key → SET new current pointer.
**Consumption on verify**: DEL existence key + DEL current pointer (token is single-use).

### 2.2 Password Reset Tokens

| Key | Type | TTL | Value | Description |
|:---|:---|:---|:---|:---|
| `prt:{userId}:{sha256Hash}` | String | 3600s (1h) | `"1"` | Existence sentinel for a specific reset token |
| `prt:current:{userId}` | String | 3600s (1h) | SHA-256 hash | Pointer to the currently active reset token hash |

**Invalidation on new request**: Same atomic pipeline as verification tokens.
**Consumption on reset-password**: DEL existence key + DEL current pointer.

### 2.3 Token Version Counter (Forced-Reset Blacklisting)

| Key | Type | TTL | Value | Description |
|:---|:---|:---|:---|:---|
| `tv:{userId}` | String (Integer) | No TTL | Integer ≥ 0 | Per-user token version; increment invalidates all existing JWTs |

**Set at**: First login (if not exists, defaults to 0).
**Incremented at**: `forcePasswordReset(userId)` call.
**Checked at**: Every JWT validation in `JwtStrategy.validate()`.

**JWT payload addition**: `tokenVersion: number` claim embedded at token generation time.

---

## 3. Entity Definitions

### 3.1 Verification Token (logical, stored in Redis)

| Attribute | Type | Constraint |
|:---|:---|:---|
| rawToken | string | Cryptographically random (32 bytes → hex), sent in email link only |
| tokenHash | string | SHA-256(rawToken), stored as Redis key suffix |
| userId | UUID | References `Users.id` |
| expiresAt | computed | now + 24h (enforced by Redis TTL) |
| consumed | implicit | Key deleted on first use |

**Single-active-per-user**: Enforced by `vt:current:{userId}` pointer. Only one active token exists per user at any time.

### 3.2 Password Reset Token (logical, stored in Redis)

Same shape as Verification Token with:
- Prefix: `prt:` instead of `vt:`
- TTL: 1 hour instead of 24 hours
- Current pointer: `prt:current:{userId}`

### 3.3 Forced Reset State (persisted in `Users` table)

| Attribute | Column | Type |
|:---|:---|:---|
| isRequired | `password_reset_required` | Boolean |
| triggeredAt | `password_reset_required_at` | Timestamptz? |

> Note: "triggered-by actor reference" (for audit) is deferred to the future admin operations spec, which will own the HTTP endpoint and audit logging.

---

## 4. New DTOs

All DTOs use `class-validator` + `class-transformer`. All are decorated with `@ApiProperty` for Swagger.

### 4.1 Input DTOs (new)

| DTO | File | Fields |
|:---|:---|:---|
| `VerifyEmailDto` | `dto/verify-email.dto.ts` | `token: string` (IsString, IsNotEmpty) |
| `ResendVerificationDto` | `dto/resend-verification.dto.ts` | `email: string` (IsEmail, IsNotEmpty) |
| `ForgotPasswordDto` | `dto/forgot-password.dto.ts` | `email: string` (IsEmail, IsNotEmpty) |
| `ResetPasswordDto` | `dto/reset-password.dto.ts` | `token: string`, `password: string` (min 8, regex), `confirmPassword: string` |
| `ChangePasswordDto` | `dto/change-password.dto.ts` | `currentPassword: string`, `newPassword: string` (min 8, regex), `confirmNewPassword: string` |

### 4.2 Modified DTOs

| DTO | Change |
|:---|:---|
| `auth-response.dto.ts` (existing) | Registration response no longer includes `accessToken`/`refreshToken`. New `RegisterResponseDto` returned for `POST /auth/register`. |

### 4.3 Response DTOs (new)

| DTO | Fields |
|:---|:---|
| `RegisterResponseDto` | `{ message: string }` — "Please verify your email to continue." |
| `MessageResponseDto` (shared) | `{ message: string }` — generic success/acknowledgment response |

---

## 5. New Service Methods (AuthService)

| Method | Signature | Layer |
|:---|:---|:---|
| `sendVerificationEmail` | `(userId, email) → Promise<void>` | Service → MailService |
| `verifyEmail` | `(token: string) → Promise<void>` | Service → Redis + Prisma |
| `resendVerificationEmail` | `(email: string) → Promise<void>` | Service → Redis + MailService |
| `forgotPassword` | `(email: string) → Promise<void>` | Service → Redis + MailService |
| `resetPassword` | `(token, password, confirm) → Promise<void>` | Service → Redis + Prisma |
| `changePassword` | `(userId, current, new, confirm) → Promise<void>` | Service → Prisma |
| `forcePasswordReset` | `(targetUserId: string) → Promise<void>` | Service → Redis + Prisma |
| `getOrInitTokenVersion` | `(userId: string) → Promise<number>` | Service → Redis (private) |
| `incrementTokenVersion` | `(userId: string) → Promise<void>` | Service → Redis (private) |

---

## 6. Email Templates

| Template File | Purpose | Context Variables |
|:---|:---|:---|
| `verify-email.hbs` | Email verification link | `{ firstName, verificationUrl, expiresInHours }` |
| `reset-password.hbs` | Password reset link | `{ firstName, resetUrl, expiresInMinutes }` |

**Template directory**: `src/modules/mail/templates/`

---

## 7. New Environment Variables

All must be added to `.env.example` with descriptive comments.

| Variable | Example | Purpose |
|:---|:---|:---|
| `MAIL_HOST` | `smtp.mailpit.local` | SMTP server hostname |
| `MAIL_PORT` | `1025` | SMTP server port |
| `MAIL_SECURE` | `false` | TLS (true for port 465) |
| `MAIL_USER` | `""` | SMTP auth username |
| `MAIL_PASS` | `""` | SMTP auth password |
| `MAIL_FROM` | `"Levora <no-reply@levora.app>"` | Default From address |
| `MAIL_PREVIEW` | `true` | Dev: local capture mode |
| `APP_BASE_URL` | `http://localhost:3000` | Used to construct verification/reset links in emails |
