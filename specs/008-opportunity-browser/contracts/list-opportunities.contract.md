# API Contract: List Opportunities

**Endpoint**: `GET /api/v1/opportunities`
**Auth**: Public (no token required)
**Version**: v1

---

## Request Contract

### Method & Path

```
GET /api/v1/opportunities
```

### Query Parameters

| Parameter | Type | Required | Default | Constraints |
|:---|:---|:---:|:---|:---|
| `page` | integer | No | `1` | `>= 1` |
| `limit` | integer | No | `20` | `>= 1`; silently clamped to `100` |
| `sort` | string | No | `created_at:desc` | Format: `{field}:{asc\|desc}`; field must be in sort whitelist |
| `fields` | string | No | (default set) | Comma-separated; each item must be in field whitelist; `*` = all fields |
| `q` | string | No | — | Max 500 chars; matched case-insensitively in title and description |
| `country` | string | No | — | Max 100 chars; exact match |
| `opportunity_type` | string | No | — | Max 100 chars; exact match |
| `funding_type` | string | No | — | Max 100 chars; exact match |
| `is_remote` | boolean | No | — | `true` or `false`; string `"true"`/`"false"` coerced |
| `deadline_from` | string (ISO 8601) | No | — | Must be ≤ `deadline_to` if both provided |
| `deadline_to` | string (ISO 8601) | No | — | Must be ≥ `deadline_from` if both provided |
| `source_id` | string (UUID v4) | No | — | Must be valid UUID format |
| `study_levels` | string | No | — | Comma-separated; OR-matched against stored array |
| `fields_of_study` | string | No | — | Comma-separated; OR-matched against stored array |

### Sort Whitelist

`created_at`, `updated_at`, `deadline`, `title`, `country`, `opportunity_type`

### Field Whitelist (19 fields)

`id`, `title`, `organization`, `country`, `deadline`, `opportunity_type`, `is_remote`, `description`, `eligibility`, `location`, `funding_type`, `application_url`, `source_url`, `study_levels`, `fields_of_study`, `source_id`, `created_at`, `updated_at`

### Default Field Set (when `fields` omitted, 7 fields)

`id`, `title`, `organization`, `country`, `deadline`, `opportunity_type`, `is_remote`

---

## Response Contract

### 200 OK — Success

```json
{
  "statusCode": 200,
  "message": "Opportunities retrieved successfully",
  "data": [
    {
      "id": "string (UUID)",
      "title": "string",
      "organization": "string | null",
      "country": "string | null",
      "deadline": "ISO 8601 datetime | null",
      "opportunity_type": "string | null",
      "is_remote": "boolean | null"
    }
  ],
  "meta": {
    "page": "integer (>= 1)",
    "limit": "integer (1–100)",
    "total": "integer (>= 0)",
    "pages": "integer (>= 0)"
  },
  "timestamp": "ISO 8601 datetime"
}
```

> `data` is always an array (empty `[]` when no records match — never null).
> Object shape varies based on `fields` parameter.

---

## Error Contracts

### 400 — Invalid Parameter

```json
{
  "statusCode": 400,
  "message": "string (user-facing description)",
  "error": "INVALID_SORT_FIELD | INVALID_FIELD | INVALID_DATE_RANGE | VALIDATION_ERROR",
  "timestamp": "ISO 8601 datetime"
}
```

| Error Key | Trigger |
|:---|:---|
| `INVALID_SORT_FIELD` | `sort` field not in sort whitelist |
| `INVALID_FIELD` | A value in `fields` not in field whitelist |
| `INVALID_DATE_RANGE` | `deadline_from` > `deadline_to` |
| `VALIDATION_ERROR` | Type mismatch (non-integer `page`/`limit`, non-boolean `is_remote`, non-ISO date, non-UUID `source_id`, invalid `sort` direction) |

### 503 — Service Unavailable

```json
{
  "statusCode": 503,
  "message": "Opportunity data source is currently unavailable",
  "error": "SERVICE_UNAVAILABLE",
  "timestamp": "ISO 8601 datetime"
}
```

### 500 — Internal Error

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "INTERNAL_ERROR",
  "timestamp": "ISO 8601 datetime"
}
```
