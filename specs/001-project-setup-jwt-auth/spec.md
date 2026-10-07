````markdown
# Feature Specification: Project Initialization & JWT Authentication System

**Feature ID:** 001
**Feature Name:** Project Initialization & JWT Authentication System
**Sprint:** 1
**Status:** Draft
**Created:** 2026-08-19
**Updated:** 2026-08-19

---

## 1. Feature Overview

### 1.1 Description

This feature establishes the foundational infrastructure for the Levora platform by updating the database schema to align with Levora Database Design v1.2 and implementing a complete JWT-based authentication system with access and refresh tokens. The feature ensures the system is ready for subsequent development sprints with a solid data model and secure authentication.

### 1.2 Goals

- Update Prisma schema to match Levora Database Design v1.2
- Implement JWT authentication with access and refresh tokens
- Enable user registration, login, token refresh, and profile retrieval
- Automatically create user profiles upon registration
- Set up comprehensive testing and documentation infrastructure

### 1.3 Out of Scope

- OAuth integration (covered in Feature 002)
- Email verification workflows
- Password reset functionality
- User profile editing (covered in later sprints)
- Python service integration

---

## 2. User Stories

| ID        | User Story                                                                                                                | Priority  | Related FR |
| --------- | ------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| US-001-01 | As a new user, I want to register with my email and password, so that I can create a Levora account.                      | Must-Have | FR-1.1     |
| US-001-02 | As a user, I want to log in with my email and password, so that I can access my account securely.                         | Must-Have | FR-1.1     |
| US-001-03 | As a user, I want my session to be maintained via refresh tokens, so that I don't have to log in repeatedly.              | Must-Have | Implicit   |
| US-001-04 | As a user, I want to view my profile information after logging in, so that I can verify my account details.               | Must-Have | Implicit   |
| US-001-05 | As a developer, I want a well-documented API with Swagger, so that I can test and integrate with the backend efficiently. | Must-Have | Implicit   |
| US-001-06 | As a developer, I want comprehensive test coverage, so that I can ensure system reliability and catch regressions early.  | Must-Have | Implicit   |

---

## 3. Functional Requirements

### 3.1 Database Schema (Prisma)

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                         | Priority  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001-01 | The system shall update the Prisma schema to include all Levora tables as defined in Database Design v1.2.                                                                                                                                                                                                                                          | Must-Have |
| FR-001-02 | The Users model shall include: `isEmailVerified`, `isActive`, `lastLoginAt`, `deletedAt`.                                                                                                                                                                                                                                                           | Must-Have |
| FR-001-03 | The system shall add models: `UserProfiles`, `UserEducations`, `SkillsMaster`, `UserSkills`, `LanguagesMaster`, `UserLanguages`, `OauthIdentities`, `Documents`, `Opportunities`, `SavedOpportunities`, `Applications`, `ApplicationStatusHistory`, `ApplicationDocuments`, `Reminders`, `Notifications`, `Subscriptions`, `Payments`, `ChangeLog`. | Must-Have |
| FR-001-04 | The system shall implement the M:N relationship between Users and Roles via the `UserRoles` model.                                                                                                                                                                                                                                                  | Must-Have |
| FR-001-05 | All fields shall use `@map` to map camelCase Prisma names to snake_case database names.                                                                                                                                                                                                                                                             | Must-Have |
| FR-001-06 | The system shall seed the Roles table with: `user`, `content_admin`, `system_admin`.                                                                                                                                                                                                                                                                | Must-Have |
| FR-001-07 | The system shall create a `UserProfiles` record automatically upon user registration.                                                                                                                                                                                                                                                               | Must-Have |

### 3.2 JWT Authentication

| ID        | Requirement                                                                                                          | Priority    |
| --------- | -------------------------------------------------------------------------------------------------------------------- | ----------- |
| FR-001-08 | The system shall provide a registration endpoint (`POST /auth/register`) accepting email and password.               | Must-Have   |
| FR-001-09 | The system shall provide a login endpoint (`POST /auth/login`) returning access and refresh tokens.                  | Must-Have   |
| FR-001-10 | The system shall provide a token refresh endpoint (`POST /auth/refresh`) returning a new access token.               | Must-Have   |
| FR-001-11 | The system shall provide a profile endpoint (`GET /auth/me`) returning the authenticated user's data.                | Must-Have   |
| FR-001-12 | The system shall validate passwords with minimum requirements (8 characters, at least one letter and one number).    | Must-Have   |
| FR-001-13 | The system shall hash passwords using bcrypt with a minimum of 12 rounds.                                            | Must-Have   |
| FR-001-14 | The system shall protect routes using a global `JwtAuthGuard` with `@Public()` decorator for unauthenticated access. | Must-Have   |
| FR-001-15 | The system shall store refresh tokens securely and support token revocation.                                         | Should-Have |

### 3.3 DTOs and Validation

| ID        | Requirement                                                                                            | Priority  |
| --------- | ------------------------------------------------------------------------------------------------------ | --------- |
| FR-001-16 | The system shall implement `RegisterDto` with validation for email, password, firstName, and lastName. | Must-Have |
| FR-001-17 | The system shall implement `LoginDto` with validation for email and password.                          | Must-Have |
| FR-001-18 | The system shall implement `RefreshTokenDto` with validation for refresh token.                        | Must-Have |
| FR-001-19 | The system shall implement `UserResponseDto` excluding sensitive fields (password, refresh tokens).    | Must-Have |

---

## 4. Non-Functional Requirements

| ID         | Requirement                 | Target                                 |
| ---------- | --------------------------- | -------------------------------------- |
| NFR-001-01 | Registration response time  | < 500ms under normal load              |
| NFR-001-02 | Login response time         | < 300ms under normal load              |
| NFR-001-03 | Token refresh response time | < 200ms under normal load              |
| NFR-001-04 | Unit test coverage          | ≥ 80% for AuthService and UsersService |
| NFR-001-05 | API documentation           | Swagger UI available at `/api`         |
| NFR-001-06 | Database migration          | Must complete without errors           |
| NFR-001-07 | Code quality                | Must pass SonarQube analysis           |

---

## 5. Acceptance Criteria

### 5.1 Database Schema

| ID        | Criterion                                                                     |
| --------- | ----------------------------------------------------------------------------- |
| AC-001-01 | Running `prisma migrate dev` completes successfully with no errors.           |
| AC-001-02 | All 21 Levora tables are present in the database.                             |
| AC-001-03 | The Roles table contains `user`, `content_admin`, and `system_admin` records. |
| AC-001-04 | All fields use correct data types and have appropriate indexes.               |

### 5.2 Registration

| ID        | Criterion                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------ |
| AC-001-05 | `POST /auth/register` creates a new user with provided email, password, firstName, and lastName. |
| AC-001-06 | A `UserProfiles` record is automatically created upon registration.                              |
| AC-001-07 | Password is stored as a bcrypt hash, not plaintext.                                              |
| AC-001-08 | Registration with an existing email returns a 409 Conflict error.                                |
| AC-001-09 | Registration with an invalid email format returns a 400 Bad Request error.                       |
| AC-001-10 | Registration with a weak password returns a 400 Bad Request error.                               |

### 5.3 Login

| ID        | Criterion                                                                           |
| --------- | ----------------------------------------------------------------------------------- |
| AC-001-11 | `POST /auth/login` returns an access token and refresh token for valid credentials. |
| AC-001-12 | Login with invalid credentials returns a 401 Unauthorized error.                    |
| AC-001-13 | The `lastLoginAt` field is updated upon successful login.                           |
| AC-001-14 | Tokens are returned as JWT strings in a standardized response format.               |

### 5.4 Token Refresh

| ID        | Criterion                                                                                |
| --------- | ---------------------------------------------------------------------------------------- |
| AC-001-15 | `POST /auth/refresh` returns a new access token for a valid refresh token.               |
| AC-001-16 | Token refresh with an invalid or expired refresh token returns a 401 Unauthorized error. |
| AC-001-17 | The new access token works for authenticated requests.                                   |

### 5.5 Profile Endpoint

| ID        | Criterion                                                               |
| --------- | ----------------------------------------------------------------------- |
| AC-001-18 | `GET /auth/me` returns the authenticated user's data including profile. |
| AC-001-19 | The response does not include the password hash.                        |
| AC-001-20 | Requests without a valid token return a 401 Unauthorized error.         |

### 5.6 API Documentation

| ID        | Criterion                                                                      |
| --------- | ------------------------------------------------------------------------------ |
| AC-001-21 | Swagger UI is accessible at `/api` and `/api-json`.                            |
| AC-001-22 | All endpoints have `@ApiTags`, `@ApiOperation`, and `@ApiResponse` decorators. |
| AC-001-23 | Request DTOs are documented with examples.                                     |
| AC-001-24 | Response schemas are fully documented.                                         |

---

## 6. Dependencies

### 6.1 External Dependencies

| Dependency        | Version | Purpose                                 |
| ----------------- | ------- | --------------------------------------- |
| NestJS Core       | ^10.0.0 | Application framework                   |
| Prisma            | ^5.0.0  | ORM for database operations             |
| @nestjs/jwt       | ^10.0.0 | JWT token generation and validation     |
| @nestjs/passport  | ^10.0.0 | Passport integration for authentication |
| passport-jwt      | ^4.0.0  | JWT strategy for Passport               |
| bcrypt            | ^5.0.0  | Password hashing                        |
| class-validator   | ^0.14.0 | DTO validation                          |
| class-transformer | ^0.5.0  | DTO transformation                      |
| @nestjs/swagger   | ^7.0.0  | API documentation                       |

### 6.2 Internal Dependencies

| Dependency                 | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `@maholan/nestjs-template` | Base template providing project structure and utilities |
| Existing Prisma schema     | Current schema will be replaced with Levora schema      |

---

## 7. Risks and Mitigations

| Risk                                            | Impact | Mitigation                                                                            |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| Database migration conflicts with existing data | High   | Backup database before migration; test migration on staging first                     |
| Schema validation issues                        | Medium | Run `prisma validate` before migration; review generated SQL                          |
| Token security vulnerabilities                  | High   | Use industry-standard JWT practices; implement token rotation; store secrets securely |
| Migration rollback complexity                   | Medium | Maintain migration history; test rollback procedure                                   |
| Missing indexes causing performance issues      | Medium | Review and implement all recommended indexes from Database Design                     |

---

## 8. Technical Notes

### 8.1 Naming Conventions

- Database tables: `snake_case`
- Prisma model fields: `camelCase`
- Use `@map` for all fields to maintain consistency

### 8.2 Environment Variables

| Variable                   | Required | Description                           |
| -------------------------- | -------- | ------------------------------------- |
| `DATABASE_URL`             | Yes      | PostgreSQL connection string          |
| `JWT_SECRET`               | Yes      | Secret for signing JWT tokens         |
| `JWT_EXPIRES_IN`           | Yes      | Access token expiration (e.g., '15m') |
| `REFRESH_TOKEN_EXPIRES_IN` | Yes      | Refresh token expiration (e.g., '7d') |
| `APP_PORT`                 | No       | Application port (default: 3000)      |

### 8.3 Response Format

All responses must follow the standardized format:

```json
{
  "statusCode": 200,
  "message": "Success",
  "data": { ... },
  "timestamp": "2026-08-19T10:00:00.000Z"
}
```
````

### 8.4 Reference Documents

- Levora Database Design v1.2
- System Architecture Design v2.0
- AGENTS.md (Project rules and guidelines)
- SRS v1.0 (Section 3.1: Authentication & Account Management)

---

## 9. Checklist

- [ ] Prisma schema updated with all Levora tables
- [ ] Database migrations created and applied
- [ ] Roles seeded (user, content_admin, system_admin)
- [ ] AuthModule configured with JWT
- [ ] JwtStrategy implemented
- [ ] JwtAuthGuard implemented and registered globally
- [ ] @Public() decorator implemented
- [ ] Register endpoint working
- [ ] Login endpoint working
- [ ] Refresh endpoint working
- [ ] Me endpoint working
- [ ] RegisterDto, LoginDto, RefreshTokenDto created
- [ ] Automatic UserProfiles creation on registration
- [ ] Unit tests for AuthService and UsersService
- [ ] E2E tests for authentication flow
- [ ] Swagger documentation configured
- [ ] All endpoints documented with Swagger
- [ ] Postman collection exported
- [ ] SonarQube configured
- [ ] Health checks implemented

```

---

```
