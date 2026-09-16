# Task: Issue A — Missing Education Creation Endpoint

## Issue Summary

`UserEducations` is a first-class Prisma model (`prisma/schema.prisma` lines 132–148) with three non-nullable required fields (`degree`, `major`, `institution`) but has **zero API surface**. No controller, service, or DTO exists for this model.

The only code that touches the table today is buried in `ProfileService.updateProfile()` — two GPA-write branches that call `userEducations.findFirst` and throw `BadRequestException` if the table is empty for that user. Since there is no endpoint to create education records, **every new user is permanently blocked from setting their GPA**.

**Branch:** `feature/issue-a`

---

## Prerequisites

> [!IMPORTANT]
> The following open questions **must be resolved** by the team before implementation begins. Do not start coding until all decisions are recorded.

- [ ] **Q-A:** Maximum number of education records per user? (Languages = 5, Skills = 20 — no policy yet for education)
- [ ] **Q-B:** Should GPA (`gpaValue`, `gpaScale`) be moved to `PATCH /profile/educations/:id`, or stay in `PATCH /profile`?
- [ ] **Q-C:** Is `educations[0]` (most recently created) the canonical GPA source, or is GPA tracked per-record independently?
- [ ] **Q-D:** Should `completionPct` award points for having ≥ 1 education record?
- [ ] **Q-E:** On DELETE of the most recent record: should GPA data be migrated to the next record, or discarded?
- [ ] **Q-F:** Should `degree`, `major`, `institution` be validated against enums, or remain free-text?
- [ ] **Q-G:** Should `GET /profile/educations` return the raw Prisma shape or a mapped DTO?

---

## Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `src/modules/profile/dto/create-education.dto.ts` | DTO for `POST /profile/educations` |
| `src/modules/profile/dto/update-education.dto.ts` | DTO for `PATCH /profile/educations/:id` |
| `src/modules/profile/services/educations.service.ts` | Service: CRUD for `UserEducations` |
| `src/modules/profile/services/educations.service.spec.ts` | Unit tests for `EducationsService` |
| `src/modules/profile/controllers/educations.controller.ts` | Controller: `GET`, `POST`, `PATCH`, `DELETE` on `profile/educations` |

### Modified Files

| File | Change |
|------|--------|
| `src/modules/profile/profile.module.ts` | Register `EducationsController` in `controllers[]` and `EducationsService` in `providers[]` |
| `src/modules/profile/services/profile.service.ts` | Update `ProfileWithRelations` interface (lines 13–30) to declare `userEducations` for type safety |

---

## Step-by-Step Implementation Checklist

### Step 1 — Create `create-education.dto.ts`
- **File:** `src/modules/profile/dto/create-education.dto.ts`
- **What to do:** Define the DTO with the following fields derived from `UserEducations` schema (L132–148):
  - `degree: string` — required, `@IsString()`, `@IsNotEmpty()`
  - `major: string` — required, `@IsString()`, `@IsNotEmpty()`
  - `institution: string` — required, `@IsString()`, `@IsNotEmpty()`
  - `graduationYear?: number` — optional, `@IsOptional()`, `@IsInt()`, range validator (e.g., 1900–2100)
- **GPA fields are excluded from this DTO** — pending resolution of Q-B.
- **Verify:** Running `pnpm build` compiles without errors. Attempting to instantiate with missing required fields fails validation.

### Step 2 — Create `update-education.dto.ts`
- **File:** `src/modules/profile/dto/update-education.dto.ts`
- **What to do:** Use `PartialType(CreateEducationDto)` from `@nestjs/mapped-types` to make all fields optional. If Q-B resolves that GPA moves here, add `gpaValue` and `gpaScale` fields with appropriate validators (see Issue B/C task files for details on GPA validation).
- **Verify:** All fields are optional. No required fields remain after PartialType.

### Step 3 — Create `educations.service.ts`
- **File:** `src/modules/profile/services/educations.service.ts`
- **What to do:** Create an `@Injectable()` `EducationsService` with constructor injecting `PrismaService` and `ProfileService`.
- Implement the following methods:

| Method | Description |
|--------|-------------|
| `findAll(userId: string)` | `prisma.userEducations.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })` |
| `create(userId: string, dto: CreateEducationDto)` | Count-check (if limit decided in Q-A), then `prisma.userEducations.create(...)`, then call `profileService.recalculateProfileStatus(userId)` |
| `update(userId: string, id: string, dto: UpdateEducationDto)` | Verify record belongs to user before updating. `prisma.userEducations.update(...)`. No recalculate needed unless GPA is moved here (Q-B). |
| `remove(userId: string, id: string)` | Verify record belongs to user. `prisma.userEducations.delete(...)`. Handle GPA migration or discard per Q-E decision. Call `profileService.recalculateProfileStatus(userId)`. Catch Prisma P2025 → throw `NotFoundException`. |

- **Verify:** Service methods match the patterns of `LanguagesService` and `SkillsService` for consistency.

### Step 4 — Create `educations.controller.ts`
- **File:** `src/modules/profile/controllers/educations.controller.ts`
- **What to do:** Create controller following the same pattern as `LanguagesController` and `FieldsOfStudyController`:
  - `@ApiTags('profile/educations')`
  - `@ApiBearerAuth()`
  - `@UseGuards(JwtAuthGuard)` at class level
  - `@Controller('profile/educations')`

| Endpoint | Decorator | Response |
|----------|-----------|----------|
| `GET /profile/educations` | `@Get()` | 200 + data array |
| `POST /profile/educations` | `@Post()` | 201 + created record |
| `PATCH /profile/educations/:id` | `@Patch(':id')` | 200 + updated record |
| `DELETE /profile/educations/:id` | `@Delete(':id')` + `@HttpCode(204)` | 204 no body |

- All responses follow the project standard: `{ statusCode, message, data, timestamp }`.
- Use `@Param('id', ParseUUIDPipe)` on `:id` routes for UUID validation.
- **Verify:** Routes are accessible. DELETE returns 204 with no response body.

### Step 5 — Fix `ProfileWithRelations` interface type gap
- **File:** `src/modules/profile/services/profile.service.ts`
- **Location:** Lines 13–30 — the `ProfileWithRelations` interface
- **What to do:** Add `userEducations` to the `user` sub-object of the interface so TypeScript can catch shape errors on the `getProfileWithDetails()` call at line 204.
- **Verify:** `tsc --noEmit` passes with no new errors.

### Step 6 — Register in `profile.module.ts`
- **File:** `src/modules/profile/profile.module.ts`
- **What to do:**
  - Import `EducationsController` and add to `controllers[]`
  - Import `EducationsService` and add to `providers[]`
- **Verify:** Run `pnpm start:dev` and confirm no "unknown dependency" injection errors. Confirm `GET /profile/educations` returns 200 (not 404).

> [!CAUTION]
> Forgetting this step produces a silent 404 — no compile error warns you. This is the most common mistake when adding new NestJS modules.

### Step 7 — Run linter and build
- `pnpm lint` — zero errors required
- `pnpm build` — must succeed before marking done

---

## Code Review Checklist

- [ ] Are `degree`, `major`, and `institution` marked `@IsNotEmpty()` to prevent Prisma P2000 errors on empty strings?
- [ ] Is `EducationsController` **and** `EducationsService` both registered in `profile.module.ts`?
- [ ] Are GPA fields excluded from `CreateEducationDto` (unless Q-B was resolved to include them here)?
- [ ] Does `EducationsService.remove()` handle the GPA data per Q-E decision (migrate or discard)?
- [ ] Does each mutating method call `recalculateProfileStatus(userId)` after success?
- [ ] Does the controller return HTTP 204 (no body) for DELETE?
- [ ] Does the controller use `ParseUUIDPipe` on all `:id` route params?
- [ ] Does `update()` verify the record belongs to the authenticated user before updating (prevent IDOR)?
- [ ] Does `remove()` verify the record belongs to the authenticated user before deleting?
- [ ] Has `ProfileWithRelations` been updated to include `userEducations`?
- [ ] Do all endpoints follow the standard `{ statusCode, message, data, timestamp }` response shape?
- [ ] Does `pnpm lint` pass with zero errors?

---

## Test Plan

Write the following test cases in `src/modules/profile/services/educations.service.spec.ts`:

| # | Scenario | Expected outcome |
|---|----------|-----------------|
| 1 | `create()` with valid `degree`, `major`, `institution` | Record created, `recalculateProfileStatus` called, record returned |
| 2 | `create()` with missing required fields (empty `degree`) | Prisma or validation rejects; throws appropriate error |
| 3 | `create()` when user already has N records (limit from Q-A) | Throws `BadRequestException('Maximum N educations allowed')` |
| 4 | `findAll()` for authenticated user | Returns array of user's records in descending creation order |
| 5 | `update()` with valid id belonging to the user | Record updated, returns updated shape |
| 6 | `update()` with an id that belongs to another user | Throws `NotFoundException` or `ForbiddenException` |
| 7 | `remove()` with valid id belonging to the user | Record deleted, `recalculateProfileStatus` called, returns void |
| 8 | `remove()` with non-existent id | Catches Prisma P2025, throws `NotFoundException` |
| 9 | Full GPA flow (create education → `PATCH /profile` with GPA) | GPA writes successfully to the new education record |

---

## Definition of Done

- [ ] All five new files created and populated
- [ ] `profile.module.ts` updated with new controller and service registrations
- [ ] `ProfileWithRelations` interface updated in `profile.service.ts`
- [ ] All open questions (Q-A through Q-G) resolved and decisions documented
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm build` succeeds
- [ ] All test cases in `educations.service.spec.ts` written and passing
- [ ] `pnpm test` passes with no regressions in existing tests
- [ ] Code review approved by at least one other developer
- [ ] `GET /profile/educations` smoke-tested in staging environment
