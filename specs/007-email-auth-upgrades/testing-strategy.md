# Testing Strategy — Email Module & Auth Upgrades

## 1. Testing Philosophy

Unit tests isolate email template rendering, SMTP dispatch logic (mocked), token generation, hashing, and token versioning calculations. Integration/E2E tests prove the new auth endpoints, Redis-backed single-use tokens, email-scoped rate limiters, JWT token version invalidation (forced-reset), and response envelopes. All external email delivery must be captured locally during tests; no real emails are sent.

## 2. Test Pyramid

The auth module changes are highly stateful and dependent on Redis (for tokens) and Postgres (for user state). Therefore, Integration/E2E tests form the critical mass of coverage. Unit testing is reserved for isolated functions like hash generation and token version retrieval/incrementing.

## 3. Test Layers

| Layer | Scope | Tools | Doubles | When |
|:---|:---|:---|:---|:---|
| Unit | Token generation, hashing, token versioning rules, MailService template logic | Jest | Mock Redis and SMTP transport | Local and `pnpm test` |
| Integration/E2E | Auth endpoints (register, login, verify, reset, change password), rate limiting, JWT invalidation, single-use token replay prevention | Jest + Supertest | Test database/Redis, local mail capture | Local and CI `pnpm test:e2e` |

## 4. Coverage Requirements

- **JWT Token Versioning (Forced-Reset):** E2E tests must prove that after a forced reset, any previously issued, unexpired JWT fails validation due to a token version mismatch.
- **Email-Scoped Rate Limits:** E2E tests must verify that the 1-request-per-minute limit applies per email address, explicitly bypassing or operating independently of generic IP limits.
- **Token Replay Attacks:** E2E tests must prove that verification and reset tokens are strictly single-use and invalidated immediately.
- **Authentication Bypass:** E2E tests must verify that an unverified user cannot log in under any circumstances (assert `AUTH_EMAIL_NOT_VERIFIED` and no tokens returned).
- **No User Enumeration:** E2E tests must assert that `forgot-password` and `resend-verification` endpoints return identical responses for known and unknown emails.

## 5. Test Data Management

Use isolated test users and clear Redis keys between test cases. Tests must not rely on shared state across test boundaries, especially for rate-limiting (where Redis TTLs dictate state) and token versioning.

## 6. Naming Conventions

Use `auth.service.spec.ts` and `mail.service.spec.ts` for unit tests. Use `auth.e2e-spec.ts` for integration endpoints. Test cases should describe the Given-When-Then behavior explicitly.

## 7. Regression Policy

Every defect fix adds a failing regression test that would have caught it before the fix. This is mandatory. Link the test to the relevant FR or defect reference.

## 8. CI Integration

Every PR runs `pnpm build`, `pnpm lint`, and `pnpm test`. PRs altering the auth module must run `pnpm test:e2e` to verify rate limits and token lifecycle.

## 9. Traceability Matrix

| FR | Test File(s) | Test Case(s) | Layer |
|:---|:---|:---|:---|
| FR-006, FR-029 | `auth.e2e-spec.ts` | unverified user login rejected with `AUTH_EMAIL_NOT_VERIFIED`; no token issued | E2E |
| FR-009, FR-016 | `auth.e2e-spec.ts` | token replay attempt (verify/reset) rejected on second use | E2E |
| FR-010, FR-011 | `auth.e2e-spec.ts` | rate limit (1/min) enforced per email address; different IP test | E2E |
| FR-012 | `auth.e2e-spec.ts` | forgot-password returns 200 for unknown email | E2E |
| FR-024, FR-025 | `auth.e2e-spec.ts`, `auth.service.spec.ts` | forced reset increments token version and invalidates existing JWT | Unit, E2E |
