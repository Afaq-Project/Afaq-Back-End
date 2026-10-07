# Opportunity Browser — Endpoints

**Feature**: Opportunity Browser
**Base URL**: `/api/v1`
**Auth**: All endpoints are `[PUBLIC]` — no Bearer JWT required
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `GET` | `/opportunities` | 🌐 | List opportunities (filtered, paginated, field-selected) |
| 2 | `GET` | `/opportunities/:id` | 🌐 | Retrieve full details of a single opportunity |

**Total**: 2 endpoints (both public)

---

## Domain Rules (Apply to Both Endpoints)

### Field Whitelist

Only fields in the following whitelist are accepted by the `fields` parameter. Any value outside this list causes `400 INVALID_FIELD`.

| Field | Type | Included in Default List |
|:---|:---|:---:|
| `id` | `string` (UUID) | ✅ |
| `title` | `string` | ✅ |
| `organization` | `string \| null` | ✅ |
| `country` | `string \| null` | ✅ |
| `deadline` | `datetime \| null` | ✅ |
| `opportunity_type` | `string \| null` | ✅ |
| `is_remote` | `boolean \| null` | ✅ |
| `description` | `string \| null` | — |
| `eligibility` | `object \| null` | — |
| `location` | `string \| null` | — |
| `funding_type` | `string \| null` | — |
| `application_url` | `string \| null` | — |
| `source_url` | `string` | — |
| `study_levels` | `string[]` | — |
| `fields_of_study` | `string[]` | — |
| `source_id` | `string` (UUID) | — |
| `created_at` | `datetime` | — |
| `updated_at` | `datetime` | — |

### Sort Whitelist

Only the following fields are valid sort targets for the `sort` parameter. Anything else causes `400 INVALID_SORT_FIELD`.

`created_at`, `updated_at`, `deadline`, `title`, `country`, `opportunity_type`

### Limit Cap

The `limit` parameter is silently clamped to a maximum of `100`. Values above 100 are treated as `100` — no error is returned.

### Array Filters

`study_levels` and `fields_of_study` are comma-separated strings in the query. They match records that contain **at least one** of the provided values (inclusive OR logic) within the stored array column.

### External Database

All data is read from the external AI service database. If that database is unreachable, both endpoints return `503 Service Unavailable` immediately — no retry is attempted.

---

## 1. `GET /api/v1/opportunities` [PUBLIC]

### Purpose

Returns a paginated, filtered, and field-selected list of cleaned opportunities. Default response is page 1, 20 results, sorted by `created_at` descending, with the 7 default summary fields.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/opportunities` |
| **Auth** | 🌐 Public |
| **Body** | None |

### Query Parameters

| Param | Type | Default | Validation | Description |
|:---|:---|:---|:---|:---|
| `page` | `number` | `1` | `@IsOptional`, `@IsInt`, `@Min(1)` | Page number |
| `limit` | `number` | `20` | `@IsOptional`, `@IsInt`, `@Min(1)` | Results per page (silently clamped to 100) |
| `sort` | `string` | `created_at:desc` | `@IsOptional`, `@Matches(/^[a-z_]+:(asc\|desc)$/)` | Sort field and direction in `field:asc\|desc` format. Field must be in sort whitelist. |
| `fields` | `string` | (default set) | `@IsOptional`, `@IsString` | Comma-separated field names to return, or `*` for all. Each name must be in the field whitelist. |
| `q` | `string` | — | `@IsOptional`, `@IsString`, `@MaxLength(500)` | Case-insensitive text search in `title` and `description`. Leading/trailing whitespace stripped. |
| `country` | `string` | — | `@IsOptional`, `@IsString`, `@MaxLength(100)` | Exact-match filter by country name |
| `opportunity_type` | `string` | — | `@IsOptional`, `@IsString`, `@MaxLength(100)` | Exact-match filter by opportunity type |
| `funding_type` | `string` | — | `@IsOptional`, `@IsString`, `@MaxLength(100)` | Exact-match filter by funding type |
| `is_remote` | `boolean` | — | `@IsOptional`, `@IsBoolean` | Filter by remote availability |
| `deadline_from` | `string` (ISO 8601) | — | `@IsOptional`, `@IsDateString` | Include only records whose deadline is on or after this date |
| `deadline_to` | `string` (ISO 8601) | — | `@IsOptional`, `@IsDateString` | Include only records whose deadline is on or before this date |
| `source_id` | `string` (UUID) | — | `@IsOptional`, `@IsUUID` | Filter by originating source |
| `study_levels` | `string` | — | `@IsOptional`, `@IsString` | Comma-separated study levels; OR-matches against the stored array |
| `fields_of_study` | `string` | — | `@IsOptional`, `@IsString` | Comma-separated fields of study; OR-matches against the stored array |

### Example Requests

```
GET /api/v1/opportunities
GET /api/v1/opportunities?page=2&limit=10
GET /api/v1/opportunities?sort=deadline:asc
GET /api/v1/opportunities?fields=id,title,deadline,country
GET /api/v1/opportunities?fields=*
GET /api/v1/opportunities?country=Egypt&opportunity_type=scholarship
GET /api/v1/opportunities?q=master&limit=6&sort=created_at:desc
GET /api/v1/opportunities?study_levels=Master,PhD&fields_of_study=Computer+Science
GET /api/v1/opportunities?deadline_from=2026-01-01&deadline_to=2026-12-31
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Opportunities retrieved successfully",
  "data": [
    {
      "id": "3f2a1b00-0000-0000-0000-000000000001",
      "title": "Erasmus Mundus Joint Master Degree in Computer Science",
      "organization": "European Commission",
      "country": "Belgium",
      "deadline": "2026-12-15T00:00:00.000Z",
      "opportunity_type": "scholarship",
      "is_remote": false
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 153,
    "pages": 8
  },
  "timestamp": "2026-09-30T21:00:00.000Z"
}
```

> **Note**: When `fields` is omitted, each item contains only the 7 default fields shown above. When `fields=*` is used, all whitelisted fields are present on each item.

### Business Rules

1. **Default field set** — when `fields` is absent: `id`, `title`, `organization`, `country`, `deadline`, `opportunity_type`, `is_remote`.
2. **Unknown fields** — any field in the `fields` list that is not on the whitelist causes `400 INVALID_FIELD`. No partial result is returned.
3. **Sort format** — `sort` must be in `field:asc|desc` format. An unrecognised field name causes `400 INVALID_SORT_FIELD`. An invalid direction causes `400 VALIDATION_ERROR`.
4. **`deadline_from` / `deadline_to`** — if both are provided and `deadline_from` is later than `deadline_to`, the request is rejected with `400 INVALID_DATE_RANGE`.
5. **`page` beyond last** — returns an empty `data: []` with correct `meta` (not an error).
6. **Multi-filter logic** — all filters are combined with AND. Only records satisfying every active filter are returned.
7. **`q` whitespace** — leading and trailing whitespace is stripped before matching.
8. **`limit` cap** — values above 100 are silently clamped to 100.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Invalid type for `page`, `limit`, `is_remote`, malformed date string, `sort` direction invalid |
| `400` | `INVALID_SORT_FIELD` | `Sort field '<field>' is not allowed` | `sort` field not in whitelist |
| `400` | `INVALID_FIELD` | `Field '<name>' is not allowed` | A `fields` value is not in the whitelist |
| `400` | `INVALID_DATE_RANGE` | `deadline_from must not be later than deadline_to` | `deadline_from` > `deadline_to` |
| `503` | `SERVICE_UNAVAILABLE` | `Opportunity data source is currently unavailable` | External AI database unreachable |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 2. `GET /api/v1/opportunities/:id` [PUBLIC]

### Purpose

Returns the full detail object for a single opportunity identified by its UUID. All whitelisted fields are returned by default; partial selection is available via `fields`.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/opportunities/:id` |
| **Auth** | 🌐 Public |
| **Path Param** | `id` — UUID of the opportunity |
| **Body** | None |

### Query Parameters

| Param | Type | Default | Validation | Description |
|:---|:---|:---|:---|:---|
| `fields` | `string` | (all fields) | `@IsOptional`, `@IsString` | Comma-separated field names to return. Each name must be in the field whitelist. |

> **Note**: On the detail endpoint, `fields` defaults to returning **all** whitelisted fields (equivalent to `fields=*`). Unlike the list endpoint, there is no abbreviated default set.

### Example Requests

```
GET /api/v1/opportunities/3f2a1b00-0000-0000-0000-000000000001
GET /api/v1/opportunities/3f2a1b00-0000-0000-0000-000000000001?fields=id,title,description
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Opportunity retrieved successfully",
  "data": {
    "id": "3f2a1b00-0000-0000-0000-000000000001",
    "title": "Erasmus Mundus Joint Master Degree in Computer Science",
    "organization": "European Commission",
    "opportunity_type": "scholarship",
    "description": "Full-funded master's program across multiple European universities...",
    "eligibility": {
      "gpa_minimum": 3.0,
      "languages": ["English", "French"],
      "citizenship": "non-EU preferred"
    },
    "location": "Brussels, Belgium",
    "is_remote": false,
    "funding_type": "full_funding",
    "deadline": "2026-12-15T00:00:00.000Z",
    "application_url": "https://erasmus-mundus.eu/apply",
    "source_url": "https://source-platform.eu/opportunity/123",
    "country": "Belgium",
    "study_levels": ["Master"],
    "fields_of_study": ["Computer Science", "Software Engineering"],
    "source_id": "uuid-source-eu",
    "created_at": "2026-09-01T08:00:00.000Z",
    "updated_at": "2026-09-20T14:30:00.000Z"
  },
  "timestamp": "2026-09-30T21:00:00.000Z"
}
```

### Business Rules

1. **Full field set by default** — all whitelisted fields are returned unless `fields` is explicitly supplied.
2. **Unknown fields** — any field in the `fields` list that is not on the whitelist causes `400 INVALID_FIELD`. No partial result is returned.
3. **Not found** — if no opportunity exists with the given UUID, `404 NOT_FOUND` is returned. This applies whether the record never existed or was deleted from the external database.
4. **Invalid UUID** — if `id` is not a valid UUID format, `400 VALIDATION_ERROR` is returned before any database lookup.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `id` path parameter is not a valid UUID |
| `400` | `INVALID_FIELD` | `Field '<name>' is not allowed` | A `fields` value is not in the whitelist |
| `404` | `OPPORTUNITY_NOT_FOUND` | `Opportunity not found` | No record exists for the given ID |
| `503` | `SERVICE_UNAVAILABLE` | `Opportunity data source is currently unavailable` | External AI database unreachable |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |
