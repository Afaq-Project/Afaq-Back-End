# Quickstart Validation Guide: Email Module & Auth Upgrades

**Feature**: 007-email-auth-upgrades
**Date**: 2026-09-29

> This guide describes **what to run and what to observe** to validate that the feature works end-to-end.
> It is not an implementation guide. Refer to `data-model.md`, `contracts/api-contracts.md`, and `tasks.md` for implementation details.

---

## Prerequisites

1. **App running**: `pnpm start:dev`
2. **Database migrated**: `npx prisma migrate dev` (includes `add_password_reset_required_to_users`)
3. **Redis running**: Confirm with `redis-cli ping` → `PONG`
4. **Mail capture running**: Mailpit at `http://localhost:8025` (captures all outbound mail in dev)
5. **Environment**: `.env` has all `MAIL_*` variables set pointing to local Mailpit instance

---

## Scenario 1 — New Registration & Email Verification

**What to verify**: Registration returns no tokens; verification enables login.

| Step | Action | Expected Outcome |
|:---|:---|:---|
| 1 | `POST /auth/register` with valid payload | `201` — message only, no `accessToken` or `refreshToken` in response |
| 2 | Check Mailpit at `localhost:8025` | One email received with subject "Verify your email" containing a link |
| 3 | Extract token from link, `GET /auth/verify-email?token=<token>` | `200` — "Email verified successfully" |
| 4 | `POST /auth/login` with same credentials | `200` — returns `accessToken` + `refreshToken` (normal login) |
| 5 | Repeat step 3 with same token | `400 AUTH_TOKEN_INVALID` — token already consumed, not reusable |

---

## Scenario 2 — Login Blocked for Unverified User

**What to verify**: `AUTH_EMAIL_NOT_VERIFIED` is distinct from wrong-password rejection.

| Step | Action | Expected Outcome |
|:---|:---|:---|
| 1 | Register new account (do NOT click verification link) | `201` received |
| 2 | `POST /auth/login` with correct credentials | `403 AUTH_EMAIL_NOT_VERIFIED` — no tokens issued |
| 3 | `POST /auth/login` with wrong password | `401 AUTH_INVALID_CREDENTIALS` — different error code from step 2 |

---

## Scenario 3 — Resend Verification + Rate Limit

**What to verify**: Resend invalidates previous token; rate limit enforced.

| Step | Action | Expected Outcome |
|:---|:---|:---|
| 1 | Register, note first verification link from Mailpit | First token T1 received |
| 2 | `POST /auth/resend-verification` with registered email | `200` — neutral message |
| 3 | Check Mailpit | Second email received; new token T2 |
| 4 | `GET /auth/verify-email?token=<T1>` | `400 AUTH_TOKEN_INVALID` — old token invalidated |
| 5 | `GET /auth/verify-email?token=<T2>` | `200` — new token valid |
| 6 | Immediately `POST /auth/resend-verification` again (same email) | `429 THROTTLE_EXCEEDED` — 1/min limit enforced |

---

## Scenario 4 — Forgot Password + Reset

**What to verify**: Reset flow works; old password rejected after reset; sessions invalidated.

| Step | Action | Expected Outcome |
|:---|:---|:---|
| 1 | Register + verify + login (get a refresh token) | Active session exists |
| 2 | `POST /auth/forgot-password` with registered email | `200` — neutral message |
| 3 | Check Mailpit | Reset email received with link |
| 4 | `POST /auth/reset-password` with token + new password + matching confirm | `200` — success |
| 5 | `POST /auth/login` with OLD password | `401 AUTH_INVALID_CREDENTIALS` — old password rejected |
| 6 | `POST /auth/login` with NEW password | `200` — success |
| 7 | Attempt to use old refresh token from step 1 | `401` — refresh token revoked |
| 8 | `POST /auth/forgot-password` with unregistered email | `200` — same neutral message (no enumeration) |
| 9 | Measure: response time for registered vs unregistered | Indistinguishable (within <50ms variance) |

---

## Scenario 5 — Forgot Password Rate Limit

**What to verify**: Email-scoped rate limit, not IP-scoped.

| Step | Action | Expected Outcome |
|:---|:---|:---|
| 1 | `POST /auth/forgot-password` with email A | `200` |
| 2 | Immediately `POST /auth/forgot-password` with email A again | `429` |
| 3 | Immediately `POST /auth/forgot-password` with email B (different email) | `200` — limit is per-email, not per-IP |

---

## Scenario 6 — Authenticated Password Change

**What to verify**: Change requires correct current password; other sessions revoked; current session preserved.

| Step | Action | Expected Outcome |
|:---|:---|:---|
| 1 | Login on Device A → get accessToken-A + refreshToken-A | Session A active |
| 2 | Login on Device B → get accessToken-B + refreshToken-B | Session B active |
| 3 | Using accessToken-A: `POST /auth/change-password` with wrong `currentPassword` | `400 AUTH_CURRENT_PASSWORD_INCORRECT` |
| 4 | Using accessToken-A: `POST /auth/change-password` with correct current + mismatched new/confirm | `400 AUTH_PASSWORDS_DO_NOT_MATCH` |
| 5 | Using accessToken-A: `POST /auth/change-password` with all valid fields | `200` — success |
| 6 | Using accessToken-A: `GET /auth/me` | `200` — current session still valid |
| 7 | Using refreshToken-B: `POST /auth/refresh` | `401` — Device B session revoked |

---

## Scenario 7 — SSO-Only Account Change Password Rejected

| Step | Action | Expected Outcome |
|:---|:---|:---|
| 1 | Register via Google OAuth (SSO-only account, no password set) | Account created |
| 2 | `POST /auth/change-password` with any payload | `400 AUTH_NO_PASSWORD_ACCOUNT` |

---

## Scenario 8 — Admin Forced Password Reset (Internal Contract)

**What to verify**: `AuthService.forcePasswordReset()` works correctly. *Tested via unit/integration test — no HTTP endpoint in this spec.*

| Step | Verification Method | Expected Outcome |
|:---|:---|:---|
| 1 | Login → get accessToken + refreshToken | Active session |
| 2 | Call `AuthService.forcePasswordReset(userId)` directly (unit test / integration test stub) | No error thrown |
| 3 | Check DB: `users.password_reset_required = true` | ✅ |
| 4 | Check DB: `users.password_reset_required_at` is set | ✅ |
| 5 | Check Redis: all `rt:{userId}:*` keys deleted | ✅ |
| 6 | Check Redis: `tv:{userId}` incremented | ✅ |
| 7 | Use old accessToken for any authenticated request | `401` — token version mismatch |
| 8 | `POST /auth/login` with correct password | `403 AUTH_PASSWORD_RESET_REQUIRED` |
| 9 | Complete forgot-password flow with new password | `200` — DB flag cleared, login works |
| 10 | Call `forcePasswordReset` on an SSO-only user | Returns `{ applicable: false }` — no error |

---

## Scenario 9 — Mail Module Independence

**What to verify**: Any module can send email without owning SMTP config.

| Step | Action | Expected Outcome |
|:---|:---|:---|
| 1 | Inject `MailService` into any test service (not auth) | No import error; `MailModule` globally available |
| 2 | Call `mailService.sendVerificationEmail(...)` in isolation | Email appears in Mailpit |
| 3 | Set `MAIL_HOST` to an invalid host, restart | App logs SMTP error; does not crash on startup |

---

## Quality Gates (All Scenarios Must Pass)

```bash
pnpm build     # Zero TypeScript errors
pnpm lint      # Zero ESLint errors
pnpm test      # All unit + integration tests pass
```

Refer to `contracts/api-contracts.md` for exact request/response shapes used in validation steps above.
