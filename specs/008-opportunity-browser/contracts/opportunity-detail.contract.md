# API Contract: Opportunity Detail

**Endpoint**: `GET /api/v1/opportunities/:id`
**Auth**: Public (no token required)
**Version**: v1

---

## Request Contract

### Method & Path

```
GET /api/v1/opportunities/:id
```

### Path Parameters

| Parameter | Type | Required | Constraints |
|:---|:---|:---:|:---|
| `id` | string (UUID v4) | Yes | Must be a valid UUID; validated by `ParseUUIDPipe` before service is called |

### Query Parameters

| Parameter | Type | Required | Default | Constraints |
|:---|:---|:---:|:---|:---|
| `fields` | string | No | (all whitelisted fields) | Comma-separated; each item must be in field whitelist |

> On the detail endpoint, the default when `fields` is omitted is **all 18 whitelisted fields** — not the 7-field summary set used by the list endpoint.

---

## Response Contract

### 200 OK — Success (full object, no `fields` param)

```json
{
  "success": true,
  "status": 200,
  "message": "Opportunity retrieved successfully",
  "data": {
    "id": "string (UUID)",
    "title": "string",
    "organization": "string | null",
    "opportunity_type": "string | null",
    "description": "string | null",
    "eligibility": "object | null",
    "location": "string | null",
    "is_remote": "boolean | null",
    "funding_type": "string | null",
    "deadline": "ISO 8601 datetime | null",
    "application_url": "string | null",
    "source_url": "string",
    "country": "string | null",
    "study_levels": "string[]",
    "fields_of_study": "string[]",
    "source_id": "string (UUID) | null",
    "created_at": "ISO 8601 datetime",
    "updated_at": "ISO 8601 datetime"
  },
  "timestamp": "ISO 8601 datetime"
}
```

> Object shape narrows when `fields` is explicitly provided.
> `eligibility` is a freeform JSON object managed by the AI service; its internal structure is not validated by this module.

---

## Error Contracts

### 400 — Invalid Path Parameter

```json
{
  "success": false,
  "status": 400,
  "message": "Validation failed (uuid is expected)",
  "error": "VALIDATION_ERROR",
  "timestamp": "ISO 8601 datetime"
}
```

Triggered when `:id` is not a valid UUID format (e.g., `"abc"`, `"123"`).

### 400 — Invalid `fields` Value

```json
{
  "success": false,
  "status": 400,
  "message": "Field '<name>' is not allowed",
  "error": "INVALID_FIELD",
  "timestamp": "ISO 8601 datetime"
}
```

### 404 — Not Found

```json
{
  "success": false,
  "status": 404,
  "message": "Opportunity not found",
  "error": "OPPORTUNITY_NOT_FOUND",
  "timestamp": "ISO 8601 datetime"
}
```

Triggered when no record exists for the given UUID (including records that were deleted from the AI service DB).

### 503 — Service Unavailable

```json
{
  "success": false,
  "status": 503,
  "message": "Opportunity data source is currently unavailable",
  "error": "SERVICE_UNAVAILABLE",
  "timestamp": "ISO 8601 datetime"
}
```

### 500 — Internal Error

```json
{
  "success": false,
  "status": 500,
  "message": "Internal server error",
  "error": "INTERNAL_ERROR",
  "timestamp": "ISO 8601 datetime"
}
```
