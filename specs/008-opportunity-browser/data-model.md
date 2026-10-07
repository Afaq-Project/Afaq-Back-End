# Data Model — Opportunity Browser

**Branch**: `008-opportunity-browser` | **Date**: 2026-09-30

This module consumes data from the external AI service database. **No tables are created or migrated** by this service. The models below are read-only representations of the AI service schema, reproduced here for implementation reference.

---

## Source of Truth

The authoritative schema is `prisma/ai-schema.prisma` (to be created in Task 1). The Prisma models below are derived from the AI service schema provided in `docx/schema.prisma.txt`.

---

## Entities

### CleanedOpportunity

The primary entity consumed by both endpoints. Stored in the AI service database table `cleaned_opportunities`.

| Field | Prisma Type | DB Column | Nullable | Notes |
|:---|:---|:---|:---:|:---|
| `id` | `String` (UUID) | `id` | No | Primary key; `gen_random_uuid()` |
| `rawOpportunityId` | `String` (UUID) | `raw_opportunity_id` | No | FK to `raw_opportunities`; unique |
| `sourceId` | `String?` (UUID) | `source_id` | Yes | FK to `sources` |
| `title` | `String` | `title` | No | Text |
| `organization` | `String?` | `organization` | Yes | Text |
| `opportunityType` | `String?` | `opportunity_type` | Yes | Text (e.g., `scholarship`, `grant`, `fellowship`) |
| `description` | `String?` | `description` | Yes | Text |
| `eligibility` | `Json?` | `eligibility` | Yes | Structured JSON object |
| `location` | `String?` | `location` | Yes | Text |
| `isRemote` | `Boolean?` | `is_remote` | Yes | |
| `fundingType` | `String?` | `funding_type` | Yes | Text |
| `deadline` | `DateTime?` | `deadline` | Yes | Records with null deadline are excluded from date-range filters |
| `applicationUrl` | `String?` | `application_url` | Yes | Text |
| `sourceUrl` | `String` | `source_url` | No | Text |
| `country` | `String?` | `country` | Yes | Text |
| `studyLevels` | `String[]` | `study_levels` | No (default `[]`) | Array; filtered with `hasSome` |
| `fieldsOfStudy` | `String[]` | `fields_of_study` | No (default `[]`) | Array; filtered with `hasSome` |
| `status` | `String?` | `status` | Yes | AI service internal field — not exposed via API |
| `errorMessage` | `String?` | `error_message` | Yes | AI service internal field — not exposed via API |
| `contentHash` | `String?` | `content_hash` | Yes | AI service internal field — not exposed via API |
| `createdAt` | `DateTime` | `created_at` | No | Default `now()` |
| `updatedAt` | `DateTime` | `updated_at` | No | `@updatedAt` |

> **Exposed field count**: 19 (excludes `status`, `errorMessage`, `contentHash`, `rawOpportunityId` which are internal AI service fields not in the API whitelist)

**Relationships** (read-only, navigated in Prisma queries):
- `source` → `Source` (via `sourceId`)

---

### Source

Used as a filter dimension (`source_id` filter on the list endpoint). Full source data is managed by the AI service and is not exposed via any opportunity endpoint.

| Field | Prisma Type | DB Column | Nullable | Notes |
|:---|:---|:---|:---:|:---|
| `id` | `String` (UUID) | `id` | No | Primary key |
| `name` | `String` | `name` | No | Unique internal identifier |
| `displayName` | `String` | `display_name` | No | Human-readable name |
| `baseUrl` | `String` | `base_url` | No | |
| `isActive` | `Boolean` | `is_active` | No | Default `true` |

**Usage**: Only `id` is used — as a filter value in `GET /opportunities?source_id=<uuid>`. The `Source` relation is not joined or returned in any opportunity response.

---

## Field Whitelist (API-Exposed Fields)

Fields available to the `fields` query parameter. Exactly 18 entries.

```typescript
export const OPPORTUNITY_FIELD_WHITELIST = [
  'id',
  'title',
  'organization',
  'country',
  'deadline',
  'opportunity_type',
  'is_remote',
  'description',
  'eligibility',
  'location',
  'funding_type',
  'application_url',
  'source_url',
  'study_levels',
  'fields_of_study',
  'source_id',
  'created_at',
  'updated_at',
] as const;
```

> **Note**: `rawOpportunityId`, `status`, `errorMessage`, `contentHash` are intentionally excluded — they are AI service internals.

## Default Field Set (List Endpoint)

Fields returned when `fields` is omitted on `GET /opportunities`. Exactly 7 entries.

```typescript
export const OPPORTUNITY_DEFAULT_FIELDS = [
  'id',
  'title',
  'organization',
  'country',
  'deadline',
  'opportunity_type',
  'is_remote',
] as const;
```

## Sort Whitelist

Fields valid as sort targets. Exactly 6 entries.

```typescript
export const OPPORTUNITY_SORT_WHITELIST = [
  'created_at',
  'updated_at',
  'deadline',
  'title',
  'country',
  'opportunity_type',
] as const;
```

---

## Prisma `where` Clause Mapping

| Query Param | Prisma Operator | Notes |
|:---|:---|:---|
| `country` | `{ country: { equals: value } }` | Case-sensitive exact match |
| `opportunity_type` | `{ opportunity_type: { equals: value } }` | Case-sensitive exact match |
| `funding_type` | `{ funding_type: { equals: value } }` | Case-sensitive exact match |
| `is_remote` | `{ is_remote: { equals: booleanValue } }` | Coerced to boolean before query |
| `source_id` | `{ source_id: { equals: value } }` | UUID exact match |
| `deadline_from` | `{ deadline: { gte: dateValue } }` | Inclusive; records with null deadline excluded |
| `deadline_to` | `{ deadline: { lte: dateValue } }` | Inclusive; records with null deadline excluded |
| `study_levels` | `{ study_levels: { hasSome: arrayValue } }` | Array split from comma-separated string |
| `fields_of_study` | `{ fields_of_study: { hasSome: arrayValue } }` | Array split from comma-separated string |
| `q` | `{ OR: [{ title: { contains: value, mode: 'insensitive' } }, { description: { contains: value, mode: 'insensitive' } }] }` | Whitespace stripped |

---

## Pagination Meta Shape

```typescript
interface PaginationMeta {
  page: number;    // Current page (from dto.page, default 1)
  limit: number;   // Effective limit (clamped to ≤100)
  total: number;   // Total matching records (from count query)
  pages: number;   // Math.ceil(total / limit)
}
```

---

## State Transitions

Not applicable. This module performs no state mutations. All data lifecycle is managed exclusively by the AI service.
