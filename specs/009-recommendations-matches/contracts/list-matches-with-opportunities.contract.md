# API Contract: List Matches With Opportunities

**Endpoint**: `GET /api/v1/recommendations/matches-with-opportunities`
**Auth**: Bearer JWT required
**Version**: v1

---

## Request

Identical query contract to [list-matches.contract.md](./list-matches.contract.md) (same DTO). `fields` is **not** accepted.

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
      "calculated_at": "2026-10-05T10:00:00.000Z",
      "opportunity": {
        "id": "uuid",
        "title": "string",
        "organization": "string | null",
        "deadline": "datetime | null",
        "country": "string | null",
        "opportunity_type": "string | null",
        "is_remote": "boolean | null"
      }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42, "pages": 3, "synced_at": "2026-10-07T13:00:00.000Z" },
  "timestamp": "2026-10-07T13:00:00.000Z"
}
```

`opportunity` has exactly the 7 keys above — never `description`, `eligibility`, `application_url`, `location`, etc.

## Errors

Same as the matches endpoint.

## Guarantees

- For identical inputs, the ordered `opportunity_id` list equals the matches endpoint's.
- Match part produced by the shared match mapper; `opportunity` by the opportunities module's brief mapper.
- Cached per user + normalized query (short TTL, expiry only).
