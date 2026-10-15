# Recommendations — Endpoints

**Feature**: Recommendations Module (Personalized Match Scores)
**Base URL**: `/api/v1`
**Auth**: All endpoints require a Bearer JWT (`user_id` is taken from the token only)
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `GET` | `/recommendations/matches` | 🔒 | List the current user's match records (no opportunity fields) |
| 2 | `GET` | `/recommendations/matches-with-opportunities` | 🔒 | List match records plus a brief opportunity summary |

**Total**: 2 endpoints (both authenticated). Recalculation is out of scope for now.

---

## Domain Rules (Apply to Both Endpoints)

### Identity

`user_id` is always taken from the validated JWT. Any `user_id` in query or body is rejected by `ValidationPipe` (`forbidNonWhitelisted: true`) and never used.

### Match Item Shape (single shared DTO / mapper)

| Field | Type | Notes |
|:---|:---|:---|
| `opportunity_id` | `string` (UUID) | |
| `score_pct` | `number` (int) | 0–100 |
| `score_breakdown` | `object` | Free-form JSON from the matching service |
| `calculation_version` | `number` (int) | |
| `calculated_at` | `datetime` | |

### Brief Opportunity Summary (endpoint 2 only, reused from the `opportunities` module mapper)

`id`, `title`, `organization`, `deadline`, `country`, `opportunity_type`, `is_remote`. No other opportunity field is ever returned (no `description`, `eligibility`, `application_url`, …).

### Sort Whitelist

`score_desc` (default), `score_asc`, `calculated_at_desc`. Anything else causes `400 INVALID_SORT`.

### Limit Cap

`limit` defaults to `20` and is silently clamped to a maximum of `100` (same behavior as `GET /opportunities`).

### Expired / Inactive Opportunities

By default, matches whose opportunity is expired (`deadline` in the past) or inactive are hidden. `include_expired=true` returns them. Opportunities with `deadline = null` are not considered expired. The exact "inactive" status values are fixed in the plan.

### Opportunity Filters

Same names and semantics as `GET /opportunities` (see 008): `q`, `country`, `opportunity_type`, `funding_type`, `is_remote`, `deadline_from`, `deadline_to`, `source_id`, `study_levels`, `fields_of_study`. All filters combine with AND. The filter logic is a single shared function used by both endpoints. Endpoint 1 joins `cleaned_opportunities` **for filtering only**; endpoint 2 joins it to also read the summary fields.

### External Database

Match data is read (read-only) from the AI service database via `AiPrismaService`. If unreachable, both endpoints return `503 SERVICE_UNAVAILABLE` immediately; no retry.

### Caching (time-based expiry only)

| Endpoint | Key | TTL |
|:---|:---|:---|
| 1 | `user_id` + hash of normalized filters | Medium (env-configurable, default 30 min) |
| 2 | `user_id` + hash of normalized filters | Short (env-configurable, default 5 min) |

No explicit invalidation. `synced_at` (server time of the response) lets the client use `calculated_after` for incremental sync.

---

## 1. `GET /api/v1/recommendations/matches` 🔒

### Purpose

Default and primary endpoint. Returns the authenticated user's match records only — never opportunity fields.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/recommendations/matches` |
| **Auth** | 🔒 Bearer JWT (any authenticated user) |
| **Body** | None |

### Query Parameters

| Param | Type | Default | Validation | Description |
|:---|:---|:---|:---|:---|
| `page` | `number` | `1` | `@IsOptional`, `@IsInt`, `@Min(1)` | Page number |
| `limit` | `number` | `20` | `@IsOptional`, `@IsInt`, `@Min(1)` | Results per page (clamped to 100) |
| `min_score` | `number` | — | `@IsOptional`, `@IsInt`, `@Min(0)`, `@Max(100)` | Only matches with `score_pct >= min_score` |
| `sort` | `string` | `score_desc` | `@IsOptional`, `@IsIn([...])` | `score_desc` \| `score_asc` \| `calculated_at_desc` |
| `calculated_after` | `string` (ISO 8601) | — | `@IsOptional`, `@IsDateString` | Only matches with `calculated_at` strictly after this instant |
| `include_expired` | `boolean` | `false` | `@IsOptional`, `@IsBoolean` | Include matches for expired/inactive opportunities |
| `q`, `country`, `opportunity_type`, `funding_type`, `is_remote`, `deadline_from`, `deadline_to`, `source_id`, `study_levels`, `fields_of_study` | — | — | Same as `GET /opportunities` | Opportunity filters (filter only, never returned) |

### Example Requests

```
GET /api/v1/recommendations/matches
GET /api/v1/recommendations/matches?min_score=70&sort=score_desc
GET /api/v1/recommendations/matches?calculated_after=2026-10-01T00:00:00.000Z
GET /api/v1/recommendations/matches?country=Egypt&opportunity_type=scholarship&page=2&limit=50
GET /api/v1/recommendations/matches?include_expired=true
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Matches retrieved successfully",
  "data": [
    {
      "opportunity_id": "3f2a1b00-0000-0000-0000-000000000001",
      "score_pct": 87,
      "score_breakdown": { "study_level": 30, "field": 40, "country": 17 },
      "calculation_version": 1,
      "calculated_at": "2026-10-05T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3,
    "synced_at": "2026-10-07T13:00:00.000Z"
  },
  "timestamp": "2026-10-07T13:00:00.000Z"
}
```

### Business Rules

1. **No opportunity fields** — even when opportunity filters are used.
2. **Identity** — only rows where `user_id` equals the token's user are returned.
3. **Default visibility** — expired/inactive opportunities hidden unless `include_expired=true`.
4. **Multi-filter logic** — AND across all filters.
5. **Page beyond last** — `data: []` with correct `meta`.
6. **No matches** — `data: []`, `meta.total: 0` (not an error).
7. **Stable ordering** — ties broken by `opportunity_id` ascending for deterministic pagination.
8. **Incremental sync** — `calculated_after` is applied on `calculated_at`; clients store `meta.synced_at` for the next call.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Wrong type/range for any param, malformed date, `user_id` supplied, unknown param |
| `400` | `INVALID_SORT` | `Sort value '<value>' is not allowed` | `sort` not in whitelist |
| `400` | `INVALID_DATE_RANGE` | `deadline_from must not be later than deadline_to` | `deadline_from` > `deadline_to` |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing/invalid/expired JWT |
| `503` | `SERVICE_UNAVAILABLE` | `Recommendation data source is currently unavailable` | AI database unreachable |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected failure |

---

## 2. `GET /api/v1/recommendations/matches-with-opportunities` 🔒

### Purpose

Auxiliary endpoint. Same items as endpoint 1 plus a brief `opportunity` object, using a single joined query. Not the default path; intended for screens that need a ready-to-render personalized list.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/recommendations/matches-with-opportunities` |
| **Auth** | 🔒 Bearer JWT (any authenticated user) |
| **Body** | None |

### Query Parameters

Identical to endpoint 1 (same DTO). A `fields` parameter is **not** accepted: requesting it causes `400 VALIDATION_ERROR`, because full opportunity details are never returned.

### Example Requests

```
GET /api/v1/recommendations/matches-with-opportunities
GET /api/v1/recommendations/matches-with-opportunities?min_score=60&limit=10
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Matches retrieved successfully",
  "data": [
    {
      "opportunity_id": "3f2a1b00-0000-0000-0000-000000000001",
      "score_pct": 87,
      "score_breakdown": { "study_level": 30, "field": 40, "country": 17 },
      "calculation_version": 1,
      "calculated_at": "2026-10-05T10:00:00.000Z",
      "opportunity": {
        "id": "3f2a1b00-0000-0000-0000-000000000001",
        "title": "Erasmus Mundus Joint Master Degree in Computer Science",
        "organization": "European Commission",
        "deadline": "2026-12-15T00:00:00.000Z",
        "country": "Belgium",
        "opportunity_type": "scholarship",
        "is_remote": false
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "pages": 3,
    "synced_at": "2026-10-07T13:00:00.000Z"
  },
  "timestamp": "2026-10-07T13:00:00.000Z"
}
```

### Business Rules

1. For the same inputs, the set and order of `opportunity_id`s equals endpoint 1's result.
2. The match part is built by the same mapper as endpoint 1; the `opportunity` part by the `opportunities` module's brief mapper.
3. `opportunity` contains exactly the 7 summary fields — nothing else.
4. Short-lived cache (5–10 min), no explicit invalidation.

### Error Responses

Same as endpoint 1.

---

## OpenAPI Requirement

Swagger descriptions for both endpoints MUST state: *"This endpoint never returns full opportunity details. Use `GET /opportunities/:id` or `GET /opportunities?ids=...`."*

> **Note**: The frontend report references `GET /opportunities?ids=...` (batch fetch). That parameter does not exist in feature 008 and belongs to the `opportunities` module; it must be added there separately.
