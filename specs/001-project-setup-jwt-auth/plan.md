```markdown
# Implementation Plan: Project Initialization & JWT Authentication System

**Feature ID:** 001
**Feature Name:** Project Initialization & JWT Authentication System
**Sprint:** 1
**Status:** Draft
**Created:** 2026-08-19
**Updated:** 2026-08-19

---

## 1. Technical Context

### 1.1 Technology Stack

| Layer             | Technology      | Version |
| ----------------- | --------------- | ------- |
| Backend Framework | NestJS          | ^10.0.0 |
| Database ORM      | Prisma          | ^5.0.0  |
| Database          | PostgreSQL      | 15+     |
| Language          | TypeScript      | ^5.0.0  |
| Package Manager   | pnpm            | ^8.0.0  |
| Testing           | Jest            | ^29.0.0 |
| API Documentation | Swagger/OpenAPI | ^7.0.0  |

### 1.2 Architecture Patterns

| Pattern                 | Description                            |
| ----------------------- | -------------------------------------- |
| Modular Architecture    | Domain-driven module organization      |
| Dependency Injection    | NestJS DI container                    |
| Repository Pattern      | Prisma as data access layer            |
| DTO Pattern             | Request/Response data transfer objects |
| Global Exception Filter | Standardized error handling            |

### 1.3 Prerequisites

- Node.js v18+ installed
- PostgreSQL 15+ running locally
- `pnpm` installed globally
- `@maholan/nestjs-template` cloned and configured

---

## 2. Architecture Overview

### 2.1 Module Structure
```

src/
├── modules/
│ ├── auth/
│ │ ├── controllers/
│ │ │ └── auth.controller.ts
│ │ ├── services/
│ │ │ ├── auth.service.ts
│ │ │ └── jwt.service.ts
│ │ ├── strategies/
│ │ │ └── jwt.strategy.ts
│ │ ├── guards/
│ │ │ └── jwt-auth.guard.ts
│ │ ├── decorators/
│ │ │ └── public.decorator.ts
│ │ ├── dto/
│ │ │ ├── register.dto.ts
│ │ │ ├── login.dto.ts
│ │ │ ├── refresh-token.dto.ts
│ │ │ └── user-response.dto.ts
│ │ ├── interfaces/
│ │ │ └── jwt-payload.interface.ts
│ │ └── auth.module.ts
│ ├── users/
│ │ ├── controllers/
│ │ │ └── users.controller.ts
│ │ ├── services/
│ │ │ └── users.service.ts
│ │ ├── dto/
│ │ │ └── create-user.dto.ts
│ │ └── users.module.ts
│ └── health/
│ ├── controllers/
│ │ └── health.controller.ts
│ └── health.module.ts
├── shared/
│ ├── decorators/
│ ├── filters/
│ │ └── global-exception.filter.ts
│ ├── interceptors/
│ │ └── response.interceptor.ts
│ └── constants/
├── prisma/
│ ├── schema.prisma
│ ├── migrations/
│ └── seed.ts
├── config/
│ └── configuration.ts
└── main.ts

```

### 2.2 Data Flow

```

1. Registration: Client → AuthController → AuthService → UsersService → Prisma → Database
2. Login: Client → AuthController → AuthService → JWT → Token Response
3. Authenticated: Client → JwtAuthGuard → JwtStrategy → Controller → Service
4. Refresh: Client → AuthController → AuthService → Validate RT → New AT

```

---

## 3. Implementation Strategy

### 3.1 Phase 1: Database Schema Setup

**Goal:** Update Prisma schema and apply migrations.

**Tasks:**
1. Update `schema.prisma` with Levora Database Design v1.2
2. Add `@map` for all fields
3. Create migration: `pnpm prisma migrate dev --name init_levora_schema`
4. Run generation: `pnpm prisma generate`
5. Create seed script for Roles
6. Validate schema and database

**Success Criteria:**
- All 21 tables present
- Roles seeded correctly
- Migration runs without errors

### 3.2 Phase 2: Core Authentication Implementation

**Goal:** Implement JWT authentication system.

**Tasks:**
1. Install required dependencies
2. Configure JWT module with environment variables
3. Implement `JwtStrategy` with `passport-jwt`
4. Implement `JwtAuthGuard` extending `AuthGuard('jwt')`
5. Implement `@Public()` decorator
6. Register guard globally with `APP_GUARD`
7. Create DTOs: RegisterDto, LoginDto, RefreshTokenDto, UserResponseDto
8. Implement AuthService methods
9. Implement AuthController endpoints
10. Configure bcrypt for password hashing

**Success Criteria:**
- All endpoints functional
- Token generation works
- Guards protect routes correctly

### 3.3 Phase 3: User Profile Integration

**Goal:** Automatically create user profiles and implement user services.

**Tasks:**
1. Implement UsersService with CRUD operations
2. Create automatic UserProfiles creation on registration
3. Implement UsersController for profile management
4. Integrate with AuthService for user retrieval

**Success Criteria:**
- Profile created automatically on registration
- User data can be retrieved

### 3.4 Phase 4: Testing and Documentation

**Goal:** Ensure quality and provide comprehensive documentation.

**Tasks:**
1. Write unit tests for AuthService
2. Write unit tests for UsersService
3. Write E2E tests for authentication endpoints
4. Configure Swagger with decorators
5. Export Postman collection
6. Configure SonarQube
7. Implement HealthController for database checks

**Success Criteria:**
- All tests passing
- Swagger UI available
- Postman collection exported

---

## 4. API Design

### 4.1 Registration

```

POST /auth/register

Request:
{
"email": "user@example.com",
"password": "SecurePass123",
"firstName": "John",
"lastName": "Doe"
}

Response (201):
{
"statusCode": 201,
"message": "User registered successfully",
"data": {
"id": "uuid",
"email": "user@example.com",
"firstName": "John",
"lastName": "Doe",
"isEmailVerified": false,
"isActive": true,
"createdAt": "2026-08-19T10:00:00.000Z"
},
"timestamp": "2026-08-19T10:00:00.000Z"
}

Error (400, 409, 500)

```

### 4.2 Login

```

POST /auth/login

Request:
{
"email": "user@example.com",
"password": "SecurePass123"
}

Response (200):
{
"statusCode": 200,
"message": "Login successful",
"data": {
"accessToken": "eyJhbGci...",
"refreshToken": "eyJhbGci...",
"user": {
"id": "uuid",
"email": "user@example.com",
"firstName": "John",
"lastName": "Doe"
}
},
"timestamp": "2026-08-19T10:00:00.000Z"
}

Error (401, 500)

```

### 4.3 Refresh Token

```

POST /auth/refresh

Request:
{
"refreshToken": "eyJhbGci..."
}

Response (200):
{
"statusCode": 200,
"message": "Token refreshed successfully",
"data": {
"accessToken": "eyJhbGci..."
},
"timestamp": "2026-08-19T10:00:00.000Z"
}

Error (401, 500)

```

### 4.4 Get Profile

```

GET /auth/me

Headers:
Authorization: Bearer <accessToken>

Response (200):
{
"statusCode": 200,
"message": "Profile retrieved successfully",
"data": {
"id": "uuid",
"email": "user@example.com",
"firstName": "John",
"lastName": "Doe",
"isEmailVerified": false,
"isActive": true,
"lastLoginAt": "2026-08-19T10:00:00.000Z",
"profile": {
"fullName": "John Doe",
"completionPct": 0,
"isDraft": true
}
},
"timestamp": "2026-08-19T10:00:00.000Z"
}

Error (401, 500)

````

---

## 5. Database Schema Changes

### 5.1 Users Model Additions

```prisma
model Users {
  // Existing fields from template
  id               String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email            String    @unique @db.Citext
  password         String?   @db.Text
  firstName        String?   @map("first_name") @db.VarChar(255)
  lastName         String?   @map("last_name") @db.VarChar(255)

  // New Levora fields
  isEmailVerified  Boolean   @default(false) @map("is_email_verified")
  isActive         Boolean   @default(true) @map("is_active")
  lastLoginAt      DateTime? @map("last_login_at") @db.Timestamptz(6)
  deletedAt        DateTime? @map("deleted_at") @db.Timestamptz(6)

  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt        DateTime? @updatedAt @map("updated_at") @db.Timestamptz(6)

  // Relations
  userRoles        UserRoles[]
  userProfile      UserProfiles?
  // ... other relations
}
````

### 5.2 New Models to Add

All models from Levora Database Design v1.2 must be added, including:

1. UserProfiles
2. UserEducations
3. SkillsMaster
4. UserSkills
5. LanguagesMaster
6. UserLanguages
7. OauthIdentities
8. Documents
9. Opportunities
10. SavedOpportunities
11. Applications
12. ApplicationStatusHistory
13. ApplicationDocuments
14. Reminders
15. Notifications
16. Subscriptions
17. Payments
18. ChangeLog

### 5.3 Role System (M:N)

```prisma
model Roles {
  id          Int       @id @default(autoincrement())
  name        String    @unique @db.VarChar(100)
  description String?   @db.VarChar(255)
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime? @updatedAt @map("updated_at") @db.Timestamptz(6)

  userRoles   UserRoles[]

  @@map("roles")
}

model UserRoles {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  roleId    Int       @map("role_id")
  isActive  Boolean   @default(true) @map("is_active")
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime? @updatedAt @map("updated_at") @db.Timestamptz(6)

  user      Users     @relation(fields: [userId], references: [id], onDelete: Cascade)
  roles     Roles     @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@map("user_roles")
}
```

---

## 6. Testing Plan

### 6.1 Unit Tests

| Test Suite   | Target                               | Coverage Goal |
| ------------ | ------------------------------------ | ------------- |
| AuthService  | Register, login, refresh, validation | ≥ 80%         |
| UsersService | CRUD operations, profile creation    | ≥ 80%         |
| JwtStrategy  | Token validation                     | ≥ 80%         |

### 6.2 E2E Tests

| Test Suite        | Endpoints to Test                             |
| ----------------- | --------------------------------------------- |
| Registration Flow | POST /auth/register (success, failure cases)  |
| Login Flow        | POST /auth/login (success, failure cases)     |
| Token Refresh     | POST /auth/refresh (success, failure cases)   |
| Profile Access    | GET /auth/me (authenticated, unauthenticated) |
| Guard Protection  | Protected routes with/without token           |

### 6.3 Integration Tests

| Test Suite           | Description                   |
| -------------------- | ----------------------------- |
| Database Integration | Verify data persistence       |
| Migration Tests      | Verify schema after migration |
| Seed Tests           | Verify roles seeded correctly |

---

## 7. Configuration

### 7.1 Environment Variables (.env.example)

```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/levora?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="15m"
REFRESH_TOKEN_EXPIRES_IN="7d"

# Application
APP_PORT=3000
NODE_ENV=development

# Security
BCRYPT_ROUNDS=12
```

### 7.2 Configuration Module

```typescript
// config/configuration.ts
export default () => ({
  port: parseInt(process.env.APP_PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  bcrypt: {
    rounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  },
});
```

---

## 8. Quality Gates

| Gate   | Check                                 | Pass/Fail |
| ------ | ------------------------------------- | --------- |
| Gate 1 | `pnpm lint` passes with no errors     | [ ]       |
| Gate 2 | `pnpm test` passes with ≥80% coverage | [ ]       |
| Gate 3 | `pnpm build` completes successfully   | [ ]       |
| Gate 4 | All migrations applied successfully   | [ ]       |
| Gate 5 | Swagger UI accessible at `/api`       | [ ]       |
| Gate 6 | Postman collection exported           | [ ]       |
| Gate 7 | SonarQube analysis passes             | [ ]       |
| Gate 8 | Health checks functional              | [ ]       |

---

## 9. References

- [Levora Database Design v1.2](../database/Levora_Database_Design_v1.2_MVP.md)
- [System Architecture Design v2.0](../architecture/System_Architecture_Design.md)
- [AGENTS.md](../AGENTS.md)
- [SRS v1.0 Section 3.1](../requirements/Levora_SRS.md#31-authentication-account-management)

```

---

```
