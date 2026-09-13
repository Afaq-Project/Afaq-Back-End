# Phase 2 — Implementation Plan (REVISED)
## Profile Module Refactoring — Levora Backend

| Field | Value |
|:------|:------|
| **Plan Date** | 2026-09-12 |
| **Branch** | `fix/profile-relationships` @ `f7fa5bb` |
| **Scope** | 9 issues + 5 sub-findings + 7 revised decisions + 5 refinements |
| **Migrations Required** | ✅ Yes (2 Prisma migrations in final PR) |
| **Code Changes** | TypeScript, NestJS, Prisma Schema |

---

## 1. Executive Summary

This revised plan incorporates all Gate 2 and Gate 3 pre-approval decisions. The most significant architectural change is refactoring `UserProfiles.fieldOfStudy` from a native `String[]` into a `UserFieldsOfStudy` join table linked to the `FieldOfStudy` master table. 

This phase removes `skills` and `languages` from the `PATCH /profile` DTO (a hard breaking change without deprecation). Non-deterministic GPA bugs and dead code are resolved. The plan includes robust handling for Prisma P2002 constraint violations, dedicated database-backed completion percentage recalculations, comprehensive testing strategies, and a final Postman collection sync. The language seeds have been simplified to just Arabic and English.

---

## 2. Decision Log with Validated Impact

| # | Decision | Validated | Blast Radius | Key Finding |
|:-:|:---------|:----------|:-------------|:------------|
| D1 | **Hard Removal** of `skills`/`languages` from `PATCH` | ✅ | High | **Breaking Change.** `forbidNonWhitelisted: true` is active. |
| D2 | Ignore `isActive` for `LanguagesMaster` | ✅ | None | Zero references exist. Schema has no column. Safe. |
| D3 | Remove dead code L284–290 | ✅ | None | Code is unreachable. Safe to remove. |
| D4 | Fix both GPA branches together | ✅ | Low | Both branches fixed by using `findFirst` + `orderBy: { createdAt: 'asc' }`. |
| D5 | Delete `docs/postman/` copy | ✅ | Low | CI does not reference it. |
| D6 | 1 commit/task, no push | ✅ | N/A | Strict local commit discipline enforced. |
| D7 | **fieldOfStudy Join Table** | ✅ | High | `FieldOfStudy` master table exists. Schema needs new `UserFieldsOfStudy` model. |

---

## 3. Decision 7 Deep Dive — `fieldOfStudy` Join Table

### 3.1 Prisma Schema Delta

```prisma
// 1. Add new join model
model UserFieldsOfStudy {
  userId    String   @map("user_id") @db.Uuid
  fieldId   String   @map("field_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user      Users        @relation(fields: [userId], references: [id], onDelete: Cascade)
  field     FieldOfStudy @relation(fields: [fieldId], references: [id], onDelete: Cascade)

  @@id([userId, fieldId])
  @@map("user_fields_of_study")
}

// 2. Add relation to FieldOfStudy model:
// userFieldsOfStudy UserFieldsOfStudy[]

// 3. Add relation to Users model:
// userFieldsOfStudy UserFieldsOfStudy[]

// 4. In UserProfiles model:
// REMOVE: fieldOfStudy String[] @map("field_of_study") @db.Text
```

### 3.2 Migration Strategy (Single PR Scope with Warnings)

To streamline delivery, the schema migration is deployed in a single PR scope, but sequenced via two discrete migration files to safely handle data manipulation in between.

> [!WARNING]
> **IRREVERSIBLE MIGRATION:** Dropping the `fieldOfStudy` column destroys data permanently in the DB if the backup script isn't run. The ordering below is STRICT.

**Execution Order:**
1. Update `schema.prisma` with `UserFieldsOfStudy` (leave `String[]` intact).
2. `npx prisma migrate dev --name add_user_fields_of_study`
3. Run the Data Migration Script (Section 3.3).
4. Remove `fieldOfStudy String[]` from `UserProfiles`.
5. `npx prisma migrate dev --name drop_field_of_study_column`

### 3.3 Data Migration Script (`scripts/migrate-fields-of-study.ts`)

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting fieldOfStudy migration...');
  const profiles = await prisma.userProfiles.findMany({
    where: { NOT: { fieldOfStudy: { isEmpty: true } } }
  });

  let migrated = 0;
  const autoCreatedReport: string[] = [];

  for (const profile of profiles) {
    for (const fieldName of profile.fieldOfStudy) {
      let field = await prisma.fieldOfStudy.findFirst({
        where: { name: { equals: fieldName, mode: 'insensitive' } }
      });
      
      // Auto-create missing references to prevent data loss
      if (!field) {
        field = await prisma.fieldOfStudy.create({ data: { name: fieldName, category: 'Uncategorized' } });
        autoCreatedReport.push(`Auto-created Master Record: "${fieldName}" (User: ${profile.userId})`);
      }
      
      // Upsert join record to prevent duplicates
      await prisma.userFieldsOfStudy.upsert({
        where: { userId_fieldId: { userId: profile.userId, fieldId: field.id } },
        update: {},
        create: { userId: profile.userId, fieldId: field.id }
      });
      migrated++;
    }
  }
  
  console.log('\n--- AUTO-CREATE REPORT ---');
  autoCreatedReport.forEach(msg => console.log(msg));
  console.log(`\nMigration complete. Inserted ${migrated} join records.`);
}
migrate().finally(() => prisma.$disconnect());
```

---

## 4. Per-Issue Implementation Plan

### 4.1 CRIT-001 — Seed `languages_master`
Add to `prisma/seed.ts`:
```typescript
const languages = [ 'Arabic', 'English' ];
for (const name of languages) {
  await prisma.languagesMaster.upsert({
    where: { name }, update: {}, create: { name }
  });
}
```

### 4.2 Endpoint `isActive` Validation & P2002 Handling (For all new endpoints)
All new granular endpoints must enforce that the referenced master record is active, handle duplicate constraints gracefully, and recalculate completion percentages.

**Prerequisite Verification:** `GET /reference/skills-taxonomy` (L22) and `GET /reference/fields-of-study` (L10) in `reference.service.ts` are ALREADY using `where: { isActive: true }`.

```typescript
// 1. isActive validation (e.g., in SkillsService)
const masterRecord = await this.prisma.skillsMaster.findUnique({ where: { id: skillId } });
if (!masterRecord || !masterRecord.isActive) {
  throw new BadRequestException('The selected item is invalid or inactive.');
}

// 2. P2002 Duplicate Constraint Handling
try {
  await this.prisma.userSkills.create({ data: { userId, skillId, proficiency } });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ConflictException('This item has already been added to your profile.');
  }
  throw error;
}

// 3. CompletionPct Recalculation (MUST follow every Create/Delete)
await this.profileService.recalculateProfileStatus(userId);
```

### 4.3 Extracting `recalculateProfileStatus(userId)`
**Prerequisite Verification:** The method `calculateCompletionPct(profile: ProfileWithRelations)` currently exists in `profile.service.ts` at line 94, but it is a synchronous pure function. We must extract a wrapper method `recalculateProfileStatus(userId: string): Promise<void>` inside `ProfileService` that fetches the profile, runs the synchronous calculation, and updates the DB.

```typescript
async recalculateProfileStatus(userId: string): Promise<void> {
  const profile = await this.getProfileWithDetails(userId);
  if (!profile) return;
  const completionPct = this.calculateCompletionPct(profile);
  const isDraft = !this.isCoreFieldsComplete(profile);
  await this.prisma.userProfiles.update({
    where: { userId },
    data: { completionPct, isDraft },
  });
}
```

### 4.4 D1 — Hard Removal from `UpdateProfileDto`
In `updateProfile()`, replace DTO usage with existing DB relations:
```typescript
const mergedProfile: ProfileWithRelations = {
  ...currentProfile,
  ...profileData, 
  user: {
    userSkills: currentProfile.user?.userSkills ?? [],
    userLanguages: currentProfile.user?.userLanguages ?? [],
    userFieldsOfStudy: currentProfile.user?.userFieldsOfStudy ?? [], 
    documents: currentProfile.user?.documents ?? [],
  },
};
```

### 4.5 MED-002 & NEW-005 — Explicit `findFirst` for GPA
```typescript
const education = await prisma.userEducations.findFirst({
  where: { userId },
  orderBy: { createdAt: 'asc' },
});
if (!education) {
  throw new BadRequestException('No education record found. Please add an education record before setting GPA.');
}
await prisma.userEducations.update({ where: { id: education.id }, data: { ... } });
```

---

## 5. Commit Plan (Strictly Sequential, No Push)

| # | Task | Commit Message | Scope |
|:-:|:---|:---|:---|
| 1 | D5 | `chore(docs): remove stale Postman collection` | `docs/postman/` |
| 2 | CRIT-001 | `feat(seed): add Arabic and English to languages_master` | `prisma/seed.ts` |
| 3 | HIGH-001 | `feat(reference): add GET /reference/languages endpoint` | `reference.controller.ts`, `reference.service.ts` |
| 4 | D3 | `refactor(profile): remove dead code block in updateProfile` | `profile.service.ts` |
| 5 | D4 | `fix(profile): enforce deterministic ordering for GPA updates` | `profile.service.ts`, `profile.service.spec.ts` |
| 6 | HIGH-002/003 | `feat(profile): add dedicated skills and languages endpoints` | controllers, services, dtos for skills/lang |
| 7 | D7 (Phase 1) | `feat(schema): add UserFieldsOfStudy model and migrate data` | schema, initial migration, migration script, fields endpoints |
| 8 | D1 & D7 (Phase 2) | `refactor(profile): hard remove arrays from DTO and drop old column` | DTOs, second migration to drop column, breaking changes |
| 9 | TESTS | `test(profile): ...` | Comprehensive unit, integration, and E2E tests |
| 10 | POSTMAN | `docs(postman): sync collection with refactored endpoints` | Postman sync |

---

## 6. Risk & Mitigation Matrix (Revised)

| # | Risk | Severity | Mitigation & Action |
|:-:|:-----|:---------|:--------------------|
| 1 | **Data Loss in Migration** | CRITICAL | Script auto-creates missing fields in `FieldOfStudy` master table rather than dropping user data. |
| 2 | **Frontend API Contract Break** | HIGH | `PATCH` hard removal will 400 bad requests. Action: **Coordinate simultaneous lock-step deployment with Frontend team.** |
| 3 | **Widespread Test Failures** | MEDIUM | Unit/E2E tests sending `fieldOfStudy` will break. Action: Update `profile.controller.spec.ts`, `profile.e2e-spec.ts`. |
| 4 | **Max Limits Bypass** | MEDIUM | Action: Explicit `count()` queries in the new service layer before `create()`. |
| 5 | **Stale Profile Completion** | HIGH | Action: New services call `recalculateProfileStatus(userId)` post-mutation. |
| 6 | **Duplicate Constraint Crash** | HIGH | Action: Wrap `create` in try/catch, catch `P2002`, throw HTTP 409 Conflict. |
| 7 | **Inactive Records Linking** | HIGH | Action: Endpoints validate `isActive === true` before linking relations. |

---

## 7. Open Questions

> ✅ **None.** All verifications complete. Data migration script logic covers auto-creation of missing master records to guarantee zero data loss. The hard removal strategy is fully documented as a lock-step frontend breaking change.

---

*— Coordinator (Orchestrator) | Revised Phase 2 Complete*
