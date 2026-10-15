# API Contract: List Matches

**Endpoint**: `GET /api/v1/recommendations/matches`
**Auth**: Bearer JWT required
**Version**: v1

---

## Request

### Query Parameters

| Parameter | Type | Required | Default | Constraints |
|:---|:---|:---:|:---|:---|
| `page` | integer | No | `1` | `>= 1` |
| `limit` | integer | No | `20` | `>= 1`; silently clamped to `100` |
| `min_score` | integer | No | — | `0..100`, inclusive |
| `sort` | string | No | `score_desc` | `score_desc` \| `score_asc` \| `calculated_at_desc` |
| `calculated_after` | string (ISO 8601) | No | — | strictly after `calculated_at` |
| `include_expired` | boolean | No | `false` | include expired/inactive opportunities |
| `q` | string | No | — | max 500 |
| `country` | string | No | — | max 100, exact |
| `opportunity_type` | string | No | — | max 100, exact |
| `funding_type` | string | No | — | max 100, exact |
| `is_remote` | boolean | No | — | string coerced |
| `deadline_from` / `deadline_to` | string (ISO 8601) | No | — | `from <= to` |
| `source_id` | string (UUID) | No | — | valid UUID |
| `study_levels` / `fields_of_study` | string | No | — | comma-separated, OR within filter |

Forbidden / rejected: `user_id`, `fields`, any unknown key → `400 VALIDATION_ERROR`.

## Response `200`

```json
{
  "statusCode": 200,
  "message": "Matches retrieved successfully",
  "data": [
    {
      "opportunity_id": "uuid",
      "score_pct": 87,
      "score_breakdown": {},
      "calculation_version": 1,
      "calculated_at": "2026-10-05T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42, "pages": 3, "synced_at": "2026-10-07T13:00:00.000Z" },
  "timestamp": "2026-10-07T13:00:00.000Z"
}
```

Item keys are exactly the 5 above. **No opportunity field is ever present.**

## Errors

| Code | Error Key | Trigger |
|:---:|:---|:---|
| 400 | `VALIDATION_ERROR` | bad type/range/date, forbidden or unknown param |
| 400 | `INVALID_SORT` | `sort` not whitelisted |
| 400 | `INVALID_DATE_RANGE` | `deadline_from > deadline_to` |
| 401 | `UNAUTHORIZED` | missing/invalid/expired token |
| 503 | `SERVICE_UNAVAILABLE` | AI DB unreachable |
| 500 | `INTERNAL_ERROR` | unexpected |

## Guarantees

- Only the token user's rows are returned.
- Results ordered by chosen sort, tiebreak `opportunity_id` ASC.
- Cached per user + normalized query (medium TTL, expiry only).
- Swagger text: "Does not return full opportunity details."
