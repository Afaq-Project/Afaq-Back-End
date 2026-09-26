<!--
=============================================================
SYNC IMPACT REPORT
=============================================================
Version change  : 1.0.0 → 1.0.1
Bump type       : PATCH — Clarifications to existing principles.
Added sections  :
  - Emergency Amendments (under Governance)
Removed sections: N/A
Modified        :
  - Principle IV (forbidNonWhitelisted clarity)
  - Principle X (SystemSettingsService fallbacks)
  - Principle VI (coverage clarification)
  - Principle VII (--no-verify requirements)
  - Technology Stack (added Storage Provider & External APIs)
Deferred TODOs  : None.
=============================================================
-->

# Levora Constitution

## Core Principles

### I. Architecture Boundaries

The call-flow direction is non-negotiable: **Controller → Service → Repository**.

- Controllers MUST contain only request parsing, input validation delegation, guard enforcement,
  and response formatting. Business logic in a Controller is a constitution violation.
- Services MAY call other Services. Circular dependencies between Services are FORBIDDEN and
  will be caught at module load time.
- Database access from a Controller (direct or via Prisma) is FORBIDDEN.
- All external adapters (storage providers, external HTTP APIs, third-party SDKs) MUST reside
  in the Infrastructure layer only and be injected into Services via NestJS DI.

*Rationale: Clear boundaries make ownership, testing, and replacement of any layer possible
without cascading changes into others.*

### II. Data Access & Persistence

Prisma Client is the **single source of database access** in this project. No other ORM, query
builder, or raw driver connection is permitted.

- Services MAY call `PrismaService` directly for simple, single-table reads and writes.
- Complex queries (multi-table joins, aggregations, derived logic) MUST be extracted into
  **Repository classes** that encapsulate and name the intent of the query.
- `prisma.$queryRaw` and `prisma.$executeRaw` require an explicit code comment justifying why
  Prisma's standard API cannot serve the use case, and MUST be approved in code review.

*Rationale: Direct Prisma access prevents over-engineering simple paths; Repositories prevent
query logic from spreading into Services and becoming untestable.*

### III. Schema & Migrations

`prisma/schema.prisma` is the **single source of truth** for the database schema.

- All schema changes MUST be applied through `prisma migrate dev` (development) or
  `prisma migrate deploy` (CI/production). Manual DDL changes to any environment are FORBIDDEN.
- `prisma db push` is permitted **only in local development** for rapid iteration. It MUST
  never be used in staging or production.
- Every generated migration file MUST be reviewed before being committed to version control.
- **Destructive migrations** (DROP TABLE, DROP COLUMN, data-altering `UPDATE`s) require:
  1. A documented backup step.
  2. Explicit approval from the technical lead before deployment.
  3. A rollback procedure noted in the migration PR.

*Rationale: Migrations are the audit trail of the data model. Bypassing them creates drift
that is impossible to recover from in production.*

### IV. API Contracts & Validation

Every endpoint MUST define explicit input and output shapes. The API surface is a contract.

- All input DTOs MUST use `class-validator` decorators and be processed by the global
  `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`. Note that
  `forbidNonWhitelisted: true` rejects any extra field sent by the client. This MUST be
  documented as a coordination requirement with the frontend team.
- All output MUST pass through a dedicated Response DTO or be shaped explicitly in the
  controller. **Returning raw Prisma model objects from endpoints is FORBIDDEN** — this
  exposes internal schema to consumers.
- All API responses MUST follow the envelope:
  `{ statusCode: number, message: string, data: T, timestamp: string }`.
- Errors MUST follow the same envelope shape via `GlobalExceptionFilter`. Exceptions that
  bypass the filter and expose raw stack traces are a violation.

*Rationale: Consistent contracts allow frontend teams to depend on stable shapes and enable
schema-level testing without reading service internals.*

### V. Security & Authorization

Security rules are non-negotiable and apply to every endpoint.

1. **Authentication:** All endpoints require a valid JWT unless the handler is explicitly
   decorated with `@Public()`. An undecorated, unguarded endpoint is a violation.
2. **Authorization:** Ownership guards (`DocumentOwnershipGuard`, `EducationOwnershipGuard`,
   etc.) MUST be applied on all routes that access user-owned resources. The `userId` used for
   authorization MUST be derived from the authenticated JWT payload (`req.user.id`) — trusting
   `userId` from the request body or query parameters is FORBIDDEN.
3. **Secrets:** All API keys, connection strings, JWT secrets, and OAuth credentials MUST be
   stored as environment variables and loaded via `ConfigService`. Hardcoding secrets anywhere
   in the codebase (including test files) is FORBIDDEN. Secrets MUST never appear in logs.
4. **Passwords** MUST be hashed with `bcrypt`. Plaintext password storage or comparison is
   FORBIDDEN.

*Rationale: These rules exist not as suggestions but as the minimum bar to avoid catastrophic
data breaches and privilege escalation.*

### VI. Testing

Testing is scoped to real risk — not coverage theater.

- **Unit tests** are REQUIRED for all Services that contain business logic, including but not
  limited to: `ProfileService`, `AuthService`, `EducationsService`, `LanguagesService`,
  `DocumentsService`, `PreferencesService`. Tests MUST follow the Arrange-Act-Assert pattern.
- **Integration tests** are REQUIRED for all authentication flows (login, OAuth, token refresh)
  and any endpoint that performs a mutation on critical data (profile, documents, educations).
- No minimum coverage percentage is enforced. Coverage percentage is not enforced as a gate,
  but the required Unit tests for business-logic services will naturally cover the majority
  of critical paths. However, **every bug fix MUST be accompanied by a regression test**
  that would have caught the bug before the fix.
- Tests MUST NOT rely on production data or live external services. All external dependencies
  MUST be mocked or replaced with test doubles.

*Rationale: Mandatory unit and integration tests for high-risk paths provide safety without
the overhead of 100% coverage on trivial getters.*

### VII. Code Quality Gates

A task is NOT done until all three gates pass locally.

- `pnpm build` — TypeScript compilation with zero errors.
- `pnpm lint` — ESLint with zero errors (warnings are tolerated but MUST not increase between
  commits). Auto-fix via `pnpm lint --fix` is encouraged before committing.
- `pnpm test` — All test suites pass.

In addition:

- **Husky pre-commit hooks** MUST enforce `lint-staged` (lint + type-check on staged files).
  Bypassing hooks with `--no-verify` is permitted only in rare situations. Bypassing MUST be
  recorded in the next commit message using the prefix `hotfix-bypass:` with the reason. A
  fix commit MUST follow within 24 hours.
- **Commit messages** MUST follow Conventional Commits:
  `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`, `perf:`.
  The scope is encouraged: e.g., `feat(profile): add matchable toggle endpoint`.

*Rationale: Automated gates remove the burden of manual review for mechanical correctness and
ensure the build is always green on the main branch.*

### VIII. Documentation

Documentation is a first-class deliverable, not an afterthought.

- **Architectural decisions** MUST be recorded in `docx/decisions-log.md` using the
  `DEC-<MODULE>-<NN>` format before implementation begins.
- **All public API endpoints** MUST be decorated with `@ApiOperation`, `@ApiResponse`, and
  `@ApiProperty` on their DTOs. An undocumented public endpoint is a violation.
- **Complex service methods** with non-trivial logic MUST have JSDoc comments on their public
  signatures explaining the intent, parameters, and return shape.
- **`.env.example`** MUST be updated every time a new environment variable is introduced.
  The variable MUST include a comment explaining its purpose.
- The **README** MUST remain accurate for local setup and first-run instructions.

*Rationale: Documentation enables new contributors to onboard without requiring tribal
knowledge and makes the API self-describing for frontend consumers.*

### IX. Error Handling & Logging

Errors MUST be handled explicitly and uniformly. Silent failures are not permitted.

- All application errors MUST be thrown as typed NestJS HTTP exceptions
  (`NotFoundException`, `ForbiddenException`, `BadRequestException`, `ConflictException`,
  `UnprocessableEntityException`, etc.) or as custom exceptions extending `HttpException`.
- Generic `Error` or untyped `throw` statements that produce 500 responses without context
  are FORBIDDEN except at true unexpected failure points, where they MUST be caught and
  re-thrown with adequate context by `GlobalExceptionFilter`.
- The NestJS `Logger` service MUST be used for all logging. `console.log`, `console.error`,
  and `console.warn` are FORBIDDEN in production code paths.
- Log levels MUST be used appropriately: `error` for failures, `warn` for degraded states,
  `log` for significant events, `debug`/`verbose` for development tracing.
- **Passwords, tokens, raw JWT payloads, and personally identifiable information (PII) MUST
  never appear in log output** at any level.

*Rationale: Consistent error handling produces predictable API responses and auditable logs
without leaking sensitive internals to clients or log aggregators.*

### X. Configuration & Environment

The application MUST be configuration-complete or fail at startup — never partially configured.

- All configuration MUST be loaded through NestJS `ConfigService` backed by `@nestjs/config`.
  Direct access to `process.env` inside Services or Controllers is FORBIDDEN.
- Configuration MUST be validated at startup using `class-validator`. Any missing or invalid
  required variable MUST cause an immediate, descriptive startup failure (fail-fast principle).
- No configuration value (URLs, thresholds, limits, secrets) is hardcoded inside Services.
  Application-tunable values (e.g., completion thresholds, record limits) MUST be stored in
  the `SystemSettings` table and read via `SystemSettingsService`. `SystemSettingsService`
  MUST always provide code-level fallback defaults. A missing key MUST never cause a
  runtime failure.
- Every new environment variable MUST have a corresponding entry in `.env.example` with a
  descriptive comment before the PR is merged.

*Rationale: A misconfigured deployment is worse than no deployment. Fail-fast prevents
silent, data-corrupting partial states that are difficult to diagnose in production.*

### XI. Module Boundaries & Dependency Direction

Each NestJS module represents a **bounded context** with a clear, single responsibility.

- Modules MUST expose capabilities only through explicit `exports` in their `@Module` decorator.
  Importing internal services of another module directly (without them being exported) is
  FORBIDDEN.
- The dependency direction MUST always flow inward:
  Infrastructure → Application (Services) → Domain. Outer layers MUST NOT be imported by
  inner layers.
- Cross-module communication MUST happen exclusively through publicly exported Service
  interfaces. No module may reach into another module's Repository, guard, or DTO internals.
- Each module MUST own its own DTOs, guards, and local types. Shared types belong in
  `src/shared/` or `src/common/` — not in any feature module.

*Rationale: Strict module boundaries allow modules to be developed, tested, and replaced in
isolation. Violation of this principle is the most common source of untestable coupling.*

## Technology Stack

The following technologies are ratified for this project. Introducing an alternative to any
item below requires a formal ADR in `docx/decisions-log.md` and amendment to this section.

| Concern | Technology |
|:---|:---|
| Runtime | Node.js (LTS) |
| Framework | NestJS |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL |
| ORM / Query | Prisma |
| Authentication | JWT + Passport.js |
| Password hashing | bcrypt |
| Validation | class-validator + class-transformer |
| API Documentation | Swagger (NestJS Swagger module) |
| Testing | Jest |
| Package manager | pnpm |
| Git hooks | Husky + lint-staged |
| Storage Provider | S3-compatible (Infrastructure layer only) |
| External APIs | Recommendations, Opportunities (Infrastructure layer only) |

## Governance

This constitution is the **highest-authority governance document** in this repository. It
supersedes all README guidance, inline comments, and verbal agreements. When a conflict exists
between this document and any other source, this document governs.

**Amendment procedure:**

1. Propose the change in a dedicated PR with a description of the problem and the new rule.
2. Record the decision context in `docx/decisions-log.md` as a `DEC-CROSS-NN` entry.
3. Update this constitution file and increment the version per the Versioning Policy below.
4. Obtain explicit approval from the technical lead before merging.

**Versioning policy:**

- `MAJOR` — Backward-incompatible change: removal or redefinition of an existing principle.
- `MINOR` — New principle or section added, or an existing principle materially expanded.
- `PATCH` — Clarifications, wording fixes, or non-semantic refinements.

**Compliance review:**

- Compliance with this constitution is verified during every code review.
- A PR that violates any principle MUST NOT be merged, regardless of other approvals.
- Reviewers are responsible for checking: architecture boundaries, DTO shapes, error
  handling patterns, test coverage of changed logic, and documentation completeness.

**Emergency Amendments:**
In case of a security incident or critical bug requiring immediate policy change, the
technical lead may amend this constitution directly. The change MUST be documented in
`docx/decisions-log.md` and ratified retroactively within 7 days.

**Version**: 1.0.1 | **Ratified**: 2026-09-21 | **Last Amended**: 2026-09-21
