# Profile Feature — Audit Issue Tracker

| Field          | Value                                      |
| :------------- | :----------------------------------------- |
| **Report Date** | 2026-09-12                               |
| **Auditor**    | Code Review — Read-Only Investigation      |
| **Scope**      | `src/modules/profile/`, `prisma/`, `docs/` |
| **Status**     | Open — Pending Resolution                  |

---

## Table of Contents

1. [CRIT-001 — `languages_master` table is unseeded](#crit-001--languages_master-table-is-unseeded)
2. [CRIT-002 — Invalid `languageId` format in Postman collection](#crit-002--invalid-languageid-format-in-postman-collection)
3. [HIGH-001 — No dedicated endpoint to fetch master languages list](#high-001--no-dedicated-endpoint-to-fetch-master-languages-list)
4. [HIGH-002 — User Skills: no granular CRUD endpoints](#high-002--user-skills-no-granular-crud-endpoints-add--update--delete-single-skill)
5. [HIGH-003 — User Languages: no granular CRUD endpoints](#high-003--user-languages-no-granular-crud-endpoints-add--update--delete-single-language)
6. [MED-001 — `fieldOfStudy` is fully overwritten on every PATCH](#med-001--fieldofstudy-is-fully-overwritten-on-every-patch-no-append-safe-logic)
7. [MED-002 — GPA update blindly overwrites first `UserEducation` record](#med-002--gpa-update-blindly-overwrites-first-usereducation-record-index-0-selection)
8. [LOW-001 — Mock Postman response body contains non-existent fields](#low-001--mock-postman-response-body-contains-non-existent-fields)
9. [LOW-002 — Master Skills IDs in Postman examples are non-UUID short codes](#low-002--master-skills-ids-in-postman-examples-are-non-uuid-short-codes)

---

## Issues

---

### CRIT-001 — `languages_master` table is unseeded

| Field           | Value |
| :-------------- | :---- |
| **Priority**    | 🔴 Critical |
| **Category**    | Data / Configuration |
| **Status**      | Open |
| **Affects**     | `PATCH /api/v1/profile` (languages) |

#### Description

The `languages_master` PostgreSQL table (mapped via `prisma/schema.prisma:L183–L190`) has **no seed data**. The `prisma/seed.ts` file seeds roles, admin users, fields of study, and skills — but **contains zero entries for languages**.

As a direct consequence:
- `prisma.languagesMaster.findUnique({ where: { id: lang.languageId } })` will always return `null`.
- Every request to `PATCH /profile` that includes a `languages` array will throw a `400 Bad Request` with `Language <id> not found`.
- The `languages` feature is **entirely non-functional in all environments** (development, staging, production).

#### Evidence

```typescript
// prisma/seed.ts — No language seeding block exists (Lines 1–165)
// After the skills seed (Line 152), the file ends with:
console.log(`  ✔ Seeded ${skills.length} skills`);
console.log('\n✅ Seed complete!');
// ❌ No prisma.languagesMaster.upsert() call exists anywhere
```

#### Resolution

Add a languages seed block to `prisma/seed.ts` with an appropriate list of world languages using `prisma.languagesMaster.upsert()` (mirroring the skills seed pattern). Ensure `id` is auto-generated (UUID) and `name` is unique.

---

### CRIT-002 — Invalid `languageId` format in Postman collection

| Field           | Value |
| :-------------- | :---- |
| **Priority**    | 🔴 Critical |
| **Category**    | Documentation / API Contract |
| **Status**      | Open |
| **Affects**     | `Levora_API.postman_collection.json` Lines 997, 1041 |

#### Description

The Postman collection contains example payloads and mock responses where `languageId` is set to the locale string `"en-us"`:

```json
// PATCH /profile — Request body (Line 1041)
"languages": [
  {
    "languageId": "en-us",
    "proficiency": "Native"
  }
]

// GET /profile — Mock response (Line 997)
"userLanguages": [
  {
    "languageId": "en-us",
    "language": { "id": "en-us", "name": "English" }
  }
]
```

The database schema strictly defines `LanguagesMaster.id` and `UserLanguages.languageId` as **PostgreSQL `UUID`** (`@db.Uuid`). Sending `"en-us"` will cause PostgreSQL to reject the query with a malformed UUID error.

This is a **documentation defect** that directly misleads the frontend team.

#### Evidence

```prisma
// prisma/schema.prisma (Lines 183–201)
model LanguagesMaster {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name      String   @unique @db.Citext
}

model UserLanguages {
  userId       String   @map("user_id") @db.Uuid
  languageId   String   @map("language_id") @db.Uuid
  proficiency  String   @db.Text
}
```

#### Resolution

Update all language-related examples in both copies of `Levora_API.postman_collection.json` to use valid UUID values as `languageId`. These UUIDs must correspond to real rows that will exist after the seed is applied (see **CRIT-001**).

---

### HIGH-001 — No dedicated endpoint to fetch master languages list

| Field           | Value |
| :-------------- | :---- |
| **Priority**    | 🟠 High |
| **Category**    | Missing Feature / API |
| **Status**      | Open |
| **Affects**     | `ReferenceController`, `ReferenceService` |

#### Description

The `ReferenceController` (`src/modules/profile/controllers/reference.controller.ts`) exposes only two reference endpoints:
- `GET /api/v1/reference/fields-of-study`
- `GET /api/v1/reference/skills-taxonomy`

There is **no endpoint** to retrieve the list of available languages from `languages_master`. The frontend has no API to populate a language picker/dropdown. This missing endpoint is also absent from the Postman collection.

#### Evidence

```typescript
// src/modules/profile/controllers/reference.controller.ts (Lines 1–44)
// Full file — only two @Get() routes defined; no languages route.
@Controller('reference')
export class ReferenceController {
  @Public()
  @Get('fields-of-study')
  async getFieldsOfStudy() { ... }

  @Public()
  @Get('skills-taxonomy')
  async getSkillsTaxonomy() { ... }

  // ❌ No @Get('languages') or equivalent
}
```

#### Resolution

1. Add `getLanguages()` method to `ReferenceService` querying `prisma.languagesMaster.findMany({ orderBy: { name: 'asc' } })`.
2. Add `@Public() @Get('languages')` route to `ReferenceController`.
3. Update the Postman collection with the new endpoint and a valid example response.

> **Note:** The current `LanguagesMaster` schema does not have an `isActive` column (unlike `SkillsMaster`). Consider adding one via migration for consistency, or omit the `where` filter initially.

---

### HIGH-002 — User Skills: no granular CRUD endpoints (Add / Update / Delete single skill)

| Field           | Value |
| :-------------- | :---- |
| **Priority**    | 🟠 High |
| **Category**    | Missing Feature / API Design |
| **Status**      | Open |
| **Affects**     | `ProfileController`, `ProfileService`, `user_skills` table |

#### Description

The only mechanism for managing a user's skills is the `PATCH /api/v1/profile` endpoint, which performs a **destructive full replacement**:

```typescript
// src/modules/profile/services/profile.service.ts (Lines 331–351)
if (skills) {
  await prisma.userSkills.deleteMany({ where: { userId } }); // Wipes ALL skills
  for (const skill of skills) {
    await prisma.userSkills.create({ data: { userId, skillId: skill.skillId, proficiency: skill.proficiency } });
  }
}
```

This design has critical consequences:
- **Adding one skill** requires the frontend to send the entire existing list plus the new item.
- **Updating one proficiency** requires resending all skills.
- **Deleting one skill** requires resending all skills minus the removed one.
- Sending `skills: []` (e.g., due to a frontend bug or network desync) **silently deletes all user skills permanently**.

The following dedicated endpoints are **entirely missing**:

| Endpoint | Description |
| :--- | :--- |
| `POST /api/v1/profile/skills` | Add a single skill to the user |
| `PATCH /api/v1/profile/skills/:skillId` | Update proficiency of a specific skill |
| `DELETE /api/v1/profile/skills/:skillId` | Remove a specific skill from the user |

#### Resolution

Create a sub-resource route group (`/profile/skills`) in `ProfileController`. Implement the three endpoints backed by targeted Prisma operations:
- `POST`: `prisma.userSkills.create()`
- `PATCH`: `prisma.userSkills.update({ where: { userId_skillId: { userId, skillId } } })`
- `DELETE`: `prisma.userSkills.delete({ where: { userId_skillId: { userId, skillId } } })`

Each endpoint must validate the `skillId` against `SkillsMaster`. The existing `PATCH /profile` bulk handling may remain for onboarding flows.

---

### HIGH-003 — User Languages: no granular CRUD endpoints (Add / Update / Delete single language)

| Field           | Value |
| :-------------- | :---- |
| **Priority**    | 🟠 High |
| **Category**    | Missing Feature / API Design |
| **Status**      | Open |
| **Affects**     | `ProfileController`, `ProfileService`, `user_languages` table |

#### Description

Identical in nature to **HIGH-002**, but for languages. The only mechanism for managing a user's languages is the `PATCH /api/v1/profile` endpoint with the same destructive full-replacement pattern:

```typescript
// src/modules/profile/services/profile.service.ts (Lines 353–375)
if (languages) {
  await prisma.userLanguages.deleteMany({ where: { userId } }); // Wipes ALL languages
  for (const lang of languages) {
    await prisma.userLanguages.create({ data: { userId, languageId: lang.languageId, proficiency: lang.proficiency } });
  }
}
```

The following dedicated endpoints are **entirely missing**:

| Endpoint | Description |
| :--- | :--- |
| `POST /api/v1/profile/languages` | Add a single language to the user |
| `PATCH /api/v1/profile/languages/:languageId` | Update proficiency of a specific language |
| `DELETE /api/v1/profile/languages/:languageId` | Remove a specific language from the user |

#### Resolution

Create a sub-resource route group (`/profile/languages`) in `ProfileController`. Implement the three endpoints using targeted Prisma operations:
- `POST`: `prisma.userLanguages.create()`
- `PATCH`: `prisma.userLanguages.update({ where: { userId_languageId: { userId, languageId } } })`
- `DELETE`: `prisma.userLanguages.delete({ where: { userId_languageId: { userId, languageId } } })`

Each endpoint must validate the `languageId` against `LanguagesMaster`.

> **Blocked by CRIT-001** — seed data must exist before this endpoint is testable.

---

### MED-001 — `fieldOfStudy` is fully overwritten on every PATCH (no append-safe logic)

| Field           | Value |
| :-------------- | :---- |
| **Priority**    | 🟡 Medium |
| **Category**    | Data Loss Risk / API Behavior |
| **Status**      | Open |
| **Affects**     | `PATCH /api/v1/profile`, `user_profiles.field_of_study` column |

#### Description

`fieldOfStudy` is stored as a native PostgreSQL text array (`String[] @db.Text`) on the `user_profiles` table. When the `PATCH /profile` payload includes `fieldOfStudy`, the entire column is replaced silently:

```typescript
// src/modules/profile/services/profile.service.ts (Lines 292, 322–329)
const { skills, languages, gpaValue, gpaScale, ...profileData } = data;
// profileData includes fieldOfStudy if sent

await prisma.userProfiles.update({
  where: { userId },
  data: {
    ...profileData, // ← fieldOfStudy fully replaced here with no warning
    completionPct: newPct,
    isDraft: !newIsCore,
  },
});
```

If a user has `["Computer Science", "Software Engineering"]` and the frontend sends `fieldOfStudy: ["Artificial Intelligence"]` intending to add a third item, the previous values are **permanently deleted**.

#### Resolution

Document the full-replacement behavior explicitly in `UpdateProfileDto.fieldOfStudy`'s JSDoc/Swagger description so the frontend team understands they must always send the complete intended array. Optionally add a server-side guard that returns `400` when the incoming array is shorter than the existing persisted array without an explicit `replaceAll: true` flag.

---

### MED-002 — GPA update blindly overwrites first `UserEducation` record (index-0 selection)

| Field           | Value |
| :-------------- | :---- |
| **Priority**    | 🟡 Medium |
| **Category**    | Data Integrity / Logic Bug |
| **Status**      | Open |
| **Affects**     | `PATCH /api/v1/profile`, `user_educations` table |

#### Description

When `gpaValue` and `gpaScale` are provided in the PATCH payload, the service fetches all education records for the user and blindly updates `educations[0]` — the first record returned by PostgreSQL without an explicit `ORDER BY`:

```typescript
// src/modules/profile/services/profile.service.ts (Lines 384–418)
const educations = await prisma.userEducations.findMany({
  where: { userId },
  // ❌ No ORDER BY — row order is non-deterministic
});
if (educations.length > 0) {
  await prisma.userEducations.update({
    where: { id: educations[0].id }, // ← Arbitrarily selects first row
    data: { gpaRaw: ..., gpaNormalized4: ... },
  });
} else {
  // ❌ Creates a junk record with hardcoded "Unknown" placeholder strings
  await prisma.userEducations.create({
    data: {
      userId,
      degree: 'Unknown',
      major: 'Unknown',
      institution: 'Unknown',
      ...
    },
  });
}
```

Two concrete problems:
1. **Multi-education users**: A user with both a High School and a Bachelor's degree record will have one arbitrarily updated.
2. **Placeholder pollution**: If no education record exists, a record with `degree: "Unknown"`, `institution: "Unknown"` is persisted.

#### Resolution

- Require an `educationId` in the PATCH payload to target a specific record, or delegate GPA management to a dedicated `PATCH /profile/educations/:id` endpoint.
- Remove the placeholder creation block. If no education record exists, return `400 Bad Request`.

---

### LOW-001 — Mock Postman response body contains non-existent fields

| Field           | Value |
| :-------------- | :---- |
| **Priority**    | 🔵 Low |
| **Category**    | Documentation Accuracy |
| **Status**      | Open |
| **Affects**     | `Levora_API.postman_collection.json` Line 997 |

#### Description

The mock `200 OK` response body for `GET /profile` in the Postman collection includes fields that are not returned by `getProfileWithDetails()` in `profile.service.ts`:

| Field in Mock | Returned by API? | Notes |
| :--- | :--- | :--- |
| `data.id` | ❌ No | The actual field is `data.userId` |
| `userSkills[].id` | ❌ No | `UserSkills` has a composite PK `(userId, skillId)` — no standalone `id` column |
| `userLanguages[].id` | ❌ No | `UserLanguages` has a composite PK `(userId, languageId)` — no standalone `id` column |
| `userLanguages[].userId` | ❌ No | Not mapped in the response object |

These discrepancies cause the frontend team to build logic against a response shape that does not exist at runtime.

#### Resolution

Update the mock response body in both copies of `Levora_API.postman_collection.json` to match the exact JSON structure returned by the live API.

---

### LOW-002 — Master Skills IDs in Postman examples are non-UUID short codes

| Field           | Value |
| :-------------- | :---- |
| **Priority**    | 🔵 Low |
| **Category**    | Documentation Accuracy |
| **Status**      | Open |
| **Affects**     | `Levora_API.postman_collection.json` Line 1575 |

#### Description

The mock response body for `GET /reference/skills-taxonomy` uses short string IDs (`"s-ts"`, `"s-py"`, `"s-go"`, `"s-pt"`, `"s-tf"`) for skill entries. The actual `SkillsMaster.id` column is a **PostgreSQL UUID** (`@db.Uuid`). These short codes misrepresent the expected ID format to frontend developers.

#### Resolution

Update mock taxonomy IDs to valid UUID format strings consistent with what the seed script auto-generates.

---

## Resolution Order & Dependency Map

```
CRIT-001 (Seed languages)
    └── blocks ──► HIGH-001 (Languages reference endpoint)
    └── blocks ──► HIGH-003 (User languages CRUD endpoints)

CRIT-002 (Fix Postman languageId format)
    └── should be done alongside ──► HIGH-001, HIGH-003

HIGH-002 (User skills CRUD endpoints)
    └── independent — can be implemented in parallel with Sprint 2

MED-001 (fieldOfStudy documentation / guard)
    └── independent

MED-002 (GPA education index-0 fix)
    └── independent

LOW-001, LOW-002 (Postman documentation cleanup)
    └── can be done last, or alongside each respective feature
```

---

## Recommended Sprint Plan

| Sprint | Issues | Rationale |
| :----- | :----- | :--------- |
| **Sprint 1** | CRIT-001, CRIT-002 | Foundation — fix data and documentation defects before any new feature work begins |
| **Sprint 2** | HIGH-001, HIGH-002, HIGH-003 | Core feature delivery — languages reference endpoint + granular skill/language CRUD |
| **Sprint 3** | MED-001, MED-002 | Data integrity hardening — prevent silent data loss |
| **Sprint 4** | LOW-001, LOW-002 | Documentation cleanup and Postman collection polish |

---

## Files Referenced

| File | Issue(s) |
| :--- | :--- |
| `prisma/seed.ts` | CRIT-001 |
| `prisma/schema.prisma` | CRIT-001, CRIT-002, HIGH-002, HIGH-003 |
| `Levora_API.postman_collection.json` | CRIT-002, LOW-001, LOW-002 |
| `docs/postman/Levora_API.postman_collection.json` | CRIT-002, LOW-001, LOW-002 |
| `src/modules/profile/controllers/reference.controller.ts` | HIGH-001 |
| `src/modules/profile/services/reference.service.ts` | HIGH-001 |
| `src/modules/profile/controllers/profile.controller.ts` | HIGH-002, HIGH-003 |
| `src/modules/profile/services/profile.service.ts` | HIGH-002, HIGH-003, MED-001, MED-002 |
| `src/modules/profile/dto/update-profile.dto.ts` | MED-001 |
