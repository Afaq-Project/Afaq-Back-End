# Implementation Tasks: Email Module & Auth Upgrades

**Feature**: 007-email-auth-upgrades
**Generated**: 2026-09-29

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic mail structure

- [x] T001 Add `@nestjs-modules/mailer nodemailer handlebars` and dev types in `package.json`
- [x] T002 Update `.env.example` and create `src/config/mail.config.ts` with `MAIL_*` vars
- [x] T003 Create `src/modules/mail/mail.module.ts` and `src/modules/mail/mail.service.ts` (use `@nestjs/bull` queue for dispatch)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Update `prisma/schema.prisma` and create migration for `passwordResetRequired` fields
- [x] T005 Add token version helpers `getOrInitTokenVersion`, `incrementTokenVersion` in `src/modules/auth/auth.service.ts`
- [x] T006 Update `src/modules/auth/strategies/jwt.strategy.ts` to validate `tokenVersion` against Redis
- [x] T007 [P] Add `EmailRateLimitGuard` in `src/modules/auth/guards/email-rate-limit.guard.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Verify Email to Log In (Priority: P1) 🎯 MVP

**Goal**: As a new user, I must verify my email address to log in.

**Independent Test**: Registering returns a success message without tokens. Clicking the email link marks the account as verified and permits login.

### Tests for User Story 1 ⚠️

- [x] T008 [US1] Write E2E test for unverified login and token verification in `test/auth.e2e-spec.ts` (Implements ST-001)

### Implementation for User Story 1

- [x] T009 [P] [US1] Create `src/modules/mail/templates/verify-email.hbs`
- [x] T010 [P] [US1] Create `src/modules/auth/dto/verify-email.dto.ts` and update `register-response.dto.ts`
- [x] T011 [US1] Update `register` in `src/modules/auth/auth.service.ts` to dispatch email and remove tokens
- [x] T012 [US1] Implement `verifyEmail` in `src/modules/auth/auth.service.ts`
- [x] T013 [US1] Add `GET /auth/verify-email` and modify `POST /auth/register` in `src/modules/auth/auth.controller.ts`
- [x] T014 [US1] Update `login` in `src/modules/auth/auth.service.ts` to block if `!isEmailVerified`

**Checkpoint**: User Story 1 (MVP) fully functional and testable independently.

---

## Phase 4: User Story 2 - Forgot Password Reset (Priority: P2)

**Goal**: As a user who forgot their password, I want to reset it securely.

**Independent Test**: Submitting a forgot password request sends an email. Consuming the token successfully updates the password and revokes other sessions.

### Tests for User Story 2 ⚠️

- [x] T015 [US2] Write E2E test for forgot/reset flow and unknown email response in `test/auth.e2e-spec.ts` (Implements ST-006, ST-007)

### Implementation for User Story 2

- [x] T016 [P] [US2] Create `src/modules/mail/templates/reset-password.hbs`
- [x] T017 [P] [US2] Create `src/modules/auth/dto/forgot-password.dto.ts` and `reset-password.dto.ts`
- [x] T018 [US2] Implement `forgotPassword` and `resetPassword` in `src/modules/auth/auth.service.ts`
- [x] T019 [US2] Expose `POST /auth/forgot-password` and `POST /auth/reset-password` in `src/modules/auth/auth.controller.ts`

**Checkpoint**: User Story 2 is functional. Forgot password flows now work.

---

## Phase 5: User Story 3 - Authenticated Password Change (Priority: P3)

**Goal**: As an authenticated user, I want to change my current password.

**Independent Test**: Providing the correct current password updates the hash and revokes other active sessions while preserving the current one.

### Tests for User Story 3 ⚠️

- [x] T020 [US3] Write E2E test for change password flow in `test/auth.e2e-spec.ts` (Implements ST-010)

### Implementation for User Story 3

- [x] T021 [P] [US3] Create `src/modules/auth/dto/change-password.dto.ts`
- [x] T022 [US3] Implement `changePassword` in `src/modules/auth/auth.service.ts` (include rejection guard for SSO-only accounts)
- [x] T023 [US3] Expose `POST /auth/change-password` in `src/modules/auth/auth.controller.ts`

**Checkpoint**: User Story 3 is functional. Active users can change passwords.

---

## Phase 6: User Story 4 - Resend Links (Priority: P4)

**Goal**: As a user with a pending verification or reset, I can request a new link.

**Independent Test**: Hitting the resend endpoint invalidates the old token and enforces a 1-request-per-minute per-email rate limit.

### Tests for User Story 4 ⚠️

- [x] T024 [US4] Write E2E test for resend limits (1/min) and token replay prevention in `test/auth.e2e-spec.ts` (Implements ST-002, ST-003, ST-004, ST-005)

### Implementation for User Story 4

- [x] T025 [P] [US4] Create `src/modules/auth/dto/resend-verification.dto.ts`
- [x] T026 [US4] Implement `resendVerificationEmail` in `src/modules/auth/auth.service.ts`
- [x] T027 [US4] Expose `POST /auth/resend-verification` in `src/modules/auth/auth.controller.ts`

**Checkpoint**: User Story 4 is functional. Users can recover lost tokens safely.

---

## Phase 7: User Story 5 - Admin Forced Reset (Priority: P5)

**Goal**: As an admin, I can force a user to reset their password.

**Independent Test**: Calling the internal service method instantly invalidates the user's active JWTs and blocks their next login attempt.

### Tests for User Story 5 ⚠️

- [x] T028 [US5] Write E2E test for forced reset invalidating active JWT in `test/auth.e2e-spec.ts` (Implements ST-008, ST-012)

### Implementation for User Story 5

- [x] T029 [US5] Implement `forcePasswordReset` in `src/modules/auth/auth.service.ts` (include graceful `{ applicable: false }` for SSO-only accounts)
- [x] T030 [US5] Update `login` in `src/modules/auth/auth.service.ts` to block if `passwordResetRequired` is true
- [x] T031 [US5] Add `AuthService` to `exports` array in `src/modules/auth/auth.module.ts`

**Checkpoint**: User Story 5 is functional. Admin module can now consume this contract.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T032 [P] Update Swagger `@ApiOperation` and `@ApiResponse` on all new endpoints in `src/modules/auth/auth.controller.ts`
- [ ] T033 [P] Update `Levora_API.postman_collection.json` with new endpoints
- [ ] T034 Run `quickstart.md` validation scenarios manually
- [ ] T035 Code cleanup and `pnpm lint --fix`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P5)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent after Phase 2.
- **User Story 2 (P2)**: Independent after Phase 2.
- **User Story 3 (P3)**: Independent after Phase 2.
- **User Story 4 (P4)**: Partially depends on US1 functionality to resend the exact template.
- **User Story 5 (P5)**: Independent, but relies on Token Versioning from Phase 2.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- DTOs and Templates (marked [P]) run in parallel
- Core implementation (Services) before integration (Controllers)
- Story complete before moving to next priority

### Parallel Opportunities

- DTO creation across all user stories (T010, T017, T021, T025)
- Template creation (T009, T016)
- Swagger and Postman documentation updates (T032, T033)

---

## Parallel Example: User Story 2

```bash
# Launch DTO and Template creation together:
Task: "T016 [P] [US2] Create src/modules/mail/templates/reset-password.hbs"
Task: "T017 [P] [US2] Create src/modules/auth/dto/forgot-password.dto.ts and reset-password.dto.ts"

# Then sequentially execute service and controller logic.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently using the E2E suite
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently
4. Add User Story 3 → Test independently
5. Add User Story 4 → Test independently
6. Add User Story 5 → Test independently
7. Each story adds value without breaking previous stories
