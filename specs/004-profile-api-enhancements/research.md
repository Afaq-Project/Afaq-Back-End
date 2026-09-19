# Research: Profile API Enhancements & Reference Data Expansion

**Feature**: 004-profile-api-enhancements | **Phase**: 0 — Research
**Date**: 2026-09-18

---

## Investigation Areas

### 1. Shared Pagination Infrastructure

**Decision**: Extend the existing `PaginationDto` at `src/common/dto/pagination.dto.ts` rather than creating a new file.

**Finding**: `PaginationDto` already exists with `page`, `limit`, and a `get skip()` getter. It is already used by `UsersService` via `UserQueryDto extends PaginationDto`. A `search` field is absent and must be added. A sibling `PaginationQueryDto` with `search` can extend `PaginationDto`, or `search` can be added directly.

**Rationale**: Centralising in the existing file maintains a single source of truth. Adding `search?: string` with `@IsOptional() @IsString() @MaxLength(100)` is non-breaking for all existing consumers.

**Alternatives considered**: Creating a separate `src/common/dto/pagination-query.dto.ts` — rejected to avoid duplication with the existing `PaginationDto`.

**Action**: Add `search?: string` to `PaginationDto`. Add a shared `buildMeta()` utility in `src/common/utils/paginate.util.ts` to compute the `meta.pagination` object.

---

### 2. EducationLevel Model — DB vs DTO Validation

**Decision**: Create a new `EducationLevel` Prisma model (database table) for the lookup list, but keep `UserProfiles.educationLevel` as a `String?` field validated at DTO level via `@IsIn([...])` in this sprint.

**Finding**: The architect confirmed `UserProfiles.educationLevel` is `String? @db.Text`. Creating the table does not require changing this column yet. The FK migration is deferred. This avoids a destructive migration on an active column while still delivering the standardised dropdown and seed data.

**Rationale**: Zero data migration risk. The `EducationLevel` table exists and is seeded; its values serve as the canonical list. `@IsIn()` enforces the contract at the API layer.

**Alternatives considered**: Immediate FK migration — rejected due to risk of NULLing existing profile rows and requiring a backfill script.

---

### 3. Global ValidationPipe — Already Configured

**Decision**: No changes required to `main.ts`.

**Finding**: `main.ts` already has `useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`. All new DTOs that extend `PaginationDto` will automatically benefit from this global pipe — no per-controller `@UsePipes()` is needed. The `skills.controller.ts` uses a redundant local `@UsePipes(new ValidationPipe())` that can be removed as cleanup.

---

### 4. UUID Validation — ParseUUIDPipe

**Decision**: Add `new ParseUUIDPipe({ version: '4' })` to all `@Param()` decorators that accept UUID route parameters across `skills.controller.ts` and `languages.controller.ts`.

**Finding**: Both controllers accept `:skillId` and `:languageId` as raw strings. No pipe is applied. NestJS's `ParseUUIDPipe` is built-in and requires no new dependencies.

---

### 5. Rate Limiting — ThrottlerGuard

**Decision**: Apply `@Throttle({ default: { limit: 5, ttl: 60000 } })` to `AuthController` methods (`login`, `register`) using the `@Throttle()` decorator from `@nestjs/throttler`.

**Finding**: `@nestjs/throttler` is configured globally. The global guard allows `ThrottlerModule` defaults to apply to all routes. Individual stricter overrides can be set at the controller or method level using `@Throttle()`. Reference endpoints should receive `@SkipThrottle()` to prevent false positives from legitimate high-frequency frontend polling.

---

### 6. Response Envelope — GET /users Pagination Nesting

**Decision**: Update `UsersService.findAll()` return value to nest pagination fields under `pagination` key inside `meta`, matching the `PaginatedResponse` DTO standard.

**Finding**: `UsersService.findAll()` currently returns `{ data, total, page, limit, totalPages, hasNext, hasPrev }` flat. The `TransformInterceptor` wraps responses — the `meta` field in the interceptor needs to receive `{ pagination: {...} }` instead of the flat fields.

---

### 7. skills-taxonomy Dual-Mode Response

**Decision**: Implement a mode-switch in `ReferenceService.getSkillsTaxonomy()` based on whether any query parameter is present.

**Finding**: When `search`, `category`, or pagination params are absent, the existing grouped response is preserved (`[{ category, skills[] }]`). When any param is provided, a flat paginated response is returned. This preserves the existing frontend contract while adding search capability.

---

### 8. App Languages — Static vs DB

**Decision**: Hardcoded constant array in `src/modules/profile/constants/app-languages.constant.ts`.

**Finding**: App UI locales (`en`, `ar`, `fr`, `de`, `es`, `tr`) are tightly coupled to translation bundle releases. A DB table would add latency and require migrations for what is a code-level concern. The constant includes BCP-47 `code`, `name`, `nativeName`, and `dir` fields.

---

### 9. Multi-Agent Parallelisation Strategy

**Decision**: Split implementation into 4 independent agent lanes that can run concurrently after the shared infrastructure (T-001, T-002) is committed.

| Lane | Agent | Scope |
|---|---|---|
| **Lane A** | Agent 1 — Infrastructure | `PaginationDto` extension + `buildMeta` util + `EducationLevel` schema + migration + seed |
| **Lane B** | Agent 2 — Reference Endpoints | `GET /reference/languages`, `GET /reference/app-languages`, `GET /reference/education-levels`, modify `fields-of-study` and `skills-taxonomy` |
| **Lane C** | Agent 3 — Profile Sub-Lists | Pagination retrofit on skills, languages, documents, educations controllers + services |
| **Lane D** | Agent 4 — Security & Tests | `ParseUUIDPipe` on all UUID params, `@Throttle` on auth, `GET /users` envelope fix, Postman/smoke test updates |

**Dependency**: Lanes B, C, D all depend on Lane A completing first (shared DTO and util must be available). Lanes B, C, D are independent of each other and can proceed in parallel once Lane A is merged.
