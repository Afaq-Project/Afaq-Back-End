# API Endpoints Documentation — Opportunities

## 1. List Opportunities

```
GET /api/opportunities
```

**Description:** Returns a list of cleaned opportunities (summarized) with filtering, pagination, and field selection.

### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | int | `1` | Page number |
| `limit` | int | `20` | Number of results per page |
| `sort` | string | `created_at:desc` | Sort order in `field:asc\|desc` format |
| `fields` | string | (default) | Comma-separated fields to return, or `*` for all |
| `q` | string | — | Text search in title/description |
| `country` | string | — | Filter by country |
| `opportunity_type` | string | — | Filter by opportunity type |
| `funding_type` | string | — | Filter by funding type |
| `is_remote` | bool | — | Filter by remote work |
| `deadline_from` | date | — | Deadline from (ISO 8601) |
| `deadline_to` | date | — | Deadline to (ISO 8601) |
| `source_id` | uuid | — | Filter by source |
| `study_levels` | string | — | Study levels, comma-separated |
| `fields_of_study` | string | — | Fields of study, comma-separated |

### Examples

```
GET /api/opportunities
GET /api/opportunities?page=2&limit=10
GET /api/opportunities?sort=deadline:asc
GET /api/opportunities?fields=id,title,deadline,country
GET /api/opportunities?fields=id
GET /api/opportunities?country=Egypt&opportunity_type=scholarship
GET /api/opportunities?q=master&limit=6&sort=created_at:desc
```

### Response

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "organization": "string",
      "country": "string",
      "deadline": "2026-01-01T00:00:00Z",
      "opportunity_type": "string",
      "is_remote": false
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 153,
    "pages": 8
  }
}
```

---

## 2. Get Opportunity Details

```
GET /api/opportunities/{id}
```

**Description:** Returns full details of a single opportunity by its ID.

### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | uuid | Opportunity ID |

### Optional Query Parameters

| Parameter | Description |
|---|---|
| `fields` | Comma-separated fields to return |

### Examples

```
GET /api/opportunities/3f2a1b...
GET /api/opportunities/3f2a1b...?fields=id,title,description
```

### Response

```json
{
  "id": "uuid",
  "title": "string",
  "organization": "string",
  "opportunity_type": "string",
  "description": "string",
  "eligibility": {},
  "location": "string",
  "is_remote": false,
  "funding_type": "string",
  "deadline": "2026-01-01T00:00:00Z",
  "application_url": "string",
  "source_url": "string",
  "country": "string",
  "study_levels": ["Master"],
  "fields_of_study": ["Computer Science"],
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

---

## General Rules

- **Default fields in the list** (when `fields` is not provided): `id, title, organization, country, deadline, opportunity_type, is_remote`.
- **`fields=*`** returns all fields (heavy, use with caution).
- **Whitelist:** any field not allowed in `fields` is ignored or returns `400`.
- **Without parameters:** returns the first page, 20 results, sorted by `created_at:desc`.
- **Pagination:** offset-based via `page`/`limit`.
- **Static filters** (like type/study level lists) are managed in the frontend; no endpoint needed.

---

## Possible Errors

| Code | Status |
|---|---|
| `200` | Success |
| `400` | Invalid parameter (e.g., wrong `sort` or disallowed `fields`) |
| `404` | Opportunity not found (in details endpoint) |
| `500` | Internal server error |
