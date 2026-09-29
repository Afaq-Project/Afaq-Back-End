# Feature Specification: Email Module & Authentication Upgrades

**Feature Branch**: `007-email-auth-upgrades`

**Created**: 2026-09-29

**Status**: Draft

**Input**: User description: "Create a centralized email module using @nestjs-modules/mailer, and update the authentication module to support: password reset, email-based verification, password change (with current password verification and confirmation matching), and email infrastructure setup for cross-module use."

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 – Account Email Verification (Priority: P1)

After registering, a user receives a verification email. They click the link, and their account is marked as verified.

**Why this priority**: Email verification is the foundational trust gate — it must work before any other email-dependent feature (password reset) can be meaningful. It also enables enforcing email-verified-only access to protected resources.

**Independent Test**: Can be fully tested by registering a new account, observing a verification email is dispatched, following the link, and confirming the account's verified status changes to true.

**Acceptance Scenarios**:

1. **Given** a newly registered user, **When** registration completes, **Then** a verification email is sent to the user's address containing a secure, time-limited link.
2. **Given** a user with an unverified account, **When** they follow the verification link before it expires, **Then** their account is marked as verified and they receive a success response.
3. **Given** a user with an unverified account, **When** they follow an expired or already-used verification link, **Then** the system rejects the request with a clear error message.
4. **Given** a verified user, **When** they attempt to re-use the same verification link, **Then** the system rejects the request gracefully (link already consumed).
5. **Given** a user who did not receive the email, **When** they request a resend, **Then** a new verification email is dispatched and the previous token is invalidated.

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

### Edge Cases

- What happens when the SMTP server is unreachable at startup — does the application fail fast or degrade gracefully?
- How does the system handle verification/reset token replay attacks (token reuse after successful consumption)?
- What happens when a user requests multiple password reset emails in quick succession — is the previous token invalidated?
- How does the system behave if a user changes their email address while a verification or reset token is pending?
- What happens when a password reset is completed for an account that also has OAuth identities attached?

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

- **FR-006**: The system MUST dispatch a verification email immediately upon successful user registration.
- **FR-007**: Verification tokens MUST be cryptographically random, unique per request, and expire after a defined time window (assumed 24 hours).
- **FR-008**: The system MUST expose an endpoint to consume a verification token and mark the associated account as verified.
- **FR-009**: A verification token MUST be invalidated immediately after first use — it MUST NOT be reusable.
- **FR-010**: The system MUST expose a "resend verification email" endpoint for unverified users. Calling it MUST invalidate any previously issued token and issue a fresh one.

**Password Reset**

- **FR-011**: The system MUST expose a "forgot password" endpoint that accepts an email address and, if the account exists, dispatches a password reset email.
- **FR-012**: The "forgot password" endpoint MUST return an identical success response whether or not the email address is registered (no enumeration).
- **FR-013**: Password reset tokens MUST be cryptographically random, unique per request, and expire after a defined time window (assumed 1 hour).
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

### Key Entities

- **Verification Token**: A time-limited, single-use cryptographic token tied to a user account. Attributes: token value (hashed for storage), user reference, creation timestamp, expiry timestamp, consumed flag.
- **Password Reset Token**: Same shape as Verification Token, but associated with the password reset flow. Distinct from verification tokens — separate storage/namespace.
- **Mail Message**: A transient value object representing an outbound email. Contains: recipient address, subject, template name, template context variables.

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
