# Implementation Plan: Email Module & Authentication Upgrades

**Branch**: `007-email-auth-upgrades` | **Date**: 2026-09-29 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-email-auth-upgrades/spec.md`

---

## Summary

Build a centralized `MailModule` using `@nestjs-modules/mailer` (Handlebars adapter) and update the `AuthModule` to support: email verification as a hard login gate, password reset via email, authenticated password change, and an internal `forcePasswordReset(userId)` service contract callable by future privileged modules. All ephemeral tokens are stored in Redis (TTL-based). A new per-user token version counter (`tv:{userId}`) enables immediate JWT invalidation on forced reset without needing the target's access token.

---

## Technical Context

| Concern | Value |
|:---|:---|
| **Language/Version** | TypeScript 5.x (strict mode), Node.js LTS |
| **Framework** | NestJS 10.x |
| **Primary Dependencies** | `@nestjs-modules/mailer`, `nodemailer`, `handlebars` (new); `@nestjs/throttler`, `ioredis`, `@prisma/client`, `passport-jwt`, `bcrypt` (existing) |
| **Storage** | PostgreSQL (Prisma) + Redis (ioredis via existing `RedisService`) |
| **Testing** | Jest (unit + integration); `@nestjs/testing`; external dependencies mocked |
| **Target Platform** | Linux server (NestJS HTTP service) |
| **Project Type** | Web service (backend API) |
| **Performance Goals** | Email dispatch ≤5s under normal load (SC-001, SC-002); login response ≤200ms p95 |
| **Constraints** | No tokens issued at registration; unverified users cannot log in; 1 req/min per email on public token-trigger endpoints |
| **Scale/Scope** | Single-tenant backend; existing user base; zero downtime migration required |

---

## Constitution Check

_GATE: Must pass before implementation. Verified post-design below._

| Principle | Status | Notes |
|:---|:---|:---|
| **I. Architecture Boundaries** (Controller → Service → Repository) | ✅ PASS | All new business logic in `AuthService` / `MailService`. Controllers handle only routing + DTO validation. |
| **II. Data Access** (Prisma only; Repository for complex queries) | ✅ PASS | All DB access via `PrismaService`. No complex multi-table joins; direct service access is acceptable. |
| **III. Schema & Migrations** (prisma migrate dev only) | ✅ PASS | One additive migration: `add_password_reset_required_to_users`. No destructive changes. |
| **IV. API Contracts** (DTO validation, envelope, no raw Prisma) | ✅ PASS | All new endpoints have input + response DTOs with `class-validator`. Envelope enforced. |
| **V. Security** (@Public on public endpoints, bcrypt, no secret leaks) | ✅ PASS | Public endpoints explicitly decorated. Tokens SHA-256 hashed in Redis. Passwords bcrypt. No PII in logs. |
| **VI. Testing** (unit tests for services, integration for auth flows) | ✅ PASS | Unit tests for `AuthService`, `MailService`. Integration tests for all new auth endpoints. |
| **VII. Code Quality Gates** (build + lint + test green) | ✅ PASS | Enforced at each Work Unit completion via Executor report + Coordinator verification. |
| **VIII. Documentation** (Swagger, JSDoc, .env.example) | ✅ PASS | All endpoints decorated. `MailService` methods have JSDoc. `.env.example` updated in Work Unit 1. |
| **IX. Error Handling** (typed NestJS exceptions, Logger, no console.*) | ✅ PASS | All errors use typed HTTP exceptions. Logger used throughout. |
| **X. Configuration** (ConfigService only, no process.env in services) | ✅ PASS | `MailerModule.forRootAsync` injects `ConfigService`. No `process.env` in service files. |
| **XI. Module Boundaries** (explicit exports, no internal imports) | ✅ PASS | `MailModule` marked `@Global()` and exports `MailService`. `AuthModule` exports `AuthService`. |

**Post-design re-evaluation**: All 11 principles remain PASS. The token version counter (`tv:{userId}`) adds a Redis read to every JWT validation — acceptable overhead (~1ms); no constitution violation.

---

## Project Structure

### Documentation (this feature)

```text
specs/007-email-auth-upgrades/
├── spec.md              ✅ Complete
├── plan.md              ✅ This file
├── research.md          ✅ Complete (Phase 0)
├── data-model.md        ✅ Complete (Phase 1)
├── quickstart.md        ✅ Complete (Phase 1)
├── edge-cases.md        ✅ Complete (Phase 1)
├── security-controls.md ✅ Complete (Phase 1)
├── security-testing.md  ✅ Complete (Phase 1)
├── testing-strategy.md  ✅ Complete (Phase 1)
├── contracts/
│   └── api-contracts.md ✅ Complete (Phase 1)
├── checklists/
│   └── requirements.md  ✅ Complete
└── tasks.md             ⬜ Created by /speckit-tasks (next command)
```

### Source Code Layout

```text
src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts        ← ADD: 5 new endpoints; MODIFY: register, login
│   │   ├── auth.service.ts           ← ADD: 7 new methods; MODIFY: login, generateTokens
│   │   ├── auth.module.ts            ← MODIFY: import MailModule, export AuthService
│   │   ├── dto/
│   │   │   ├── verify-email.dto.ts         ← NEW
│   │   │   ├── resend-verification.dto.ts  ← NEW
│   │   │   ├── forgot-password.dto.ts      ← NEW
│   │   │   ├── reset-password.dto.ts       ← NEW
│   │   │   ├── change-password.dto.ts      ← NEW
│   │   │   ├── register-response.dto.ts    ← NEW
│   │   │   └── index.ts                    ← MODIFY: export new DTOs
│   │   ├── guards/
│   │   │   └── email-rate-limit.guard.ts   ← NEW
│   │   └── strategies/
│   │       └── jwt.strategy.ts             ← MODIFY: add tokenVersion check
│   │
│   └── mail/                          ← NEW MODULE
│       ├── mail.module.ts
│       ├── mail.service.ts
│       ├── mail.config.ts
│       └── templates/
│           ├── verify-email.hbs
│           └── reset-password.hbs
│
├── config/
│   └── mail.config.ts                 ← NEW: mail env var validation
│
└── app.module.ts                      ← MODIFY: import MailModule

prisma/
└── schema.prisma                      ← MODIFY: add 2 fields to Users model
```

---

## Multi-Agent Workflow

### Agent Roles

| Agent | OMA Type | Constraint | Objective |
|:---|:---|:---|:---|
| **Coordinator** | `oma-director` | Writes no code | Assign tasks, verify reports against reality, gate quality |
| **Executor** | `self` (inherit) | Creates no tests | Implement code per task spec; report file list + summary |
| **Tester** | `oma-reviewer` | Modifies no source code | Write tests, review code quality/security, report issues with root causes |

### Cycle Per Work Unit

```
┌─────────────────────────────────────────────────────────────────┐
│  COORDINATOR assigns Work Unit N to EXECUTOR                    │
│       ↓                                                         │
│  EXECUTOR implements → reports: files changed, gates run        │
│       ↓                                                         │
│  COORDINATOR verifies: runs pnpm build + pnpm lint,             │
│    cross-checks reported files actually exist and match spec    │
│       ↓ (if OK)                                                 │
│  COORDINATOR assigns Work Unit N to TESTER for review+tests     │
│       ↓                                                         │
│  TESTER: writes unit/integration tests per `testing-strategy.md`, │
│    reviews code against `security-controls.md` & `edge-cases.md`, │
│    reports: pass/fail per test, issues with root causes         │
│       ↓                                                         │
│  COORDINATOR receives report:                                   │
│    → If all pass: Work Unit N DONE ✅, advance to N+1          │
│    → If issues: assigns fix list to EXECUTOR                   │
│       ↓ (fix loop)                                              │
│  EXECUTOR fixes → reports                                       │
│  COORDINATOR verifies → sends back to TESTER                   │
│  TESTER re-verifies → loop until green                         │
│                                                                 │
│  Human engineer monitors and may intervene at any step.        │
└─────────────────────────────────────────────────────────────────┘
```

### Quality Gates (enforced by Coordinator before closing each Work Unit)

```bash
pnpm build    # Zero TypeScript compilation errors
pnpm lint     # Zero ESLint errors
pnpm test     # All tests pass (unit + integration for this Work Unit)
```

---

## Work Units (Sequential)

Each Work Unit is one complete Coordinator → Executor → Tester cycle.

---

### WU-1: Mail Infrastructure

**Objective**: Create the `MailModule` with full Handlebars template support, globally importable by any feature module. Email dispatch must be offloaded to a Redis-backed `@nestjs/bull` queue to prevent blocking the event loop.

**Executor deliverables**:
- `src/modules/mail/mail.module.ts` — `@Global()`, `MailerModule.forRootAsync`, registers BullMQ queue, exports `MailService`
- `src/modules/mail/mail.processor.ts` — NEW: BullMQ processor to handle asynchronous email dispatch
- `src/modules/mail/mail.service.ts` — `sendVerificationEmail()`, `sendPasswordResetEmail()` methods enqueue jobs rather than waiting for SMTP; typed params; `Logger`
- `src/modules/mail/mail.config.ts` — env var schema (`MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`, `MAIL_PREVIEW`, `APP_BASE_URL`)
- `src/modules/mail/templates/verify-email.hbs`
- `src/modules/mail/templates/reset-password.hbs`
- `src/app.module.ts` — import `MailModule`
- `.env.example` — all `MAIL_*` variables with comments
- Install packages: `pnpm add @nestjs-modules/mailer nodemailer handlebars && pnpm add -D @types/nodemailer @types/handlebars`

**Tester scope**:
- Unit test: `MailService` — mock `MailerService`; verify `sendVerificationEmail` calls mailer with correct template + context; verify error path throws `InternalServerErrorException`
- Integration smoke: `MailModule` imports cleanly (no circular deps), `MailService` injectable in a test module
- Review: Swagger annotations not applicable (no HTTP endpoint). Check JSDoc on public methods. Check no `process.env` usage. Check `Logger` (not `console.*`).

**Spec FRs covered**: FR-001, FR-002, FR-003, FR-004, FR-005

---

### WU-2: Database Migration

**Objective**: Add `passwordResetRequired` and `passwordResetRequiredAt` columns to `Users` table.

**Executor deliverables**:
- `prisma/schema.prisma` — two new fields added to `model Users {}`
- Run `npx prisma migrate dev --name add_password_reset_required_to_users`
- Commit generated migration file in `prisma/migrations/`

**Tester scope**:
- Review migration SQL: confirm additive only, correct types, correct defaults
- Verify `pnpm build` still passes (Prisma client regenerated correctly)
- Unit test: confirm `Users` Prisma type now includes `passwordResetRequired: boolean`
- Review: no `prisma db push` used; migration file committed

**Spec FRs covered**: FR-026 (storage of forced-reset state), data-model.md §1.1

---

### WU-3: Token Version Counter (JWT Invalidation Infrastructure)

**Objective**: Add per-user token version management to `AuthService` and update `JwtStrategy` to validate the version claim on every request.

**Executor deliverables**:
- `src/modules/auth/auth.service.ts` — add private `getOrInitTokenVersion(userId)` and `incrementTokenVersion(userId)` methods using `RedisService`
- `src/modules/auth/auth.service.ts` — modify `generateTokens()` to embed `tokenVersion` in both access and refresh JWT payloads
- `src/modules/auth/strategies/jwt.strategy.ts` — in `validate()`, after standard payload extraction, read `tv:{userId}` from Redis; if `payload.tokenVersion < currentVersion`, throw `UnauthorizedException`

**Tester scope**:
- Unit test `AuthService.incrementTokenVersion`: mock Redis; verify `INCR tv:{userId}` called
- Unit test `JwtStrategy.validate()`: mock Redis returning version 2; test with payload version 1 → expect `UnauthorizedException`; test with payload version 2 → expect success
- Review: PII/token values not logged. Redis key pattern consistent with `data-model.md §2.3`.

**Spec FRs covered**: FR-025 (access token blacklisting on forced reset), R5 from research.md

---

### WU-4: Register Flow — Remove Tokens + Send Verification Email

**Objective**: `POST /auth/register` no longer returns tokens. Dispatches a verification email immediately on success.

**Executor deliverables**:
- `src/modules/auth/dto/register-response.dto.ts` — NEW: `{ message: string }`
- `src/modules/auth/auth.service.ts` — modify `register()`: after saving user, call `sendVerificationEmail(userId, email)` (generates raw token, SHA-256s it, stores in Redis, dispatches via `MailService`); return `{ message }` not tokens
- `src/modules/auth/auth.controller.ts` — modify `POST /auth/register` response type to `RegisterResponseDto`; update `@ApiResponse`
- `src/modules/auth/dto/index.ts` — export `RegisterResponseDto`

**Tester scope**:
- Unit test `AuthService.register()`: confirm return value has no `accessToken`; confirm `mailService.sendVerificationEmail` called once; mock Redis; confirm `vt:{userId}:{hash}` and `vt:current:{userId}` keys set with correct TTL
- Integration test: `POST /auth/register` → `201` with message body, no token fields; Mailpit captures one email
- Review: registration response DTO does not expose password hash or internal IDs. Swagger updated.

**Spec FRs covered**: FR-006

---

### WU-5: Email Verification Endpoint

**Objective**: `GET /auth/verify-email?token=` marks account as verified (single-use token).

**Executor deliverables**:
- `src/modules/auth/dto/verify-email.dto.ts` — NEW: `{ token: string }`
- `src/modules/auth/auth.service.ts` — add `verifyEmail(token)`: SHA-256 token → check `vt:current:{userId}` exists → verify existence key `vt:{userId}:{hash}` → set `isEmailVerified=true` via Prisma → delete both Redis keys
- `src/modules/auth/auth.controller.ts` — add `@Get('verify-email') @Public()` handler
- Update `auth.controller.ts` Swagger `@ApiOperation` + `@ApiResponse` decorators

**Tester scope**:
- Unit test: valid token → `isEmailVerified` updated; Redis keys deleted
- Unit test: expired/invalid token → `BadRequestException(AUTH_TOKEN_INVALID)`
- Unit test: already-verified user → `BadRequestException(AUTH_ALREADY_VERIFIED)`
- Integration test: full flow — register → extract token from Mailpit → GET verify → login succeeds
- Review: `@Public()` decorator present. No PII in error messages.

**Spec FRs covered**: FR-007, FR-008, FR-009

---

### WU-6: Resend Verification + Email Rate Limit Guard

**Objective**: `POST /auth/resend-verification` issues a fresh token (invalidates old), protected by 1/min per-email rate limit.

**Executor deliverables**:
- `src/modules/auth/guards/email-rate-limit.guard.ts` — NEW: `EmailRateLimitGuard extends ThrottlerGuard`, overrides `generateKey()` to scope by email address
- `src/modules/auth/dto/resend-verification.dto.ts` — NEW: `{ email: string }`
- `src/modules/auth/auth.service.ts` — add `resendVerificationEmail(email)`: find user by email (if not found or already verified → return silently, no enumeration); atomic pipeline to delete old token, set new; dispatch via `MailService`
- `src/modules/auth/auth.controller.ts` — add `@Post('resend-verification') @Public() @UseGuards(EmailRateLimitGuard) @Throttle(...)` handler

**Tester scope**:
- Unit test: valid unverified email → old Redis keys deleted, new keys set, mail dispatched
- Unit test: unknown email → returns silently (no error thrown, no mail dispatched)
- Unit test: already-verified email → returns silently
- Integration test: register → resend → old token invalid → new token valid → 429 on second immediate request
- Review: Neutral response regardless of email existence. `generateKey()` in guard uses email, not IP.

**Spec FRs covered**: FR-010

---

### WU-7: Forgot Password + Reset Password

**Objective**: Self-service password reset via email.

**Executor deliverables**:
- `src/modules/auth/dto/forgot-password.dto.ts` — NEW
- `src/modules/auth/dto/reset-password.dto.ts` — NEW (includes password match validation via custom decorator or class-level validator)
- `src/modules/auth/auth.service.ts` — add `forgotPassword(email)` and `resetPassword(token, password, confirmPassword)`
  - `forgotPassword`: find user (silent if not found); generate `prt` token; store in Redis; dispatch `sendPasswordResetEmail`
  - `resetPassword`: validate token; check password match + complexity; bcrypt hash; update `Users.password`; clear `passwordResetRequired`; `revokeAllUserRefreshTokens`; `incrementTokenVersion`; delete Redis keys
- `src/modules/auth/auth.controller.ts` — add `@Post('forgot-password') @Public() @UseGuards(EmailRateLimitGuard)` and `@Post('reset-password') @Public()` handlers

**Tester scope**:
- Unit test `forgotPassword`: registered email → mail dispatched; unknown email → silent; Redis keys set correctly
- Unit test `resetPassword`: valid token + matching passwords → password updated, sessions revoked, token version incremented, flag cleared; mismatched passwords → `BadRequestException`; invalid/expired token → `BadRequestException`
- Integration test: full flow — login → forgot-password → extract from Mailpit → reset-password → old credentials rejected → new credentials accepted → old refresh token rejected
- Review: No email enumeration. Neutral response shapes match contracts. Passwords bcrypt-hashed.

**Spec FRs covered**: FR-011, FR-012, FR-013, FR-014, FR-015, FR-016

---

### WU-8: Authenticated Password Change

**Objective**: `POST /auth/change-password` for logged-in users.

**Executor deliverables**:
- `src/modules/auth/dto/change-password.dto.ts` — NEW
- `src/modules/auth/auth.service.ts` — add `changePassword(userId, currentPassword, newPassword, confirmNewPassword)`: load user by ID; check null password (SSO guard); verify currentPassword against hash; check newPassword ≠ confirmNewPassword; check complexity; bcrypt hash; update DB; revoke all refresh tokens EXCEPT current session's
- `src/modules/auth/auth.controller.ts` — add `@Post('change-password')` handler (JWT required, no `@Public()`)

**Tester scope**:
- Unit test: all error paths (wrong current password, mismatch, SSO account, weak password)
- Unit test: success path — password updated, other sessions revoked, current session preserved
- Integration test: login → change-password → old password rejected → new password accepted → second device session revoked
- Review: `userId` sourced from JWT (`req.user.id`), not from request body. No plaintext passwords in logs.

**Spec FRs covered**: FR-017, FR-018, FR-019, FR-020, FR-021, FR-022, FR-023

---

### WU-9: Login Gate + forcePasswordReset Contract

**Objective**: Enforce email verification and forced-reset checks in login flow. Expose `forcePasswordReset(userId)` as an exported service method.

**Executor deliverables**:
- `src/modules/auth/auth.service.ts` — modify `login()`:
  1. After password validation: if `!isEmailVerified` → throw `ForbiddenException('AUTH_EMAIL_NOT_VERIFIED')`
  2. If `passwordResetRequired` → throw `ForbiddenException('AUTH_PASSWORD_RESET_REQUIRED')`
  3. Call `getOrInitTokenVersion(userId)` and embed in JWT
- `src/modules/auth/auth.service.ts` — add `forcePasswordReset(targetUserId)`:
  1. Load user (throw `NotFoundException` if not found)
  2. If `user.password === null` → return `{ applicable: false }` (SSO-only guard)
  3. `await prisma.users.update({ where: { id }, data: { password: null, passwordResetRequired: true, passwordResetRequiredAt: new Date() } })`
  4. `await this.revokeAllUserRefreshTokens(targetUserId)`
  5. `await this.incrementTokenVersion(targetUserId)`
- `src/modules/auth/auth.module.ts` — add `AuthService` to `exports` array (enables future AdminModule to inject it)

**Tester scope**:
- Unit test login gate: unverified user → `AUTH_EMAIL_NOT_VERIFIED`; forced-reset pending → `AUTH_PASSWORD_RESET_REQUIRED`; both flags false → tokens issued with `tokenVersion` claim
- Unit test `forcePasswordReset`: happy path; user-not-found; SSO-only account
- Integration test: login → force-reset (via direct service call) → login attempt → `AUTH_PASSWORD_RESET_REQUIRED` → complete forgot-password flow → login succeeds; verify token version incremented
- Review: `AuthModule.exports` includes `AuthService`. `ForbiddenException` used (not `UnauthorizedException`) for semantic accuracy. JSDoc on `forcePasswordReset`.

**Spec FRs covered**: FR-024, FR-025, FR-026, FR-027, FR-028, FR-029, SC-008, SC-009, SC-010

---

### WU-10: Final Integration Pass + Swagger + .env.example

**Objective**: Ensure the complete feature is production-ready — Swagger fully documented, Postman collection updated, all quality gates green, `.env.example` complete.

**Executor deliverables**:
- Verify all new endpoints have `@ApiOperation`, `@ApiResponse`, `@ApiBody` Swagger decorators
- Verify all new DTOs have `@ApiProperty` decorators
- Update `Levora_API.postman_collection.json` with all new endpoints and sample request bodies
- Final `pnpm build && pnpm lint && pnpm test` run — report results
- Verify `.env.example` has all `MAIL_*` variables with explanatory comments
- Update `README.md` (local Mailpit setup instructions)
- Create ADR entry in `docx/decisions-log.md` for: (a) token-version-counter approach (R5), (b) registration-no-tokens decision (Q3 clarification)

**Tester scope**:
- Full regression: run all 9 quickstart scenarios from `quickstart.md`
- Swagger review: every new endpoint documented and accurate
- Security review: all public endpoints have `@Public()`. All authenticated endpoints derive `userId` from JWT. No PII in any log statement. No secret values in test files.
- Final acceptance gate: `oma-verifier` produces a go/no-go decision

**Spec FRs covered**: All remaining (documentation, constitution Principle VIII)

---

## Complexity Tracking

No constitution violations. No complexity justifications required.
