# Feature Specification: Email Module & Authentication Upgrades

**Feature Branch**: `007-email-auth-upgrades`

**Created**: 2026-09-29

**Status**: Draft (Amended 2026-09-29)

**Input**: User description: "Create a centralized email module using @nestjs-modules/mailer, and update the authentication module to support: password reset, email-based verification, password change (with current password verification and confirmation matching), and email infrastructure setup for cross-module use. Additionally, the authentication module must expose an internal capability for privileged actors to force a password reset on any target user account, so that a future administrative operations module can invoke it."

---

## Clarifications

### Session 2026-09-29

- Q: When a user completes the password reset flow (including after an admin-forced reset), should the system send a post-change confirmation email? → A: Out of scope for this spec — deferred to the future notifications module. No confirmation emails are produced by the auth module itself.
- Q: Should unverified users be allowed to log in and use the platform while verification is pending? → A: No. A user is not considered registered until their email is verified. Unverified accounts are fully blocked from login.
- Q: What happens when an unverified user attempts to log in — should a token be issued at all, and must they re-enter credentials after verifying? → A: Clean Gate approach: (1) Registration returns a success message only — no tokens issued. (2) Login-while-unverified returns a distinct AUTH_EMAIL_NOT_VERIFIED error code — no token. (3) Resend-verification endpoint is public (unauthenticated). After verifying, the user logs in normally with their original credentials — no re-entry needed.
- Q: What rate limit should apply to the forgot-password and resend-verification endpoints? → A: 1 request per minute per email address. Each new request automatically invalidates the previous token/link.
- Q: When an admin-forced reset is applied to a user with an active session, are their in-flight requests rejected immediately? → A: Yes — access tokens are also blacklisted immediately (same mechanism as logout). The short-lived token remains technically valid until natural expiry, but refresh token revocation ensures no new access tokens can be issued after that window.

---

## User Scenarios & Testing _(mandatory)_


### User Story 1 – Account Email Verification (Priority: P1)

After registering, a user receives a verification email. They click the link, and their account is marked as verified. Only after verification can they log in.

**Why this priority**: Email verification is the hard prerequisite for any authenticated access. Registration without verification leaves the account in a locked pending state — no tokens are issued until verification is complete.

**Independent Test**: Can be fully tested by registering a new account, confirming no tokens are returned, observing a verification email is dispatched, following the link, and confirming the account can now log in successfully.

**Acceptance Scenarios**:

1. **Given** a user submits valid registration details, **When** registration completes, **Then** the system returns a confirmation message only (no access or refresh tokens), and a verification email is dispatched to the user's address containing a secure, time-limited link.
2. **Given** a user with an unverified account, **When** they follow the verification link before it expires, **Then** their account is marked as verified and they receive a success response — they may now log in.
3. **Given** a user with an unverified account, **When** they follow an expired or already-used verification link, **Then** the system rejects the request with a clear error message.
4. **Given** a verified user, **When** they attempt to re-use the same verification link, **Then** the system rejects the request gracefully (link already consumed).
5. **Given** a user who did not receive the email, **When** they call the public resend endpoint with their email address (no authentication required), **Then** a new verification email is dispatched, the previous token is invalidated, and this action is subject to a 1-request-per-minute-per-email rate limit.
6. **Given** an unverified user, **When** they attempt to log in with their registered credentials, **Then** the system rejects the request with a distinct error code (AUTH_EMAIL_NOT_VERIFIED) — no token is issued — so the client can guide them to verify their email.

---

### User Story 2 – Password Reset via Email (Priority: P2)

A user who has forgotten their password can request a reset link by email, then set a new password securely.

**Why this priority**: Password reset is a critical account recovery path. Without it, users who lose access cannot self-serve, driving support burden.

**Independent Test**: Can be fully tested by submitting a "forgot password" request, receiving the reset email, following the link, submitting a new password, and confirming the old password no longer works while the new one does.

**Acceptance Scenarios**:

1. **Given** a registered user, **When** they submit their email address via the "forgot password" form, **Then** a password reset email is sent containing a secure, time-limited link.
2. **Given** a user who submitted a reset request, **When** they follow the link within the validity window and submit a valid new password with matching confirmation, **Then** their password is updated and all active sessions are invalidated.
3. **Given** a user who submits a reset request, **When** they follow the link after it has expired, **Then** the system rejects the request and instructs the user to initiate a new one.
4. **Given** a user who submits a reset request, **When** an unrecognized email address is provided, **Then** the system returns a neutral acknowledgment response (no email enumeration leak).
5. **Given** a valid reset token, **When** the new password does not meet the complexity policy or the confirmation does not match, **Then** the request is rejected with a descriptive validation error.

---

### User Story 3 – Authenticated Password Change (Priority: P3)

A logged-in user can change their password by providing their current password and a new password with confirmation.

**Why this priority**: Secure password change for authenticated users is a standard account management requirement. Lower priority than reset because it requires the user to already be logged in and know their current password.

**Independent Test**: Can be fully tested by logging in, submitting the change-password form with valid current and new passwords, logging out, and confirming login succeeds only with the new password.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they submit a change-password request with a correct current password and a valid new password that matches the confirmation, **Then** their password is updated.
2. **Given** an authenticated user, **When** they submit a change-password request with an incorrect current password, **Then** the system rejects the request with a clear error and does not change the password.
3. **Given** an authenticated user, **When** the new password and confirmation do not match, **Then** the system rejects the request with a validation error before any password update occurs.
4. **Given** an authenticated user with an SSO-only account (no password set), **When** they attempt to change their password, **Then** the system rejects the request with a meaningful message explaining the account type limitation.
5. **Given** an authenticated user, **When** a valid password change is completed, **Then** all other active refresh token sessions for that user are revoked (forcing re-login on other devices).

---

### User Story 4 – Centralized Email Delivery Infrastructure (Priority: P1)

Any module in the system (auth, notifications, billing, etc.) can send transactional emails through a single shared service without duplicating SMTP configuration or template logic.

**Why this priority**: This is the enabling infrastructure for all other email-dependent stories. It must be in place before verification or reset emails can be dispatched.

**Independent Test**: Can be fully tested independently by invoking the mail service directly with a test payload and confirming an email is delivered (or captured in a test/development mail interceptor) with the correct subject, recipient, and body content.

**Acceptance Scenarios**:

1. **Given** the mail module is configured, **When** any consuming module calls the shared mail service with a recipient, subject, and template name, **Then** an email is dispatched using the configured SMTP provider.
2. **Given** the mail module is configured, **When** an email send attempt fails (e.g., SMTP error), **Then** the error is logged with enough context for debugging and a meaningful exception is propagated to the caller.
3. **Given** the platform is in a development or test environment, **When** an email is triggered, **Then** the email is captured locally (no external delivery) so development is not dependent on a real SMTP server.
4. **Given** a consuming module, **When** it imports the mail module, **Then** no SMTP credentials or transport configuration is required in the consuming module itself — all configuration is centralized.

---

### User Story 5 – Admin-Forced Password Reset (Priority: P2)

A privileged operator (administrator or similarly elevated role) needs to force a specific user to reset their password — invalidating the user's current password immediately and requiring them to set a new one before they can access the system again. The operator does not set the new password; they only trigger the forced state.

**Why this priority**: This is a critical security control — it allows the platform to respond to suspected account compromise, policy violations, or credential hygiene enforcement without waiting for the user to act voluntarily. While the operator-facing interface (the admin module) is out of scope for this spec, the auth module must be ready to support it.

**Independent Test**: Can be fully tested by directly invoking the auth module's forced-reset capability with a target user ID, then attempting to log in as that user and confirming the system rejects the login (or requires a password reset flow) until a new password is set.

**Acceptance Scenarios**:

1. **Given** a user account with an active password, **When** a privileged operation triggers a forced password reset for that user, **Then** the user's current password is immediately invalidated and all active sessions for that user are revoked.
2. **Given** a user whose password has been force-reset, **When** they attempt to log in with their previous password, **Then** the system rejects the login with an appropriate message indicating a password reset is required.
3. **Given** a user in the forced-reset state, **When** they complete the standard password reset flow (via email), **Then** their account returns to normal active status with the new password.
4. **Given** a forced-reset operation is triggered, **When** the target user has an SSO-only account (no password), **Then** the system either rejects the operation gracefully or handles it according to the account type (no password to invalidate).
5. **Given** the forced-reset capability exists in the auth module, **When** a future admin module invokes it, **Then** the capability operates identically to being called from within the auth context — the contract is stable and reusable.

---

### Edge Cases

- What happens when the SMTP server is unreachable at startup — does the application fail fast or degrade gracefully?
- How does the system handle verification/reset token replay attacks (token reuse after successful consumption)?
- What happens when a user requests multiple password reset emails in quick succession — is the previous token invalidated?
- How does the system behave if a user changes their email address while a verification or reset token is pending?
- What happens when a password reset is completed for an account that also has OAuth identities attached?
- What happens if a forced-reset is triggered for a user who is currently mid-session — are in-flight requests honoured or immediately rejected?
- Can a forced-reset be applied to a user who already has a pending self-initiated password reset token?

---

## Requirements _(mandatory)_

### Functional Requirements

**Email Infrastructure**

- **FR-001**: The system MUST provide a single, globally importable mail module that encapsulates SMTP transport configuration, template rendering, and email dispatch.
- **FR-002**: The mail module MUST support HTML email templates (using the project's chosen templating engine) to allow consistent, branded email formatting.
- **FR-003**: All SMTP credentials (host, port, username, password, sender address) MUST be sourced exclusively from environment configuration — never hardcoded.
- **FR-004**: In development and test environments, the mail module MUST support a local mail capture mechanism (e.g., Mailpit, Ethereal, or equivalent) so no real emails are sent.
- **FR-005**: The mail module MUST be importable by any feature module without that module owning any transport or template logic.

**Email Verification**

- **FR-006**: The registration endpoint MUST NOT issue access or refresh tokens. It MUST return a success confirmation message only, and dispatch a verification email immediately upon saving the new user account.
- **FR-007**: Verification tokens MUST be cryptographically random, unique per request, and expire after a defined time window (assumed 24 hours).
- **FR-008**: The system MUST expose a public (unauthenticated) endpoint to consume a verification token and mark the associated account as verified.
- **FR-009**: A verification token MUST be invalidated immediately after first use — it MUST NOT be reusable.
- **FR-010**: The resend-verification endpoint MUST be public (no authentication required), accept only an email address, invalidate any previously issued token, and issue a fresh one. It MUST enforce a rate limit of 1 request per minute per email address. Requests beyond this limit MUST be rejected with a `429 Too Many Requests` response.

**Password Reset**

- **FR-011**: The system MUST expose a public "forgot password" endpoint that accepts an email address and, if the account exists, dispatches a password reset email. It MUST enforce a rate limit of 1 request per minute per email address. Requests beyond this limit MUST be rejected with `429 Too Many Requests`.
- **FR-012**: The "forgot password" endpoint MUST return an identical success response whether or not the email address is registered (no enumeration).
- **FR-013**: Password reset tokens MUST be cryptographically random, unique per request, and expire after a defined time window (assumed 1 hour). Issuing a new token MUST invalidate any previously issued token for the same user.
- **FR-014**: The system MUST expose a "reset password" endpoint that accepts a valid token, a new password, and a confirmation field.
- **FR-015**: Upon successful password reset, all active refresh token sessions for that user MUST be revoked.
- **FR-016**: A reset token MUST be invalidated immediately after use — it MUST NOT be reusable.

**Password Change**

- **FR-017**: The system MUST expose a "change password" endpoint, accessible only to authenticated users.
- **FR-018**: The change-password request MUST require the user's current password, a new password, and a confirmation of the new password.
- **FR-019**: The system MUST verify the current password against the stored hash before applying any update.
- **FR-020**: The system MUST reject the request if the new password and confirmation do not match, before any hash comparison or update occurs.
- **FR-021**: The new password MUST meet the same complexity policy enforced at registration (minimum 8 characters, at least one letter and one number).
- **FR-022**: Upon successful password change, all other active refresh token sessions for that user MUST be revoked (excluding the current session).
- **FR-023**: SSO-only accounts (with no stored password hash) MUST receive a clear rejection message when attempting to use the change-password endpoint.

**Verified Account Gate**

- **FR-029**: The login endpoint MUST reject any attempt by an unverified user (where `isEmailVerified = false`) with a distinct error code, separate from invalid-credentials errors, so the client can distinguish the reason and prompt the user to verify their email.

**Privileged Forced Password Reset (Auth Module Contract)**

- **FR-024**: The authentication module MUST expose an internal service capability that accepts a target user identifier and immediately invalidates that user's current password — rendering it unusable for login.
- **FR-025**: Upon forced password invalidation, all active refresh token sessions for the target user MUST be revoked within the same operation, AND all active access tokens MUST be added to the token blacklist immediately — using the same mechanism as logout — so the user is locked out on their very next authenticated request. The access token may remain cryptographically valid until its natural expiry (~15 minutes), but renewal will be impossible once refresh tokens are revoked.
- **FR-026**: The system MUST record a "forced reset pending" state on the target user's account so that subsequent login attempts can detect the state and communicate to the user that a password reset is required.
- **FR-027**: The forced-reset capability MUST be designed as a reusable, callable contract — it must not be tightly coupled to any single caller. Any future privileged module (admin operations, compliance tooling, etc.) MUST be able to invoke it without modification to the auth module.
- **FR-028**: If the target user has an SSO-only account with no password set, the forced-reset operation MUST return a clear status indicating the operation was not applicable, rather than failing silently or with an opaque error.

**Verified Account Gate**

- **FR-029**: The login endpoint MUST reject any login attempt by an unverified user with a distinct error code `AUTH_EMAIL_NOT_VERIFIED` — separate from `AUTH_INVALID_CREDENTIALS` — so the client can guide the user to their inbox rather than suggesting their credentials are wrong. No token is issued.

### Key Entities

- **Verification Token**: A time-limited, single-use cryptographic token tied to a user account. Attributes: token value (hashed for storage), user reference, creation timestamp, expiry timestamp, consumed flag.
- **Password Reset Token**: Same shape as Verification Token, but associated with the password reset flow. Distinct from verification tokens — separate storage/namespace.
- **Mail Message**: A transient value object representing an outbound email. Contains: recipient address, subject, template name, template context variables.
- **Forced Reset State**: A flag or marker on a user account indicating that a privileged actor has invalidated the user's password and a reset is required. Attributes: user reference, triggered timestamp, triggered-by actor reference (for audit). This state is cleared when the user successfully completes a new password reset.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user who registers receives a verification email within 5 seconds of registration completing under normal load conditions.
- **SC-002**: A user who submits a "forgot password" request receives the reset email within 5 seconds under normal load conditions.
- **SC-003**: 100% of verification and reset tokens are invalidated upon first use — no token can be consumed twice under any timing condition.
- **SC-004**: The "forgot password" endpoint response time and body are indistinguishable between registered and unregistered email addresses (enumeration prevention is verifiable).
- **SC-005**: Authenticated password change completes and forces re-login on all other active sessions within the same request-response cycle.
- **SC-006**: All email-sending operations in development mode produce zero real outbound emails — all messages are locally captured and inspectable.
- **SC-007**: No other feature module requires access to SMTP configuration or transport details — all mail is sent via the shared service interface.
- **SC-008**: A user whose password has been force-reset by a privileged operator cannot log in with their previous credentials — the rejection is detectable and distinct from a standard "invalid credentials" response, allowing the system to guide the user toward the reset flow.
- **SC-009**: The forced-reset internal service capability is invokable by at least two distinct callers (auth module itself and a stub representing a future admin module) without any code change to the auth module — verifiable by a contract test.
- **SC-010**: An unverified user's login attempt is rejected with error code `AUTH_EMAIL_NOT_VERIFIED` — 100% of the time, with no tokens issued — distinguishable from `AUTH_INVALID_CREDENTIALS` in all test scenarios.

---

## Assumptions

- The `@nestjs-modules/mailer` library with Nodemailer transport will be used as the email delivery adapter. This is the project's chosen library per the user's direction.
- Handlebars will be used as the template engine (the library's default, and already a dependency).
- Verification tokens and password reset tokens will be stored in Redis (consistent with how refresh tokens are currently managed) with TTL-based expiry, rather than in the PostgreSQL database. This avoids schema migrations for ephemeral data.
- Token values will be stored as SHA-256 hashes in Redis — the raw token travels only in the email link and is never stored in plaintext.
- The "resend verification" endpoint will require the user to be authenticated (to prevent abuse), unless the user is in a partially-authenticated state post-registration.
- Password complexity rules for the change-password and reset-password flows are identical to the registration policy (min 8 chars, ≥1 letter, ≥1 digit).
- Upon password reset, **all** refresh tokens are revoked. Upon password change, all tokens **except the current session's** are revoked.
- The email template directory will reside within the mail module's folder structure, consistent with the existing module layout convention.
- A local mail capture tool (e.g., Mailpit via Docker) is assumed to be available in the development environment — setup instructions will be added to the README.
- This spec covers the backend only. Frontend integration (form UIs, redirect URL handling) is out of scope.
- The "forced reset pending" state (FR-026) will be stored as a persistent flag on the user record in the database (a boolean or nullable timestamp column), not in Redis — because it must survive server restarts and must be inspectable for audit purposes. This implies a schema migration.
- The forced-reset capability (FR-024 through FR-028) is scoped to the **auth service layer only** in this spec. The admin-facing endpoint, authorization check (role enforcement), and audit logging for who triggered the reset are responsibilities of the future admin operations module/spec — not this one.
- **Post-change confirmation emails are out of scope for this spec.** No email is sent by the auth module after a password change or reset completes (whether user-initiated or admin-forced). This is deferred to a future notifications module.
