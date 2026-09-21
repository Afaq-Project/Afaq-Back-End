# Profile Education (Batch 2) — Endpoints

**Feature**: Profile Education (Batch 2)
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/profile/educations` | 🔒 | Create an education record |
| 2 | `GET` | `/profile/educations` | 🔒 | List all education records |
| 3 | `GET` | `/profile/educations/:id` | 🔒 | Retrieve a single education record |
| 4 | `PATCH` | `/profile/educations/:id` | 🔒 | Partially update an education record |
| 5 | `DELETE` | `/profile/educations/:id` | 🔒 | Permanently delete an education record |
| 6 | `GET` | `/reference/major-categories` | 🌐 | List major categories (paginated, filterable) |
| 7 | `GET` | `/reference/majors` | 🌐 | List majors (paginated, filterable) |
| 8 | `GET` | `/reference/institutions` | 🌐 | List institutions (paginated, filterable) |

**Total**: 8 endpoints (5 authenticated, 3 public)

---

## Batch 2 — Education Section

### Domain Rules (Apply to All Education Endpoints)

### GPA Normalization
Every education record stores three GPA fields:
- `gpaRaw` — as entered by the user
- `gpaScale` — one of `OUT_OF_4`, `OUT_OF_5`, `OUT_OF_100`
- `gpaNormalized` — **computed by the backend**, always on a 0–4.0 scale

**Formula** (never computed on the client):
| Scale | Formula |
|:---|:---|
| `OUT_OF_4` | `gpaNormalized = gpaRaw` |
| `OUT_OF_5` | `gpaNormalized = (gpaRaw / 5) * 4` |
| `OUT_OF_100` | `gpaNormalized = (gpaRaw / 100) * 4` |

`gpaScale` is **required** whenever `gpaRaw` is present.

### `isCurrent` Semantics
`isCurrent` indicates whether the user is still studying in this record.

| `isCurrent` | Semantics | Required state of date fields |
|:---:|:---|:---|
| `true` | Currently studying | `expectedGraduationDate` MAY be set; **`endDate` MUST be `null`** |
| `false` (default) | Graduated | `endDate` MAY be set; **`expectedGraduationDate` MUST be `null`** |

**Enforcement rule**: On any create or update, if `isCurrent = true`, the backend **clears `endDate` to `null`**. If `isCurrent = false`, the backend **clears `expectedGraduationDate` to `null`**. This prevents inconsistent date states and is enforced server-side regardless of what the client sends.

### Minor Major Rule
Each education record supports **exactly one** primary major (`majorId`, required) and **at most one** minor major (`minorMajorId`, optional). Multiple minors in a single record are not supported.

### Ownership Rule
All `/profile/educations/:id` operations require that the record's `userId` matches the authenticated user. A mismatch results in `404 Not Found` (not `403 Forbidden`) to prevent resource enumeration.

### Recalculation Rule
Every successful mutation (create, update, delete) triggers `ProfileService.recalculate(userId)` before the response is returned. The response reflects the freshly computed `completionPct` and `matchingVersion`.

### Uniqueness Rule
The combination `(userId, institutionId, majorId, educationLevelId)` is unique. Any operation that would produce a duplicate returns `409 Conflict`.

### Record Limit
The number of education records per user is limited by `SystemSettings.max_educations` (default `5`). Exceeding the limit returns `409 Conflict`.

---

## 8. `POST /api/v1/profile/educations`

### Purpose
Create a new education record for the authenticated user.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/api/v1/profile/educations` |
| **Auth** | Bearer JWT |
| **Headers** | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| **Body** | `CreateEducationDto` |

### Body — `CreateEducationDto`

| Field | Type | Required | Validation | Description |
|:---|:---|:---:|:---|:---|
| `educationLevelId` | `string` (UUID) | Yes | `@IsUUID` | FK to `EducationLevel` |
| `institutionId` | `string` (UUID) | Yes | `@IsUUID` | FK to `Institutions` |
| `majorId` | `string` (UUID) | Yes | `@IsUUID` | FK to `Majors` (primary) |
| `minorMajorId` | `string` (UUID) | No | `@IsOptional`, `@IsUUID` | FK to `Majors` (minor, at most one) |
| `startDate` | `string` (ISO date) | No | `@IsOptional`, `@IsDateString` | Study start date |
| `endDate` | `string` (ISO date) | No | `@IsOptional`, `@IsDateString` | Actual graduation date; must be ≥ `startDate` |
| `expectedGraduationDate` | `string` (ISO date) | No | `@IsOptional`, `@IsDateString` | Expected graduation for current students |
| `isCurrent` | `boolean` | No | Default `false` | Whether the user is still studying |
| `gpaRaw` | `number` | No | `@IsOptional`, `@Min(0)` | GPA as entered |
| `gpaScale` | `string` (enum) | Conditional | Required if `gpaRaw` is provided | One of `OUT_OF_4`, `OUT_OF_5`, `OUT_OF_100` |

### Business Rules

1. All three FKs (`educationLevelId`, `institutionId`, `majorId`) must exist in their respective tables.
2. `minorMajorId`, if provided, must exist and **must differ** from `majorId`.
3. If `isCurrent = true` → server sets `endDate = null` regardless of input.
4. If `isCurrent = false` → server sets `expectedGraduationDate = null` regardless of input.
5. If `endDate` and `startDate` are both provided → `endDate >= startDate`.
6. `gpaScale` is required if `gpaRaw` is provided.
7. `gpaNormalized` is computed server-side from `gpaRaw` + `gpaScale`.
8. Uniqueness enforced on `(userId, institutionId, majorId, educationLevelId)`.
9. `MAX_EDUCATIONS` limit enforced from `SystemSettings`.

### Example Request

```json
{
  "institutionId": "uuid-mit",
  "majorId": "uuid-cs",
  "educationLevelId": "uuid-bachelor",
  "minorMajorId": "uuid-math",
  "startDate": "2022-09-01",
  "isCurrent": true,
  "expectedGraduationDate": "2026-06-30",
  "gpaRaw": 3.7,
  "gpaScale": "OUT_OF_4"
}
```

### Response — `201 Created`

```json
{
  "statusCode": 201,
  "message": "Education record created successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "educationLevelId": "uuid-bachelor",
    "educationLevel": { "id": "uuid", "code": "bachelor", "nameEn": "Bachelor's Degree", "nameAr": "بكالوريوس" },
    "institutionId": "uuid-mit",
    "institution": { "id": "uuid", "nameEn": "Massachusetts Institute of Technology", "nameAr": "معهد ماساتشوستس للتكنولوجيا" },
    "majorId": "uuid-cs",
    "major": { "id": "uuid", "nameEn": "Computer Science", "nameAr": "علوم الحاسب" },
    "minorMajorId": "uuid-math",
    "minorMajor": { "id": "uuid", "nameEn": "Mathematics", "nameAr": "الرياضيات" },
    "startDate": "2022-09-01",
    "endDate": null,
    "expectedGraduationDate": "2026-06-30",
    "isCurrent": true,
    "gpaRaw": "3.70",
    "gpaScale": "OUT_OF_4",
    "gpaNormalized": "3.70",
    "createdAt": "2026-09-21T10:00:00.000Z",
    "updatedAt": null
  },
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Extra field sent |
| `400` | `INVALID_DATE_RANGE` | `End date must be after or equal to start date` | `endDate < startDate` |
| `400` | `GPA_SCALE_REQUIRED` | `GPA scale is required when GPA raw is provided` | `gpaRaw` without `gpaScale` |
| `400` | `MINOR_MAJOR_EQUALS_MAJOR` | `Minor major must differ from primary major` | `minorMajorId == majorId` |
| `400` | `INVALID_EDUCATION_LEVEL` | `Education level not found` | `educationLevelId` does not exist |
| `400` | `INVALID_INSTITUTION` | `Institution not found` | `institutionId` does not exist |
| `400` | `INVALID_MAJOR` | `Major not found` | `majorId` does not exist |
| `400` | `INVALID_MINOR_MAJOR` | `Minor major not found` | `minorMajorId` does not exist |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `409` | `EDUCATION_DUPLICATE` | `An education record with the same institution, major, and level already exists` | Uniqueness violation |
| `409` | `MAX_EDUCATIONS_REACHED` | `Maximum number of education records reached` | `MAX_EDUCATIONS` exceeded |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 9. `GET /api/v1/profile/educations`

### Purpose
Retrieve all education records belonging to the authenticated user.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/educations` |
| **Auth** | Bearer JWT |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Education records retrieved successfully",
  "data": [
    {
      "id": "uuid-1",
      "userId": "uuid",
      "educationLevelId": "uuid-bachelor",
      "educationLevel": { "id": "uuid", "code": "bachelor", "nameEn": "Bachelor's Degree", "nameAr": "بكالوريوس" },
      "institutionId": "uuid-mit",
      "institution": { "id": "uuid", "nameEn": "MIT", "nameAr": "معهد ماساتشوستس" },
      "majorId": "uuid-cs",
      "major": { "id": "uuid", "nameEn": "Computer Science", "nameAr": "علوم الحاسب" },
      "minorMajorId": "uuid-math",
      "minorMajor": { "id": "uuid", "nameEn": "Mathematics", "nameAr": "الرياضيات" },
      "startDate": "2022-09-01",
      "endDate": null,
      "expectedGraduationDate": "2026-06-30",
      "isCurrent": true,
      "gpaRaw": "3.70",
      "gpaScale": "OUT_OF_4",
      "gpaNormalized": "3.70",
      "createdAt": "2026-09-21T10:00:00.000Z",
      "updatedAt": null
    }
  ],
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

### Notes
- Empty list (`[]`) is returned when no records exist — never `null`.
- Results are ordered by `updatedAt DESC` (most recently updated first), falling back to `createdAt DESC`.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 10. `GET /api/v1/profile/educations/:id`

### Purpose
Retrieve a single education record by its ID. Ownership is enforced.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/educations/:id` |
| **Auth** | Bearer JWT |
| **Params** | `id` — UUID of the education record |
| **Body** | None |

### Response — `200 OK`

Same shape as `POST` response `data` object.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `id` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `EDUCATION_NOT_FOUND` | `Education record not found` | Record does not exist **or** belongs to another user |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 11. `PATCH /api/v1/profile/educations/:id`

### Purpose
Partially update an education record. Only the fields included in the request body are modified; all others remain unchanged.

### Request

| Property | Value |
|:---|:---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/profile/educations/:id` |
| **Auth** | Bearer JWT |
| **Params** | `id` — UUID of the education record |
| **Body** | `UpdateEducationDto` |

### Body — `UpdateEducationDto`

All fields from `CreateEducationDto` become **optional**. Server-side rules apply as follows:

| Field | Notes |
|:---|:---|
| `educationLevelId` | If provided, must exist and not create a uniqueness conflict |
| `institutionId` | Same |
| `majorId` | Same |
| `minorMajorId` | If provided, must exist and differ from `majorId` |
| `startDate` / `endDate` / `expectedGraduationDate` | Validated against the merged state (existing + submitted values) |
| `isCurrent` | If provided, triggers the date-clearing rule (see Domain Rules) |
| `gpaRaw` / `gpaScale` | If either changes → `gpaNormalized` is recomputed |

### Example Requests

**Update GPA only** (scale already exists on the record):
```json
{ "gpaRaw": 3.85 }
```

**Switch to graduated state**:
```json
{
  "isCurrent": false,
  "endDate": "2024-06-15"
}
```
Server clears `expectedGraduationDate` to `null`.

**Update primary major** (uniqueness re-checked):
```json
{ "majorId": "uuid-new-major" }
```

### Response — `200 OK`

Same shape as `POST` response, with updated fields and refreshed `updatedAt`.

### Business Rules

1. Partial update — only submitted fields are modified.
2. `gpaNormalized` is recomputed **only if** `gpaRaw` or `gpaScale` changed.
3. If `isCurrent = true` is submitted → `endDate` is forcibly set to `null`.
4. If `isCurrent = false` is submitted → `expectedGraduationDate` is forcibly set to `null`.
5. Uniqueness is re-checked against the merged state (existing + new values).
6. Ownership: the record must belong to the authenticated user.
7. `ProfileService.recalculate(userId)` is called on success.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Extra field sent |
| `400` | `INVALID_DATE_RANGE` | `End date must be after or equal to start date` | Merged dates invalid |
| `400` | `GPA_SCALE_REQUIRED` | `GPA scale is required when GPA raw is provided` | New `gpaRaw` without any scale (new or existing) |
| `400` | `MINOR_MAJOR_EQUALS_MAJOR` | `Minor major must differ from primary major` | Merged state violates rule |
| `400` | `INVALID_EDUCATION_LEVEL` | `Education level not found` | New FK does not exist |
| `400` | `INVALID_INSTITUTION` | `Institution not found` | New FK does not exist |
| `400` | `INVALID_MAJOR` | `Major not found` | New FK does not exist |
| `400` | `INVALID_MINOR_MAJOR` | `Minor major not found` | New FK does not exist |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `EDUCATION_NOT_FOUND` | `Education record not found` | Record does not exist or belongs to another user |
| `409` | `EDUCATION_DUPLICATE` | `An education record with the same institution, major, and level already exists` | Merged state conflicts with another record |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 12. `DELETE /api/v1/profile/educations/:id`

### Purpose
Permanently delete an education record. This is a **hard delete** — no soft-delete, no recovery.

### Request

| Property | Value |
|:---|:---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/profile/educations/:id` |
| **Auth** | Bearer JWT |
| **Params** | `id` — UUID of the education record |
| **Body** | None |

### Response — `204 No Content`

No response body.

### Side Effects

1. The record is removed from the database permanently.
2. `ProfileService.recalculate(userId)` is triggered.
3. If the deleted record was the user's **only** education record, `completionPct` drops by **25 points** (the "has at least one education record" contribution). The `educationLevelId` on the profile is **not** cleared — that field is managed separately via `PATCH /profile/personal`.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `id` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `EDUCATION_NOT_FOUND` | `Education record not found` | Record does not exist or belongs to another user |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 13. `GET /api/v1/reference/major-categories` [PUBLIC]

### Purpose
Retrieve a paginated, filterable list of major categories (e.g., Engineering, Medicine, Business).

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/reference/major-categories` |
| **Auth** | 🌐 Public |
| **Query Params** | See below |

### Query Parameters

| Param | Type | Default | Validation | Description |
|:---|:---|:---|:---|:---|
| `search` | `string` | — | `@IsOptional`, `@MaxLength(100)` | Search in `nameEn`, `nameAr` (ILIKE) |
| `isActive` | `boolean` | `true` | `@IsOptional`, `@IsBoolean` | Include inactive categories when `false` |
| `page` | `number` | `1` | `@IsOptional`, `@IsInt`, `@Min(1)` | Page number |
| `limit` | `number` | `50` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Max(200)` | Items per page |
| `sort` | `string` | `sortOrder` | `@IsOptional`, `@IsIn(['nameEn','nameAr','sortOrder'])` | Sort field |
| `order` | `string` | `asc` | `@IsOptional`, `@IsIn(['asc','desc'])` | Sort direction |

### Example Request

```
GET /api/v1/reference/major-categories?search=Eng&page=1&limit=20
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Major categories retrieved successfully",
  "data": [
    { "id": "uuid-1", "nameEn": "Engineering", "nameAr": "الهندسة" },
    { "id": "uuid-2", "nameEn": "Medicine", "nameAr": "الطب" }
  ],
  "meta": {
    "total": 40,
    "page": 1,
    "limit": 20,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Invalid `page`, `limit`, `sort`, or `order` |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 14. `GET /api/v1/reference/majors` [PUBLIC]

### Purpose
Retrieve a paginated, filterable list of majors. Each major returns only its `categoryId` — the frontend fetches category details separately from `/reference/major-categories`.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/reference/majors` |
| **Auth** | 🌐 Public |
| **Query Params** | See below |

### Query Parameters

| Param | Type | Default | Validation | Description |
|:---|:---|:---|:---|:---|
| `categoryId` | `string` (UUID) | — | `@IsOptional`, `@IsUUID` | Filter by category |
| `search` | `string` | — | `@IsOptional`, `@MaxLength(100)` | Search in `nameEn`, `nameAr` |
| `page` | `number` | `1` | `@IsOptional`, `@IsInt`, `@Min(1)` | Page number |
| `limit` | `number` | `50` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Max(200)` | Items per page |
| `sort` | `string` | `nameEn` | `@IsOptional`, `@IsIn(['nameEn','nameAr'])` | Sort field |
| `order` | `string` | `asc` | `@IsOptional`, `@IsIn(['asc','desc'])` | Sort direction |

### Example Request

```
GET /api/v1/reference/majors?categoryId=uuid-eng&search=Comp&page=1&limit=20
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Majors retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "nameEn": "Computer Science",
      "nameAr": "علوم الحاسب",
      "categoryId": "uuid-eng"
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Invalid `categoryId`, `page`, `limit`, `sort`, or `order` |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 15. `GET /api/v1/reference/institutions` [PUBLIC]

### Purpose
Retrieve a paginated, filterable list of educational institutions. Returns only `countryId` and `cityId` — the frontend fetches country and city details separately.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/reference/institutions` |
| **Auth** | 🌐 Public |
| **Query Params** | See below |

### Query Parameters

| Param | Type | Default | Validation | Description |
|:---|:---|:---|:---|:---|
| `countryId` | `string` (UUID) | — | `@IsOptional`, `@IsUUID` | Filter by country |
| `cityId` | `string` (UUID) | — | `@IsOptional`, `@IsUUID` | Filter by city |
| `search` | `string` | — | `@IsOptional`, `@MaxLength(100)` | Search in `nameEn`, `nameAr` |
| `page` | `number` | `1` | `@IsOptional`, `@IsInt`, `@Min(1)` | Page number |
| `limit` | `number` | `50` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Max(200)` | Items per page |
| `sort` | `string` | `nameEn` | `@IsOptional`, `@IsIn(['nameEn','nameAr'])` | Sort field |
| `order` | `string` | `asc` | `@IsOptional`, `@IsIn(['asc','desc'])` | Sort direction |

### Example Request

```
GET /api/v1/reference/institutions?countryId=uuid-ps&cityId=uuid-ramallah&search=University
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Institutions retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "nameEn": "Birzeit University",
      "nameAr": "جامعة بيرزيت",
      "countryId": "uuid-ps",
      "cityId": "uuid-birzeit"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | Invalid `countryId`, `cityId`, `page`, `limit`, `sort`, or `order` |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## Cross-Endpoint Conventions

### Standard Response Envelope

**Success**:
```json
{
  "statusCode": 200,
  "message": "Human-readable message",
  "data": { },
  "meta": { },
  "timestamp": "ISO 8601"
}
```

**Error**:
```json
{
  "statusCode": 400,
  "message": "Human-readable message",
  "error": "ErrorKey",
  "timestamp": "ISO 8601"
}
```

### HTTP Status Codes

| Code | Meaning |
|:---:|:---|
| `200` | OK — Successful read or update |
| `201` | Created — Successful resource creation |
| `204` | No Content — Successful deletion |
| `400` | Bad Request — Validation or business rule failure |
| `401` | Unauthorized — Missing or invalid JWT |
| `404` | Not Found — Resource absent or owned by another user |
| `409` | Conflict — Uniqueness violation or limit exceeded |
| `500` | Internal Server Error — Unexpected failure |

### Validation

- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- Any field not declared in the DTO triggers `400 UNKNOWN_FIELD`.
- Frontend must be informed of the exact field whitelist per endpoint.

### Recalculation Contract

Every successful mutation on `/profile/*` triggers `ProfileService.recalculate(userId)` before the response is returned. The response reflects the freshly computed `completionPct`, `isMatchable`, and `matchingVersion`.

### Swagger Requirements

Every controller method must have:
- `@ApiTags`
- `@ApiOperation`
- `@ApiResponse` for `200`/`201`/`204` and each error code
- `@ApiBearerAuth` (or `@Public()` for reference endpoints)
- `@ApiQuery` for each query parameter
- `@ApiBody` for endpoints with a request body

## Endpoint-to-User-Story Map (Batch 2 additions)

| Endpoint | User Story | FR Coverage |
|:---|:---|:---|
| `POST /profile/educations` | US2 | FR-014, FR-015, FR-016, FR-017, FR-018 |
| `GET /profile/educations` | US2 | FR-014 |
| `GET /profile/educations/:id` | US2 | FR-014 |
| `PATCH /profile/educations/:id` | US2 | FR-014, FR-015, FR-016, FR-017 |
| `DELETE /profile/educations/:id` | US2 | FR-017 |
| `GET /reference/major-categories` | US2 | FR-037, FR-038, FR-039, FR-040 |
| `GET /reference/majors` | US2 | FR-037, FR-038, FR-039, FR-040 |
| `GET /reference/institutions` | US2 | FR-037, FR-038, FR-039, FR-040 |
