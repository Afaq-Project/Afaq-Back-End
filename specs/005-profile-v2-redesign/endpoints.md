# Profile Module v2 Redesign — Endpoints

**Feature**: Profile Module v2 Redesign
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `GET` | `/profile/me` | 🔒 | Retrieve full profile |
| 2 | `PATCH` | `/profile/personal` | 🔒 | Update personal info + location |
| 3 | `GET` | `/reference/countries` | 🌐 | List countries (paginated) |
| 4 | `GET` | `/reference/cities` | 🌐 | List cities (paginated, filterable) |
| 5 | `GET` | `/reference/marital-statuses` | 🌐 | List marital statuses |
| 6 | `GET` | `/reference/education-levels` | 🌐 | List education levels |
| 7 | `GET` | `/reference/app-languages` | 🌐 | List supported UI languages |
| 8 | `POST` | `/profile/educations` | 🔒 | Create an education record |
| 9 | `GET` | `/profile/educations` | 🔒 | List all education records |
| 10 | `GET` | `/profile/educations/:id` | 🔒 | Retrieve a single education record |
| 11 | `PATCH` | `/profile/educations/:id` | 🔒 | Partially update an education record |
| 12 | `DELETE` | `/profile/educations/:id` | 🔒 | Permanently delete an education record |
| 13 | `GET` | `/reference/major-categories` | 🌐 | List major categories (paginated, filterable) |
| 14 | `GET` | `/reference/majors` | 🌐 | List majors (paginated, filterable) |
| 15 | `GET` | `/reference/institutions` | 🌐 | List institutions (paginated, filterable) |

**Total**: 15 endpoints (7 authenticated, 8 public)

**Removed**: The matchable endpoint — `isMatchable` is now system-controlled only.

---

## 1. `GET /api/v1/profile/me`

### Purpose
Retrieve the complete profile of the authenticated user, including all 8 sections (personal info, location, education, languages, tests, special statuses, target preferences, documents).

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/me` |
| **Auth** | Bearer JWT |
| **Headers** | `Authorization: Bearer <token>` |
| **Query Params** | None |
| **Body** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "userId": "uuid",
    "firstName": null,
    "lastName": null,
    "email": null,
    "dateOfBirth": null,
    "gender": null,
    "maritalStatusId": null,
    "maritalStatus": null,
    "phone": null,
    "bio": null,
    "profilePhotoUrl": null,
    "countryOfResidenceId": null,
    "countryOfResidence": null,
    "nationalityId": null,
    "nationality": null,
    "currentCityId": null,
    "currentCity": null,
    "educationLevelId": null,
    "educationLevel": null,
    "completionPct": 0,
    "isMatchable": false,
    "matchingVersion": 1,
    "educations": [],
    "languages": [],
    "testResults": [],
    "specialStatuses": [],
    "targetDegrees": [],
    "targetMajors": [],
    "targetInstitutions": [],
    "documents": [],
    "createdAt": "2026-09-21T10:00:00.000Z",
    "updatedAt": null
  },
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

### Notes
- Every section is always present — empty sections return `[]` or `null`, never omitted.
- `isMatchable` is **read-only** and computed by the system (`completionPct >= matching.threshold`).
- Reference objects (`maritalStatus`, `countryOfResidence`, `nationality`, `currentCity`, `educationLevel`) include `{ id, nameEn, nameAr }` (or `{ id, code, nameEn, nameAr }` for educationLevel).

### Error Responses

| Code | Message | Trigger |
|:---:|:---|:---|
| `401` | `Unauthorized` | Missing, invalid, or expired JWT |
| `404` | `Profile not found` | Profile record missing (should not occur — created at signup) |
| `500` | `Internal server error` | Unexpected database failure |

---

## 2. `PATCH /api/v1/profile/personal`

### Purpose
Update personal information and location fields on the authenticated user's profile. Partial update — all fields optional. Automatically triggers recalculation of `completionPct`, `isMatchable`, and `matchingVersion`.

### Request

| Property | Value |
|:---|:---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/profile/personal` |
| **Auth** | Bearer JWT |
| **Headers** | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| **Body** | `UpdateProfileDto` (see below) |

### Body — `UpdateProfileDto`

All fields optional. At least one field must be present.

| Field | Type | Validation | Description |
|:---|:---|:---|:---|
| `firstName` | `string` | `@IsOptional`, `@IsString`, `@MaxLength(255)` | Profile first name |
| `lastName` | `string` | `@IsOptional`, `@IsString`, `@MaxLength(255)` | Profile last name |
| `email` | `string` | `@IsOptional`, `@IsEmail` | Profile email (independent from account email) |
| `dateOfBirth` | `string` | `@IsOptional`, `@IsDateString` | ISO 8601 date |
| `gender` | `enum` | `@IsOptional`, `@IsEnum(Gender)` | `MALE` \| `FEMALE` |
| `maritalStatusId` | `string` (UUID) | `@IsOptional`, `@IsUUID` | FK to `MaritalStatuses` |
| `phone` | `string` | `@IsOptional`, `@IsString`, `@MaxLength(30)` | Contact phone |
| `bio` | `string` | `@IsOptional`, `@IsString` | Max length from `SystemSettings.max_bio_length` |
| `profilePhotoUrl` | `string` | `@IsOptional`, `@IsUrl` | URL string |
| `experiences` | `string[]` | `@IsOptional`, `@IsArray`, `@IsString({each:true})`, `@ArrayMaxSize(dynamic)`, `@MaxLength(500, {each:true})` | List of free-text experience entries |
| `countryOfResidenceId` | `string` (UUID) | `@IsOptional`, `@IsUUID` | FK to `Countries` |
| `nationalityId` | `string` (UUID) | `@IsOptional`, `@IsUUID` | FK to `Countries` |
| `currentCityId` | `string` (UUID) | `@IsOptional`, `@IsUUID` | FK to `Cities` |
| `educationLevelId` | `string` (UUID) | `@IsOptional`, `@IsUUID` | FK to `EducationLevel` |

**Forbidden fields** (rejected by `forbidNonWhitelisted: true`):
- `completionPct`, `isMatchable`, `matchingVersion`, `userId`, `createdAt`, `updatedAt`

### Response — `200 OK`

Returns the full updated profile (same shape as `GET /profile/me`), with `completionPct`, `isMatchable`, and `matchingVersion` recalculated.

### Business Rules

1. **Partial update** — only submitted fields are modified.
2. **Recalculation trigger** — `completionPct`, `isMatchable`, and `matchingVersion` are recomputed automatically after the update.
3. **`bio` length** — enforced against `SystemSettings.max_bio_length` (default 1000).
4. **City-country consistency**:
   - If `countryOfResidenceId` is changed and the existing `currentCityId` does not belong to the new country, `currentCityId` is **automatically cleared**.
   - If `currentCityId` is provided and does not belong to the resolved country, the request is **rejected with 400**.
5. **Foreign key validation** — every UUID must exist in its target table.
6. **No manual override** — `completionPct`, `isMatchable`, and `matchingVersion` are
   not DTO fields; sending any of them is rejected with `400 UNKNOWN_FIELD`.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Extra field sent |
| `400` | `BIO_TOO_LONG` | `Bio exceeds maximum length of {max} characters` | `bio` length > `max_bio_length` |
| `400` | `TOO_MANY_EXPERIENCES` | `Experiences exceed maximum of {max} entries` | Array longer than `MAX_EXPERIENCES` |
| `400` | `CITY_COUNTRY_MISMATCH` | `Selected city does not belong to the selected country` | `currentCityId` mismatch |
| `400` | `INVALID_MARITAL_STATUS` | `Marital status not found` | `maritalStatusId` does not exist |
| `400` | `INVALID_COUNTRY` | `Country not found` | Country does not exist |
| `400` | `INVALID_CITY` | `City not found` | City does not exist |
| `400` | `INVALID_EDUCATION_LEVEL` | `Education level not found` | Education level does not exist |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 3. `GET /api/v1/reference/countries` [PUBLIC]

### Purpose
Retrieve a paginated, filterable, sortable list of countries. No authentication required.

### Query Parameters

| Param | Type | Default | Validation | Description |
|:---|:---|:---|:---|:---|
| `search` | `string` | — | `@IsOptional`, `@MaxLength(100)` | Search in `nameEn`, `nameAr`, `isoCode` (ILIKE) |
| `region` | `string` | — | `@IsOptional`, `@IsString` | Filter by region (e.g., `Asia`, `Europe`) |
| `page` | `number` | `1` | `@IsOptional`, `@IsInt`, `@Min(1)` | Page number |
| `limit` | `number` | `50` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Max(200)` | Items per page |
| `sort` | `string` | `nameEn` | `@IsOptional`, `@IsIn(['nameEn','nameAr','isoCode'])` | Sort field |
| `order` | `string` | `asc` | `@IsOptional`, `@IsIn(['asc','desc'])` | Sort direction |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Countries retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "nameEn": "Palestine",
      "nameAr": "فلسطين",
      "isoCode": "PSE",
      "isoCode2": "PS",
      "regionEn": "Asia",
      "phoneCode": "+970",
      "flagEmoji": "🇵🇸"
    }
  ],
  "meta": {
    "total": 194,
    "page": 1,
    "limit": 20,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

---

## 4. `GET /api/v1/reference/cities` [PUBLIC]

### Purpose
Retrieve a paginated, filterable list of cities. Filtering by `countryId` is optional but strongly recommended.

### Query Parameters

| Param | Type | Default | Validation | Description |
|:---|:---|:---|:---|:---|
| `countryId` | `string` (UUID) | — | `@IsOptional`, `@IsUUID` | Filter by country |
| `search` | `string` | — | `@IsOptional`, `@MaxLength(100)` | Search in `nameEn`, `nameAr` |
| `page` | `number` | `1` | `@IsOptional`, `@IsInt`, `@Min(1)` | Page number |
| `limit` | `number` | `50` | `@IsOptional`, `@IsInt`, `@Min(1)`, `@Max(200)` | Items per page |
| `sort` | `string` | `nameEn` | `@IsOptional`, `@IsIn(['nameEn','nameAr'])` | Sort field |
| `order` | `string` | `asc` | `@IsOptional`, `@IsIn(['asc','desc'])` | Sort direction |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Cities retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "nameEn": "Ramallah",
      "nameAr": "رام الله",
      "countryId": "uuid-ps"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

---

## 5. `GET /api/v1/reference/marital-statuses` [PUBLIC]

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Marital statuses retrieved successfully",
  "data": [
    { "id": "uuid-1", "nameEn": "Single",  "nameAr": "أعزب" },
    { "id": "uuid-2", "nameEn": "Married", "nameAr": "متزوج" }
  ],
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

---

## 6. `GET /api/v1/reference/education-levels` [PUBLIC]

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Education levels retrieved successfully",
  "data": [
    {
      "id": "uuid-1",
      "code": "bachelor",
      "nameEn": "Bachelor's Degree",
      "nameAr": "بكالوريوس"
    }
  ],
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

---

## 7. `GET /api/v1/reference/app-languages` [PUBLIC]

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "App languages retrieved successfully",
  "data": [
    { "code": "ar", "nameEn": "Arabic",  "nameAr": "العربية" },
    { "code": "en", "nameEn": "English", "nameAr": "الإنجليزية" }
  ],
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```


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

# Batch 3 — Languages Section

**Feature**: Profile Module v2 Redesign
**Batch**: 03 — Languages Section
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/profile/languages` | 🔒 | Add a language to the user's profile |
| 2 | `GET` | `/profile/languages` | 🔒 | List all languages of the authenticated user |
| 3 | `GET` | `/profile/languages/:languageId` | 🔒 | Retrieve a single language record |
| 4 | `PATCH` | `/profile/languages/:languageId` | 🔒 | Partially update a language record |
| 5 | `DELETE` | `/profile/languages/:languageId` | 🔒 | Permanently delete a language record |
| 6 | `GET` | `/reference/languages` | 🌐 | List all supported languages |
| 7 | `GET` | `/reference/proficiency-levels` | 🌐 | List all proficiency levels |

**Total**: 7 endpoints (5 authenticated, 2 public)

**Unblocks**: US3 — Language Records

**Completion Weight Impact**: Contributes **10%** to `completionPct` — awarded once when the user has at least one language record.

---

## Domain Rules (Apply to All Language Endpoints)

### Uniqueness
The composite key `(userId, languageId)` is unique. A user cannot register the same language twice. Any attempt to create a duplicate returns `409 Conflict`.

### Record Limit
The number of language records per user is limited by `SystemSettings.max_languages` (default `10`). Exceeding the limit returns `409 Conflict`.

### Proficiency Level
`proficiencyLevelId` is mandatory on creation. It references `ProficiencyLevels` — free-text proficiency is not accepted.

### Native Flag
`isNative` is an optional boolean (default `false`). A user may mark more than one language as native; the system does not restrict this.

### Ownership
All `/profile/languages/:languageId` operations verify that the record belongs to the authenticated user. A mismatch returns `404 Not Found` (not `403 Forbidden`).

### Recalculation
Every successful mutation triggers `ProfileService.recalculate(userId)` before the response is returned. The response reflects the freshly computed `completionPct` and `matchingVersion`.

### Composite Primary Key Handling
`userId` + `languageId` together form the primary key. Because `userId` is extracted from the JWT, the `:languageId` path parameter uniquely identifies the record.

---

## 1. `POST /api/v1/profile/languages`

### Purpose
Add a new language record to the authenticated user's profile.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/api/v1/profile/languages` |
| **Auth** | Bearer JWT |
| **Headers** | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| **Body** | `CreateLanguageDto` |

### Body — `CreateLanguageDto`

| Field | Type | Required | Validation | Description |
|:---|:---|:---:|:---|:---|
| `languageId` | `string` (UUID) | Yes | `@IsUUID` | FK to `LanguagesMaster` |
| `proficiencyLevelId` | `string` (UUID) | Yes | `@IsUUID` | FK to `ProficiencyLevels` |
| `isNative` | `boolean` | No | `@IsOptional`, `@IsBoolean` | Default `false` |

### Example Request

```json
{
  "languageId": "uuid-arabic",
  "proficiencyLevelId": "uuid-native",
  "isNative": true
}
```

### Response — `201 Created`

```json
{
  "statusCode": 201,
  "message": "Language record created successfully",
  "data": {
    "userId": "uuid",
    "languageId": "uuid-arabic",
    "language": {
      "id": "uuid-arabic",
      "nameEn": "Arabic",
      "nameAr": "العربية",
      "isoCode": "ar"
    },
    "proficiencyLevelId": "uuid-native",
    "proficiencyLevel": {
      "id": "uuid-native",
      "nameEn": "Native",
      "nameAr": "اللغة الأم",
      "sortOrder": 5
    },
    "isNative": true
  },
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Business Rules

1. `languageId` must exist in `LanguagesMaster`.
2. `proficiencyLevelId` must exist in `ProficiencyLevels`.
3. If `isNative` is omitted, it defaults to `false`.
4. `MAX_LANGUAGES` enforced from `SystemSettings`.
5. Uniqueness enforced on `(userId, languageId)`.
6. `ProfileService.recalculate(userId)` is called on success.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Extra field sent |
| `400` | `INVALID_LANGUAGE` | `Language not found` | `languageId` does not exist |
| `400` | `INVALID_PROFICIENCY_LEVEL` | `Proficiency level not found` | `proficiencyLevelId` does not exist |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `409` | `LANGUAGE_DUPLICATE` | `This language is already added to your profile` | Uniqueness violation |
| `409` | `MAX_LANGUAGES_REACHED` | `Maximum number of language records reached` | `MAX_LANGUAGES` exceeded |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 2. `GET /api/v1/profile/languages`

### Purpose
Retrieve all language records belonging to the authenticated user, with embedded language and proficiency data.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/languages` |
| **Auth** | Bearer JWT |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Language records retrieved successfully",
  "data": [
    {
      "userId": "uuid",
      "languageId": "uuid-arabic",
      "language": {
        "id": "uuid-arabic",
        "nameEn": "Arabic",
        "nameAr": "العربية",
        "isoCode": "ar"
      },
      "proficiencyLevelId": "uuid-native",
      "proficiencyLevel": {
        "id": "uuid-native",
        "nameEn": "Native",
        "nameAr": "اللغة الأم",
        "sortOrder": 5
      },
      "isNative": true
    }
  ],
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- Empty list (`[]`) is returned when no records exist — never `null`.
- Results are ordered by `isNative DESC`, then `proficiencyLevel.sortOrder DESC` (native languages first, then by descending proficiency).

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 3. `GET /api/v1/profile/languages/:languageId`

### Purpose
Retrieve a single language record by its `languageId`. Ownership is enforced.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/languages/:languageId` |
| **Auth** | Bearer JWT |
| **Params** | `languageId` — UUID of the language record |
| **Body** | None |

### Response — `200 OK`

Same shape as the `POST` response `data` object.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `languageId` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `LANGUAGE_NOT_FOUND` | `Language record not found` | Record does not exist **or** belongs to another user |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 4. `PATCH /api/v1/profile/languages/:languageId`

### Purpose
Partially update a language record. Only the fields included in the request body are modified.

### Request

| Property | Value |
|:---|:---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/profile/languages/:languageId` |
| **Auth** | Bearer JWT |
| **Params** | `languageId` — UUID of the language record |
| **Body** | `UpdateLanguageDto` |

### Body — `UpdateLanguageDto`

All fields optional. Note that `languageId` itself **cannot be modified** — to change the language, the user must delete the record and create a new one.

| Field | Type | Required | Validation |
|:---|:---|:---:|:---|
| `proficiencyLevelId` | `string` (UUID) | No | `@IsOptional`, `@IsUUID` |
| `isNative` | `boolean` | No | `@IsOptional`, `@IsBoolean` |

### Example Request

```json
{
  "proficiencyLevelId": "uuid-advanced",
  "isNative": false
}
```

### Response — `200 OK`

Same shape as the `POST` response, with updated fields.

### Business Rules

1. Partial update — only submitted fields are modified.
2. `languageId` is immutable — attempting to send it results in `400 UNKNOWN_FIELD`.
3. If `proficiencyLevelId` is provided, it must exist.
4. `ProfileService.recalculate(userId)` is called on success.
5. Changing `proficiencyLevelId` increments `matchingVersion` but **does not change** `completionPct` (the record already exists).

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Attempt to send `languageId` or another undeclared field |
| `400` | `INVALID_PROFICIENCY_LEVEL` | `Proficiency level not found` | `proficiencyLevelId` does not exist |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `LANGUAGE_NOT_FOUND` | `Language record not found` | Record does not exist or belongs to another user |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 5. `DELETE /api/v1/profile/languages/:languageId`

### Purpose
Permanently delete a language record. This is a **hard delete** — no soft-delete, no recovery.

### Request

| Property | Value |
|:---|:---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/profile/languages/:languageId` |
| **Auth** | Bearer JWT |
| **Params** | `languageId` — UUID of the language record |
| **Body** | None |

### Response — `204 No Content`

No response body.

### Side Effects

1. The record is removed permanently.
2. `ProfileService.recalculate(userId)` is triggered.
3. If the deleted record was the user's **only** language record, `completionPct` drops by **10 points**. Otherwise, `completionPct` remains unchanged.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `languageId` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `LANGUAGE_NOT_FOUND` | `Language record not found` | Record does not exist or belongs to another user |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 6. `GET /api/v1/reference/languages` [PUBLIC]

### Purpose
Retrieve the list of all languages supported by the system.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/reference/languages` |
| **Auth** | 🌐 Public (`@Public()`) |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Languages retrieved successfully",
  "data": [
    { "id": "uuid-ar", "nameEn": "Arabic",  "nameAr": "العربية",    "isoCode": "ar" },
    { "id": "uuid-en", "nameEn": "English", "nameAr": "الإنجليزية", "isoCode": "en" },
    { "id": "uuid-fr", "nameEn": "French",  "nameAr": "الفرنسية",   "isoCode": "fr" },
    { "id": "uuid-es", "nameEn": "Spanish", "nameAr": "الإسبانية",  "isoCode": "es" }
  ],
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- Not paginated — the list is small and stable (~30 languages).
- Ordered by `sortOrder asc`, falling back to `nameEn asc`.
- Only records with `isActive = true` are returned.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 7. `GET /api/v1/reference/proficiency-levels` [PUBLIC]

### Purpose
Retrieve the list of language proficiency levels (Beginner, Intermediate, Advanced, Fluent, Native).

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/reference/proficiency-levels` |
| **Auth** | 🌐 Public |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Proficiency levels retrieved successfully",
  "data": [
    { "id": "uuid-beginner",     "nameEn": "Beginner",     "nameAr": "مبتدئ",      "sortOrder": 1 },
    { "id": "uuid-intermediate", "nameEn": "Intermediate", "nameAr": "متوسط",      "sortOrder": 2 },
    { "id": "uuid-advanced",     "nameEn": "Advanced",     "nameAr": "متقدم",      "sortOrder": 3 },
    { "id": "uuid-fluent",       "nameEn": "Fluent",       "nameAr": "طليق",       "sortOrder": 4 },
    { "id": "uuid-native",       "nameEn": "Native",       "nameAr": "اللغة الأم", "sortOrder": 5 }
  ],
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- Not paginated — the list is small and fixed (5 levels).
- Ordered by `sortOrder asc` to guarantee a logical ordering from weakest to strongest.
- Only records with `isActive = true` are returned.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## Endpoint Summary

| # | Method | Path | Auth | Params | Pagination |
|:---:|:---:|:---|:---:|:---|:---:|
| 1 | `POST` | `/profile/languages` | 🔒 | — | No |
| 2 | `GET` | `/profile/languages` | 🔒 | — | No |
| 3 | `GET` | `/profile/languages/:languageId` | 🔒 | `languageId` | No |
| 4 | `PATCH` | `/profile/languages/:languageId` | 🔒 | `languageId` | No |
| 5 | `DELETE` | `/profile/languages/:languageId` | 🔒 | `languageId` | No |
| 6 | `GET` | `/reference/languages` | 🌐 | — | No |
| 7 | `GET` | `/reference/proficiency-levels` | 🌐 | — | No |

**Total**: 7 endpoints (5 authenticated, 2 public)

---

## Cross-Endpoint Conventions

### Standard Response Envelope

**Success**:
```json
{
  "statusCode": 201,
  "message": "Human-readable message",
  "data": { },
  "timestamp": "ISO 8601"
}
```

**Error**:
```json
{
  "statusCode": 409,
  "message": "Human-readable message",
  "error": "ErrorKey",
  "timestamp": "ISO 8601"
}
```

### HTTP Status Codes Used in This Batch

| Code | Meaning | Common Triggers |
|:---:|:---|:---|
| `200` | OK | Successful read or update |
| `201` | Created | Successful language record creation |
| `204` | No Content | Successful deletion |
| `400` | Bad Request | Validation failure, invalid FK |
| `401` | Unauthorized | Missing or invalid JWT |
| `404` | Not Found | Resource does not exist or belongs to another user |
| `409` | Conflict | Uniqueness violation or limit exceeded |
| `500` | Internal Server Error | Unexpected server failure |

### Validation

- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- Any field not declared in the DTO triggers `400 UNKNOWN_FIELD`.
- Frontend must be informed of the exact field whitelist per endpoint.

### Recalculation Contract

Every successful mutation on `/profile/languages/*` triggers `ProfileService.recalculate(userId)` **before** the response is returned. The response reflects the freshly computed `completionPct`, `isMatchable`, and `matchingVersion`.

### Swagger Requirements

Every endpoint must document:
- `@ApiTags('Profile — Languages')` or `@ApiTags('Reference')`
- `@ApiOperation` with summary and description
- `@ApiResponse` for `200`/`201`/`204` and each error code
- `@ApiBearerAuth` (except public endpoints, which use `@Public()`)
- `@ApiBody` for endpoints with a request body

---

## Error Codes Summary — Batch 3

| Code | Meaning | Common Triggers |
|:---:|:---|:---|
| `201` | Created | Successful `POST /languages` |
| `200` | OK | Successful `GET` / `PATCH` |
| `204` | No Content | Successful `DELETE` |
| `400` | Bad Request | DTO validation failure, invalid FK |
| `401` | Unauthorized | Missing or invalid JWT |
| `404` | Not Found | Record does not exist or belongs to another user |
| `409` | Conflict | Duplicate language or `MAX_LANGUAGES` exceeded |
| `500` | Internal Server Error | Unexpected server failure |

---

## Endpoint-to-User-Story Map

| Endpoint | User Story | FR Coverage |
|:---|:---|:---|
| `POST /profile/languages` | US3 | FR-019, FR-020, FR-021 |
| `GET /profile/languages` | US3 | FR-019 |
| `GET /profile/languages/:languageId` | US3 | FR-019 |
| `PATCH /profile/languages/:languageId` | US3 | FR-019, FR-020 |
| `DELETE /profile/languages/:languageId` | US3 | FR-019 |
| `GET /reference/languages` | US3 | FR-037, FR-038, FR-039 |
| `GET /reference/proficiency-levels` | US3 | FR-037, FR-038, FR-039 |

---

## Batch 3 Review Gate Criteria

- [ ] Uniqueness enforced on `(userId, languageId)` → `409`
- [ ] `MAX_LANGUAGES` limit enforced → `409`
- [ ] `languageId` is immutable in `PATCH` requests
- [ ] Ownership verified on all `:languageId` endpoints
- [ ] `completionPct` reflects **10%** for the languages section
- [ ] Reference endpoints work without authentication
- [ ] `pnpm build` + `pnpm lint` + `pnpm test` + `pnpm test:e2e` all PASS


---

# Batch 4 — Standardized Tests Section

**Feature**: Profile Module v2 Redesign
**Batch**: 04 — Standardized Tests Section
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/profile/test-results` | 🔒 | Add a standardized test result |
| 2 | `GET` | `/profile/test-results` | 🔒 | List all test results of the authenticated user |
| 3 | `GET` | `/profile/test-results/:id` | 🔒 | Retrieve a single test result |
| 4 | `PATCH` | `/profile/test-results/:id` | 🔒 | Partially update a test result |
| 5 | `DELETE` | `/profile/test-results/:id` | 🔒 | Permanently delete a test result |
| 6 | `GET` | `/reference/standardized-tests` | 🌐 | List all supported standardized tests |

**Total**: 6 endpoints (5 authenticated, 1 public)

**Unblocks**: US5 — Standardized Test Scores

**Completion Weight Impact**: Contributes **7%** to `completionPct` — awarded once when the user has at least one test result.

---

## Domain Rules (Apply to All Endpoints)

### Uniqueness
The composite key `(userId, testId)` is unique. A user cannot register the same test twice. Any attempt to create a duplicate returns `409 Conflict`.

### Record Limit
The number of test results per user is limited by `SystemSettings.max_test_results` (default `10`). Exceeding the limit returns `409 Conflict`.

### Score Validation
Two validations must both pass:

| Validation | Rule |
|:---|:---|
| **Range** | `score >= minScore && score <= maxScore` |
| **Step** | `(score - minScore) % scoreStep === 0` |

**⚠️ Step validation precision**: Integer arithmetic is used to avoid floating-point errors:
```
Math.round((score - minScore) * 100) % Math.round(scoreStep * 100) === 0
```

**Examples:**

| Test | minScore | maxScore | scoreStep | Valid scores | Invalid scores |
|:---|:---:|:---:|:---:|:---|:---|
| IELTS | 0 | 9 | 0.5 | 0, 0.5, 1.0, ..., 9.0 | 7.3 (off-step), 9.5 (out of range) |
| TOEFL | 0 | 120 | 1.0 | 0, 1, 2, ..., 120 | 100.5 |
| GRE | 260 | 340 | 1.0 | 260, 261, ..., 340 | 259 (below min), 350 |
| SAT | 400 | 1600 | 10 | 400, 410, ..., 1600 | 405 (off-step) |

### Ownership
All `/profile/test-results/:id` operations verify ownership. A mismatch returns `404 Not Found` (not `403 Forbidden`).

A new `TestResultOwnershipGuard` enforces this at the route level — before the service is reached.

### Recalculation
Every successful mutation triggers `ProfileService.recalculate(userId)` before the response is returned. The response reflects the freshly computed `completionPct`, `isMatchable`, and `matchingVersion`.

### Immutable Field
`testId` is **immutable** — it cannot be changed via `PATCH`. To use a different test type, the user must delete the record and create a new one.

---

## 1. `POST /api/v1/profile/test-results`

### Purpose
Add a new standardized test result to the authenticated user's profile.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/api/v1/profile/test-results` |
| **Auth** | Bearer JWT |
| **Headers** | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| **Body** | `CreateTestResultDto` |

### Body — `CreateTestResultDto`

| Field | Type | Required | Validation | Description |
|:---|:---|:---:|:---|:---|
| `testId` | `string` (UUID) | Yes | `@IsUUID` | FK to `StandardizedTests` |
| `score` | `number` | Yes | `@IsNumber` | Validated against range and step in the service |
| `testDate` | `string` (ISO date) | No | `@IsOptional`, `@IsDateString` | Date the test was taken |

### Example Request

```json
{
  "testId": "uuid-ielts",
  "score": 7.5,
  "testDate": "2024-01-15"
}
```

### Response — `201 Created`

```json
{
  "statusCode": 201,
  "message": "Test result created successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "testId": "uuid-ielts",
    "test": {
      "id": "uuid-ielts",
      "nameEn": "IELTS",
      "nameAr": "آيلتس",
      "minScore": "0.00",
      "maxScore": "9.00",
      "scoreStep": "0.50"
    },
    "score": "7.50",
    "testDate": "2024-01-15",
    "createdAt": "2026-09-22T10:00:00.000Z",
    "updatedAt": null
  },
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Business Rules

1. `testId` must exist in `StandardizedTests`.
2. `score` must pass both range and step validation.
3. Uniqueness enforced on `(userId, testId)`.
4. `MAX_TEST_RESULTS` enforced from `SystemSettings`.
5. `ProfileService.recalculate(userId)` is called on success.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Extra field sent |
| `400` | `INVALID_TEST` | `Standardized test not found` | `testId` does not exist |
| `400` | `SCORE_OUT_OF_RANGE` | `Score must be between {minScore} and {maxScore}` | Score outside range |
| `400` | `SCORE_NOT_ALIGNED_TO_STEP` | `Score must be aligned to the test's score step of {scoreStep}` | Score off-step |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `409` | `TEST_RESULT_DUPLICATE` | `A result for this test already exists in your profile` | Uniqueness violation |
| `409` | `MAX_TEST_RESULTS_REACHED` | `Maximum number of test results reached` | `MAX_TEST_RESULTS` exceeded |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 2. `GET /api/v1/profile/test-results`

### Purpose
Retrieve all test results belonging to the authenticated user, with embedded test data.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/test-results` |
| **Auth** | Bearer JWT |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Test results retrieved successfully",
  "data": [
    {
      "id": "uuid-1",
      "userId": "uuid",
      "testId": "uuid-ielts",
      "test": {
        "id": "uuid-ielts",
        "nameEn": "IELTS",
        "nameAr": "آيلتس",
        "minScore": "0.00",
        "maxScore": "9.00",
        "scoreStep": "0.50"
      },
      "score": "7.50",
      "testDate": "2024-01-15",
      "createdAt": "2026-09-22T10:00:00.000Z",
      "updatedAt": null
    }
  ],
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- Empty list (`[]`) is returned when no records exist — never `null`.
- Results are ordered by `testDate DESC`, then `createdAt DESC` (most recent first).

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 3. `GET /api/v1/profile/test-results/:id`

### Purpose
Retrieve a single test result by its ID. Ownership is enforced by `TestResultOwnershipGuard`.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/test-results/:id` |
| **Auth** | Bearer JWT + `TestResultOwnershipGuard` |
| **Params** | `id` — UUID of the test result |
| **Body** | None |

### Response — `200 OK`

Same shape as the `POST` response `data` object.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `id` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `TEST_RESULT_NOT_FOUND` | `Test result not found` | Record does not exist **or** belongs to another user |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 4. `PATCH /api/v1/profile/test-results/:id`

### Purpose
Partially update a test result. Only the fields included in the request body are modified.

### Request

| Property | Value |
|:---|:---|
| **Method** | `PATCH` |
| **Path** | `/api/v1/profile/test-results/:id` |
| **Auth** | Bearer JWT + `TestResultOwnershipGuard` |
| **Params** | `id` — UUID of the test result |
| **Body** | `UpdateTestResultDto` |

### Body — `UpdateTestResultDto`

All fields optional. `testId` is **not modifiable** — it is not present in the DTO.

| Field | Type | Required | Validation |
|:---|:---|:---:|:---|
| `score` | `number` | No | `@IsOptional`, `@IsNumber` — re-validated against range and step |
| `testDate` | `string` (ISO date) | No | `@IsOptional`, `@IsDateString` |

### Example Request

```json
{
  "score": 8.0,
  "testDate": "2024-06-20"
}
```

### Response — `200 OK`

Same shape as the `POST` response, with updated fields.

### Business Rules

1. Partial update — only submitted fields are modified.
2. `testId` is immutable — attempting to send it returns `400 UNKNOWN_FIELD`.
3. If `score` is provided → it is re-validated against range and step using the record's existing test.
4. `ProfileService.recalculate(userId)` is called on success.
5. Changing `score` or `testDate` increments `matchingVersion` but **does not change** `completionPct` (the record already exists).

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Attempt to send `testId` or another undeclared field |
| `400` | `SCORE_OUT_OF_RANGE` | `Score must be between {minScore} and {maxScore}` | New score outside range |
| `400` | `SCORE_NOT_ALIGNED_TO_STEP` | `Score must be aligned to the test's score step of {scoreStep}` | New score off-step |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `TEST_RESULT_NOT_FOUND` | `Test result not found` | Record does not exist or belongs to another user |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 5. `DELETE /api/v1/profile/test-results/:id`

### Purpose
Permanently delete a test result. This is a **hard delete** — no soft-delete, no recovery.

### Request

| Property | Value |
|:---|:---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/profile/test-results/:id` |
| **Auth** | Bearer JWT + `TestResultOwnershipGuard` |
| **Params** | `id` — UUID of the test result |
| **Body** | None |

### Response — `204 No Content`

No response body.

### Side Effects

1. The record is removed permanently.
2. `ProfileService.recalculate(userId)` is triggered.
3. If the deleted record was the user's **only** test result, `completionPct` drops by **7 points**. Otherwise, `completionPct` remains unchanged.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `id` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `TEST_RESULT_NOT_FOUND` | `Test result not found` | Record does not exist or belongs to another user |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 6. `GET /api/v1/reference/standardized-tests` [PUBLIC]

### Purpose
Retrieve the list of all supported standardized tests, with their score ranges and steps.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/reference/standardized-tests` |
| **Auth** | 🌐 Public (`@Public()`) |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Standardized tests retrieved successfully",
  "data": [
    {
      "id": "uuid-ielts",
      "nameEn": "IELTS",
      "nameAr": "آيلتس",
      "minScore": "0.00",
      "maxScore": "9.00",
      "scoreStep": "0.50"
    },
    {
      "id": "uuid-toefl",
      "nameEn": "TOEFL iBT",
      "nameAr": "توفل",
      "minScore": "0.00",
      "maxScore": "120.00",
      "scoreStep": "1.00"
    },
    {
      "id": "uuid-gre",
      "nameEn": "GRE",
      "nameAr": "جي آر إي",
      "minScore": "260.00",
      "maxScore": "340.00",
      "scoreStep": "1.00"
    },
    {
      "id": "uuid-sat",
      "nameEn": "SAT",
      "nameAr": "سات",
      "minScore": "400.00",
      "maxScore": "1600.00",
      "scoreStep": "10.00"
    }
  ],
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- Not paginated — the list is small (~10 tests).
- Ordered by `sortOrder asc`, falling back to `nameEn asc`.
- Only records with `isActive = true` are returned.
- Used by the frontend to display available tests and to perform client-side score validation before submission.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## Endpoint Summary — Batch 4

| # | Method | Path | Auth | Params | Pagination |
|:---:|:---:|:---|:---:|:---|:---:|
| 1 | `POST` | `/profile/test-results` | 🔒 | — | No |
| 2 | `GET` | `/profile/test-results` | 🔒 | — | No |
| 3 | `GET` | `/profile/test-results/:id` | 🔒 | `id` | No |
| 4 | `PATCH` | `/profile/test-results/:id` | 🔒 | `id` | No |
| 5 | `DELETE` | `/profile/test-results/:id` | 🔒 | `id` | No |
| 6 | `GET` | `/reference/standardized-tests` | 🌐 | — | No |

**Total**: 6 endpoints (5 authenticated, 1 public)

---

## Cross-Endpoint Conventions

### Standard Response Envelope

**Success**:
```json
{
  "statusCode": 201,
  "message": "Human-readable message",
  "data": { },
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

### HTTP Status Codes Used in This Batch

| Code | Meaning | Common Triggers |
|:---:|:---|:---|
| `200` | OK | Successful read or update |
| `201` | Created | Successful test result creation |
| `204` | No Content | Successful deletion |
| `400` | Bad Request | DTO validation failure, invalid FK, score out of range or off-step |
| `401` | Unauthorized | Missing or invalid JWT |
| `404` | Not Found | Record does not exist or belongs to another user |
| `409` | Conflict | Duplicate `(userId, testId)` or `MAX_TEST_RESULTS` exceeded |
| `500` | Internal Server Error | Unexpected server failure |

### Validation

- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- Any field not declared in the DTO triggers `400 UNKNOWN_FIELD`.
- Frontend must be informed of the exact field whitelist per endpoint.

### Recalculation Contract

Every successful mutation on `/profile/test-results/*` triggers `ProfileService.recalculate(userId)` **before** the response is returned. The response reflects the freshly computed `completionPct`, `isMatchable`, and `matchingVersion`.

### `completionPct` Impact Summary

| Action | `completionPct` Change |
|:---|:---|
| Add the first test result | +7 |
| Add additional test results | 0 (no further increase) |
| Update `score` or `testDate` | 0 |
| Delete a non-only test result | 0 |
| Delete the only test result | −7 |

### Swagger Requirements

Every endpoint must document:
- `@ApiTags('Profile — Test Results')` or `@ApiTags('Reference')`
- `@ApiOperation` with summary and description
- `@ApiResponse` for `200`/`201`/`204` and each error code
- `@ApiBearerAuth` (except public endpoints, which use `@Public()`)
- `@ApiBody` for endpoints with a request body

---

## Error Codes Summary — Batch 4

| Code | Meaning | Common Triggers |
|:---:|:---|:---|
| `201` | Created | Successful `POST /test-results` |
| `200` | OK | Successful `GET` / `PATCH` |
| `204` | No Content | Successful `DELETE` |
| `400` | Bad Request | DTO validation failure, invalid FK, score out of range, score off-step |
| `401` | Unauthorized | Missing or invalid JWT |
| `404` | Not Found | Record does not exist or belongs to another user |
| `409` | Conflict | Duplicate test or `MAX_TEST_RESULTS` exceeded |
| `500` | Internal Server Error | Unexpected server failure |

---

## Endpoint-to-User-Story Map

| Endpoint | User Story | FR Coverage |
|:---|:---|:---|
| `POST /profile/test-results` | US5 | FR-022, FR-023, FR-024, FR-025 |
| `GET /profile/test-results` | US5 | FR-022 |
| `GET /profile/test-results/:id` | US5 | FR-022 |
| `PATCH /profile/test-results/:id` | US5 | FR-022, FR-023 |
| `DELETE /profile/test-results/:id` | US5 | FR-022 |
| `GET /reference/standardized-tests` | US5 | FR-037, FR-038, FR-039 |

---

## Batch 4 Review Gate Criteria

- [ ] Full CRUD works with `testId` as FK (no free-text)
- [ ] **Range validation** works: `score` outside `[minScore, maxScore]` → `400`
- [ ] **Step validation** works: `score` not a multiple of `scoreStep` → `400`
- [ ] **Integer arithmetic** used to avoid floating-point errors
- [ ] Duplicate `(userId, testId)` rejected (`409`)
- [ ] `MAX_TEST_RESULTS` enforced (`409`)
- [ ] `TestResultOwnershipGuard` applied on all `:id` endpoints
- [ ] `completionPct` reflects **7%** for the tests section
- [ ] Reference endpoint works without authentication
- [ ] `pnpm build` + `pnpm lint` + `pnpm test` + `pnpm test:e2e` all PASS

---

# Batch 5 — Special Statuses & Target Preferences

**Feature**: Profile Module v2 Redesign
**Batch**: 05 — Special Statuses & Target Preferences
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/profile/special-statuses` | 🔒 | Add a special status to the user's profile |
| 2 | `GET` | `/profile/special-statuses` | 🔒 | List all special statuses of the authenticated user |
| 3 | `DELETE` | `/profile/special-statuses/:specialStatusId` | 🔒 | Remove a special status |
| 4 | `GET` | `/profile/preferences` | 🔒 | Retrieve all target preferences in a unified response |
| 5 | `POST` | `/profile/preferences/degrees` | 🔒 | Add a target degree |
| 6 | `DELETE` | `/profile/preferences/degrees/:educationLevelId` | 🔒 | Remove a target degree |
| 7 | `POST` | `/profile/preferences/majors` | 🔒 | Add a target major |
| 8 | `DELETE` | `/profile/preferences/majors/:majorId` | 🔒 | Remove a target major |
| 9 | `POST` | `/profile/preferences/institutions` | 🔒 | Add a target institution |
| 10 | `DELETE` | `/profile/preferences/institutions/:institutionId` | 🔒 | Remove a target institution |
| 11 | `GET` | `/reference/special-statuses` | 🌐 | List all supported special statuses |

**Total**: 11 endpoints (10 authenticated, 1 public)

**Unblocks**: US6 (Special Statuses), US7 (Target Preferences), US8 (Matchability — finalized)

**Completion Weight Impact**: Contributes **15%** to `completionPct`, distributed across four relations:

| Relation | Weight |
|:---|:---:|
| `UserTargetMajors` (target majors) | 5% |
| `UserTargetDegrees` (target degrees) | 4% |
| `UserTargetInstitutions` (target institutions) | 3% |
| `UserSpecialStatuses` (special statuses) | 3% |
| **Total** | **15%** |

---

## Domain Rules (Apply to All Endpoints)

### Idempotency
All `POST` operations in this batch are **idempotent**. Adding the same value twice returns `200 OK` and does not create a duplicate record. No `409` is returned for repeated adds.

**Rationale**: The user may double-click, or the frontend may retry — the system must be tolerant.

### Record Limits
Each relation has its own independent limit in `SystemSettings`:

| Relation | Key | Default |
|:---|:---|:---:|
| `UserTargetDegrees` | `max_target_degrees` | 5 |
| `UserTargetMajors` | `max_target_majors` | 10 |
| `UserTargetInstitutions` | `max_target_institutions` | 10 |
| `UserSpecialStatuses` | — | no fixed limit |

Exceeding a limit returns `409 Conflict` (only on a **new** add — not on idempotent re-adds).

### Composite Primary Keys
All four relations use composite primary keys — there is no independent `id` field:

| Table | Primary Key |
|:---|:---|
| `UserSpecialStatuses` | `(userId, specialStatusId)` |
| `UserTargetDegrees` | `(userId, educationLevelId)` |
| `UserTargetMajors` | `(userId, majorId)` |
| `UserTargetInstitutions` | `(userId, institutionId)` |

### Ownership
- `SpecialStatusOwnershipGuard` — verifies that the `specialStatusId` is linked to the authenticated user before allowing deletion.
- `PreferenceOwnershipGuard` — verifies that the resource being removed belongs to the authenticated user.
- A mismatch returns `404 Not Found` (not `403`) to prevent enumeration.

### Recalculation
Every successful mutation triggers `ProfileService.recalculate(userId)` before the response is returned. The response reflects the freshly computed `completionPct`, `isMatchable`, and `matchingVersion`.

### Difference from Previous Batches
Batches 2, 3, and 4 operate on records with a surrogate `id`. This batch operates on **many-to-many relations** with composite primary keys only — using `add` / `remove` semantics rather than `create` / `update` / `delete`.

---

## 1. `POST /api/v1/profile/special-statuses`

### Purpose
Add a special status to the authenticated user's profile. Idempotent.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/api/v1/profile/special-statuses` |
| **Auth** | Bearer JWT |
| **Headers** | `Authorization: Bearer <token>`, `Content-Type: application/json` |
| **Body** | `CreateSpecialStatusDto` |

### Body — `CreateSpecialStatusDto`

| Field | Type | Required | Validation |
|:---|:---|:---:|:---|
| `specialStatusId` | `string` (UUID) | Yes | `@IsUUID` |

### Example Request

```json
{
  "specialStatusId": "uuid-refugee"
}
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Special status added successfully",
  "data": {
    "userId": "uuid",
    "specialStatusId": "uuid-refugee",
    "specialStatus": {
      "id": "uuid-refugee",
      "nameEn": "Refugee",
      "nameAr": "لاجئ"
    }
  },
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Business Rules

1. `specialStatusId` must exist in `SpecialStatuses`.
2. Idempotent — re-adding an existing status returns `200` with no error and no duplicate.
3. `ProfileService.recalculate(userId)` is called on success.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Extra field sent |
| `400` | `INVALID_SPECIAL_STATUS` | `Special status not found` | `specialStatusId` does not exist |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 2. `GET /api/v1/profile/special-statuses`

### Purpose
Retrieve all special statuses belonging to the authenticated user.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/special-statuses` |
| **Auth** | Bearer JWT |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Special statuses retrieved successfully",
  "data": [
    {
      "userId": "uuid",
      "specialStatusId": "uuid-refugee",
      "specialStatus": {
        "id": "uuid-refugee",
        "nameEn": "Refugee",
        "nameAr": "لاجئ"
      }
    },
    {
      "userId": "uuid",
      "specialStatusId": "uuid-orphan",
      "specialStatus": {
        "id": "uuid-orphan",
        "nameEn": "Orphan",
        "nameAr": "يتيم"
      }
    }
  ],
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- Empty list (`[]`) is returned when no records exist — never `null`.
- No specific ordering is required; the frontend may sort by name if needed.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 3. `DELETE /api/v1/profile/special-statuses/:specialStatusId`

### Purpose
Remove a special status from the authenticated user's profile. Hard delete.

### Request

| Property | Value |
|:---|:---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/profile/special-statuses/:specialStatusId` |
| **Auth** | Bearer JWT + `SpecialStatusOwnershipGuard` |
| **Params** | `specialStatusId` — UUID |
| **Body** | None |

### Response — `204 No Content`

No response body.

### Side Effects

1. The pivot record is removed permanently.
2. `ProfileService.recalculate(userId)` is triggered.
3. If the removed status was the user's **only** special status, `completionPct` drops by **3 points**.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `specialStatusId` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `SPECIAL_STATUS_NOT_FOUND` | `Special status not found in your profile` | Record does not exist |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 4. `GET /api/v1/profile/preferences`

### Purpose
Retrieve all target preferences for the authenticated user in a single unified response: target degrees, target majors, and target institutions.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/preferences` |
| **Auth** | Bearer JWT |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Preferences retrieved successfully",
  "data": {
    "targetDegrees": [
      {
        "userId": "uuid",
        "educationLevelId": "uuid-master",
        "educationLevel": {
          "id": "uuid-master",
          "code": "master",
          "nameEn": "Master's Degree",
          "nameAr": "ماجستير"
        }
      }
    ],
    "targetMajors": [
      {
        "userId": "uuid",
        "majorId": "uuid-cs",
        "major": {
          "id": "uuid-cs",
          "nameEn": "Computer Science",
          "nameAr": "علوم الحاسب"
        }
      },
      {
        "userId": "uuid",
        "majorId": "uuid-ai",
        "major": {
          "id": "uuid-ai",
          "nameEn": "Artificial Intelligence",
          "nameAr": "الذكاء الاصطناعي"
        }
      }
    ],
    "targetInstitutions": [
      {
        "userId": "uuid",
        "institutionId": "uuid-mit",
        "institution": {
          "id": "uuid-mit",
          "nameEn": "MIT",
          "nameAr": "معهد ماساتشوستس"
        }
      }
    ]
  },
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- A single response contains all three preference groups — the frontend makes one request instead of three.
- Each array is empty (`[]`) if no preferences of that type exist.
- No `meta` object — the response is small.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 5. `POST /api/v1/profile/preferences/degrees`

### Purpose
Add a target degree. Idempotent.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/api/v1/profile/preferences/degrees` |
| **Auth** | Bearer JWT |
| **Body** | `AddDegreeDto` |

### Body — `AddDegreeDto`

| Field | Type | Required | Validation |
|:---|:---|:---:|:---|
| `educationLevelId` | `string` (UUID) | Yes | `@IsUUID` |

### Example Request

```json
{
  "educationLevelId": "uuid-master"
}
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Target degree added successfully",
  "data": {
    "userId": "uuid",
    "educationLevelId": "uuid-master",
    "educationLevel": {
      "id": "uuid-master",
      "code": "master",
      "nameEn": "Master's Degree",
      "nameAr": "ماجستير"
    }
  },
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Business Rules

1. `educationLevelId` must exist in `EducationLevel`.
2. Idempotent — re-adding returns `200` with no error and no duplicate.
3. `MAX_TARGET_DEGREES` enforced from `SystemSettings` (default `5`).
4. `ProfileService.recalculate(userId)` is called on success.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Extra field sent |
| `400` | `INVALID_EDUCATION_LEVEL` | `Education level not found` | FK does not exist |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `409` | `MAX_TARGET_DEGREES_REACHED` | `Maximum number of target degrees reached` | Limit exceeded |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 6. `DELETE /api/v1/profile/preferences/degrees/:educationLevelId`

### Purpose
Remove a target degree. Hard delete.

### Request

| Property | Value |
|:---|:---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/profile/preferences/degrees/:educationLevelId` |
| **Auth** | Bearer JWT + `PreferenceOwnershipGuard` |
| **Params** | `educationLevelId` — UUID |
| **Body** | None |

### Response — `204 No Content`

### Side Effects

1. The pivot record is removed permanently.
2. `ProfileService.recalculate(userId)` is triggered.
3. If the removed degree was the user's **only** target degree, `completionPct` drops by **4 points**.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `educationLevelId` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `TARGET_DEGREE_NOT_FOUND` | `Target degree not found in your preferences` | Record does not exist |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 7. `POST /api/v1/profile/preferences/majors`

### Purpose
Add a target major. Idempotent.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/api/v1/profile/preferences/majors` |
| **Auth** | Bearer JWT |
| **Body** | `AddMajorDto` |

### Body — `AddMajorDto`

| Field | Type | Required | Validation |
|:---|:---|:---:|:---|
| `majorId` | `string` (UUID) | Yes | `@IsUUID` |

### Example Request

```json
{
  "majorId": "uuid-cs"
}
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Target major added successfully",
  "data": {
    "userId": "uuid",
    "majorId": "uuid-cs",
    "major": {
      "id": "uuid-cs",
      "nameEn": "Computer Science",
      "nameAr": "علوم الحاسب"
    }
  },
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Business Rules

1. `majorId` must exist in `Majors`.
2. Idempotent.
3. `MAX_TARGET_MAJORS` enforced from `SystemSettings` (default `10`).
4. `ProfileService.recalculate(userId)` is called on success.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `INVALID_MAJOR` | `Major not found` | FK does not exist |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `409` | `MAX_TARGET_MAJORS_REACHED` | `Maximum number of target majors reached` | Limit exceeded |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 8. `DELETE /api/v1/profile/preferences/majors/:majorId`

### Purpose
Remove a target major. Hard delete.

### Request

| Property | Value |
|:---|:---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/profile/preferences/majors/:majorId` |
| **Auth** | Bearer JWT + `PreferenceOwnershipGuard` |
| **Params** | `majorId` — UUID |
| **Body** | None |

### Response — `204 No Content`

### Side Effects

1. The pivot record is removed permanently.
2. `ProfileService.recalculate(userId)` is triggered.
3. If the removed major was the user's **only** target major, `completionPct` drops by **5 points**.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `majorId` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `TARGET_MAJOR_NOT_FOUND` | `Target major not found in your preferences` | Record does not exist |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 9. `POST /api/v1/profile/preferences/institutions`

### Purpose
Add a target institution. Idempotent.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/api/v1/profile/preferences/institutions` |
| **Auth** | Bearer JWT |
| **Body** | `AddInstitutionDto` |

### Body — `AddInstitutionDto`

| Field | Type | Required | Validation |
|:---|:---|:---:|:---|
| `institutionId` | `string` (UUID) | Yes | `@IsUUID` |

### Example Request

```json
{
  "institutionId": "uuid-mit"
}
```

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Target institution added successfully",
  "data": {
    "userId": "uuid",
    "institutionId": "uuid-mit",
    "institution": {
      "id": "uuid-mit",
      "nameEn": "MIT",
      "nameAr": "معهد ماساتشوستس"
    }
  },
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Business Rules

1. `institutionId` must exist in `Institutions`.
2. Idempotent.
3. `MAX_TARGET_INSTITUTIONS` enforced from `SystemSettings` (default `10`).
4. `ProfileService.recalculate(userId)` is called on success.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `INVALID_INSTITUTION` | `Institution not found` | FK does not exist |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `409` | `MAX_TARGET_INSTITUTIONS_REACHED` | `Maximum number of target institutions reached` | Limit exceeded |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 10. `DELETE /api/v1/profile/preferences/institutions/:institutionId`

### Purpose
Remove a target institution. Hard delete.

### Request

| Property | Value |
|:---|:---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/profile/preferences/institutions/:institutionId` |
| **Auth** | Bearer JWT + `PreferenceOwnershipGuard` |
| **Params** | `institutionId` — UUID |
| **Body** | None |

### Response — `204 No Content`

### Side Effects

1. The pivot record is removed permanently.
2. `ProfileService.recalculate(userId)` is triggered.
3. If the removed institution was the user's **only** target institution, `completionPct` drops by **3 points**.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `institutionId` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `TARGET_INSTITUTION_NOT_FOUND` | `Target institution not found in your preferences` | Record does not exist |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 11. `GET /api/v1/reference/special-statuses` [PUBLIC]

### Purpose
Retrieve the list of all supported special statuses.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/reference/special-statuses` |
| **Auth** | 🌐 Public (`@Public()`) |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Special statuses retrieved successfully",
  "data": [
    { "id": "uuid-1", "nameEn": "Refugee",                 "nameAr": "لاجئ" },
    { "id": "uuid-2", "nameEn": "Orphan",                  "nameAr": "يتيم" },
    { "id": "uuid-3", "nameEn": "Person with Disability",  "nameAr": "ذوي الاحتياجات الخاصة" },
    { "id": "uuid-4", "nameEn": "First-Generation Student","nameAr": "طالب الجيل الأول" }
  ],
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- Not paginated — the list is small (~10 statuses).
- Ordered by `sortOrder asc`, falling back to `nameEn asc`.
- Only records with `isActive = true` are returned.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## Endpoint Summary — Batch 5

| # | Method | Path | Auth | Params | Idempotent |
|:---:|:---:|:---|:---:|:---|:---:|
| 1 | `POST` | `/profile/special-statuses` | 🔒 | — | ✅ |
| 2 | `GET` | `/profile/special-statuses` | 🔒 | — | — |
| 3 | `DELETE` | `/profile/special-statuses/:specialStatusId` | 🔒 | `specialStatusId` | — |
| 4 | `GET` | `/profile/preferences` | 🔒 | — | — |
| 5 | `POST` | `/profile/preferences/degrees` | 🔒 | — | ✅ |
| 6 | `DELETE` | `/profile/preferences/degrees/:educationLevelId` | 🔒 | `educationLevelId` | — |
| 7 | `POST` | `/profile/preferences/majors` | 🔒 | — | ✅ |
| 8 | `DELETE` | `/profile/preferences/majors/:majorId` | 🔒 | `majorId` | — |
| 9 | `POST` | `/profile/preferences/institutions` | 🔒 | — | ✅ |
| 10 | `DELETE` | `/profile/preferences/institutions/:institutionId` | 🔒 | `institutionId` | — |
| 11 | `GET` | `/reference/special-statuses` | 🌐 | — | — |

**Total**: 11 endpoints (10 authenticated, 1 public)

---

## Cross-Endpoint Conventions

### Standard Response Envelope

**Success**:
```json
{
  "statusCode": 200,
  "message": "Human-readable message",
  "data": { },
  "timestamp": "ISO 8601"
}
```

**Error**:
```json
{
  "statusCode": 409,
  "message": "Human-readable message",
  "error": "ErrorKey",
  "timestamp": "ISO 8601"
}
```

### HTTP Status Codes Used in This Batch

| Code | Meaning | Common Triggers |
|:---:|:---|:---|
| `200` | OK | Successful `POST` (idempotent) and `GET` |
| `204` | No Content | Successful `DELETE` |
| `400` | Bad Request | DTO validation failure, invalid FK |
| `401` | Unauthorized | Missing or invalid JWT |
| `404` | Not Found | Resource does not exist or belongs to another user |
| `409` | Conflict | `MAX_*` limit exceeded (not for duplicates) |
| `500` | Internal Server Error | Unexpected server failure |

### Validation

- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- Any field not declared in the DTO triggers `400 UNKNOWN_FIELD`.
- Frontend must be informed of the exact field whitelist per endpoint.

### Recalculation Contract

Every successful mutation on this batch's endpoints triggers `ProfileService.recalculate(userId)` **before** the response is returned. The response reflects the freshly computed `completionPct`, `isMatchable`, and `matchingVersion`.

### Swagger Requirements

Every endpoint must document:
- `@ApiTags('Profile — Special Statuses')`, `@ApiTags('Profile — Preferences')`, or `@ApiTags('Reference')`
- `@ApiOperation` with summary and description
- `@ApiResponse` for `200`/`204` and each error code
- `@ApiBearerAuth` (except public endpoints, which use `@Public()`)
- `@ApiBody` for endpoints with a request body

---

## Error Codes Summary — Batch 5

| Code | Meaning | Common Triggers |
|:---:|:---|:---|
| `200` | OK | Successful idempotent `POST` and `GET` |
| `204` | No Content | Successful `DELETE` |
| `400` | Bad Request | DTO validation failure, invalid FK |
| `401` | Unauthorized | Missing or invalid JWT |
| `404` | Not Found | Resource does not exist or belongs to another user |
| `409` | Conflict | `MAX_*` limit exceeded |
| `500` | Internal Server Error | Unexpected server failure |

---

## Endpoint-to-User-Story Map

| Endpoint | User Story | FR Coverage |
|:---|:---|:---|
| `POST /profile/special-statuses` | US6 | FR-026, FR-027 |
| `GET /profile/special-statuses` | US6 | FR-026 |
| `DELETE /profile/special-statuses/:specialStatusId` | US6 | FR-026, FR-027 |
| `GET /profile/preferences` | US7 | FR-028, FR-029, FR-030 |
| `POST /profile/preferences/degrees` | US7 | FR-028, FR-031, FR-032 |
| `DELETE /profile/preferences/degrees/:educationLevelId` | US7 | FR-028, FR-032 |
| `POST /profile/preferences/majors` | US7 | FR-029, FR-031, FR-032 |
| `DELETE /profile/preferences/majors/:majorId` | US7 | FR-029, FR-032 |
| `POST /profile/preferences/institutions` | US7 | FR-030, FR-031, FR-032 |
| `DELETE /profile/preferences/institutions/:institutionId` | US7 | FR-030, FR-032 |
| `GET /reference/special-statuses` | US6 | FR-037, FR-038, FR-039 |

---

## Batch 5 Review Gate Criteria

- [ ] Idempotency works across all `POST` operations (no duplicates, no errors on re-add)
- [ ] `MAX_*` enforced per relation (`409` on limit exceeded)
- [ ] `GET /profile/preferences` returns the unified `{ targetDegrees, targetMajors, targetInstitutions }` object
- [ ] `SpecialStatusOwnershipGuard` and `PreferenceOwnershipGuard` applied
- [ ] `ProfileService.recalculate()` invoked after every write operation
- [ ] `completionPct = 100` becomes reachable when all six groups are filled
- [ ] `GET /profile/me` returns non-empty sub-arrays after data is added
- [ ] Reference endpoint works without authentication
- [ ] `pnpm build` + `pnpm lint` + `pnpm test` + `pnpm test:e2e` all PASS

---

# Batch 6 — Documents Section

**Feature**: Profile Module v2 Redesign
**Batch**: 06 — Documents Section
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Response Envelope**: `{ statusCode, message, data?, meta?, error?, timestamp }`

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/profile/documents` | 🔒 | Upload a new document |
| 2 | `GET` | `/profile/documents` | 🔒 | List all documents of the authenticated user |
| 3 | `GET` | `/profile/documents/:id/download` | 🔒 | Generate a signed download URL |
| 4 | `DELETE` | `/profile/documents/:id` | 🔒 | Permanently delete a document (storage-first) |
| 5 | `GET` | `/reference/document-types` | 🌐 | List all supported document types |

**Total**: 5 endpoints (4 authenticated, 1 public)

**Unblocks**: US4 — Document Upload & Deletion

**Completion Weight Impact**: Contributes **0%** to `completionPct`. Documents are entirely excluded from the matching and completion engine.

**This is the final batch**. Upon successful completion, all eight profile sections are fully implemented.

---

## Domain Rules (Apply to All Endpoints)

### No Recalculation
Documents do not participate in the `completionPct` calculation (weight = 0%). As a result, `ProfileService.recalculate(userId)` is **NOT** called after upload or delete operations. The `matchingVersion` is **not** incremented by document mutations — there is no change to the matching state.

### Content Inspection (Dual Validation)
The user declares a `documentTypeId` when uploading, but the system does **not** trust this declaration alone. The backend inspects the actual file content and verifies that it matches the declared type.

**Flow:**
```
1. User uploads a file and specifies documentTypeId
2. Backend receives the file
3. Backend inspects the file content (MIME sniffing + content analysis)
4. Backend verifies: does the actual type match documentTypeId?
5. If no → reject with 400 DOCUMENT_TYPE_MISMATCH
6. If yes → proceed with storage
```

**Examples:**
- A file declared as `Passport Copy` but is actually a plain text PDF → rejected.
- A file declared as `Academic Transcript` but is actually a personal photo → rejected.
- A file declared as `CV` and is actually a CV (PDF/DOCX) → accepted.

**Implementation note:** The actual content inspection relies on a parsing library (e.g., `file-type`, `pdf-parse`) or a cloud provider service. The exact approach is finalized during implementation.

### Record Limit
The number of documents per user is limited by `SystemSettings.documents.max_documents` (default **10**). Exceeding the limit returns `409 Conflict`.

### Storage-First Deletion
The order of operations on delete is mandatory:

```
1. Delete the file from StorageService
2. On success → delete the DB record
3. On failure → keep the DB record + return 500
```

**Rationale:** If the DB record is deleted first and storage deletion fails, the file becomes an orphan with no reference and no recovery path. Storage-first guarantees consistency.

### Hard Delete
No soft-delete. No `deletedAt` column. The file and record are permanently removed.

### File Constraints (from `SystemSettings`)
| Constraint | Key | Default |
|:---|:---|:---|
| Max file size | `documents.max_size_bytes` | 10 MB (10485760 bytes) |
| Allowed MIME types | `documents.allowed_mime_types` | `["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]` |
| Max documents | `documents.max_documents` | 10 |

### Ownership
`DocumentOwnershipGuard` applies to all `:id` endpoints. A mismatch returns `404 Not Found` (not `403`).

### Signed URL
Valid for **15 minutes** (900 seconds). Generated on demand, never stored.

---

## 1. `POST /api/v1/profile/documents`

### Purpose
Upload a new document. The backend verifies size, MIME type, document type existence, document count limit, and content matching before storing.

### Request

| Property | Value |
|:---|:---|
| **Method** | `POST` |
| **Path** | `/api/v1/profile/documents` |
| **Auth** | Bearer JWT |
| **Headers** | `Authorization: Bearer <token>`, `Content-Type: multipart/form-data` |
| **Body** | `multipart/form-data` |

### Body — `multipart/form-data`

| Field | Type | Required | Description |
|:---|:---|:---:|:---|
| `file` | File | Yes | The file binary |
| `documentTypeId` | `string` (UUID) | Yes | Declared document type (verified against content) |

### Validation Sequence

```
1. File is present?
2. File size ≤ max_size_bytes?
3. MIME type ∈ allowed_mime_types?
4. documentTypeId exists in DocumentTypes?
5. User's current document count < max_documents?
6. Content inspection: does the actual content match documentTypeId?
7. Store file in StorageService
8. Create DB record
```

### Example Request

```bash
curl -X POST /api/v1/profile/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./transcript.pdf;type=application/pdf" \
  -F "documentTypeId=uuid-transcript"
```

### Response — `201 Created`

```json
{
  "statusCode": 201,
  "message": "Document uploaded successfully",
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "documentTypeId": "uuid-transcript",
    "documentType": {
      "id": "uuid-transcript",
      "nameEn": "Academic Transcript",
      "nameAr": "كشف الدرجات"
    },
    "displayName": "transcript.pdf",
    "storagePath": "users/uuid/documents/abc123.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 204800,
    "createdAt": "2026-09-22T10:00:00.000Z",
    "updatedAt": null
  },
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Business Rules

1. `file` is mandatory.
2. `documentTypeId` must exist in `DocumentTypes`.
3. File size must not exceed `documents.max_size_bytes`.
4. MIME type must be in `documents.allowed_mime_types`.
5. `MAX_DOCUMENTS` limit enforced (default `10`).
6. **Content inspection** — actual file content must match the declared `documentTypeId`.
7. **No `recalculate()` call** — documents do not affect `completionPct` or `matchingVersion`.
8. **Upload compensation** — if storage upload succeeds but database record creation
   fails, immediately attempt to delete the uploaded file, then return an error.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Extra field sent |
| `400` | `FILE_MISSING` | `File is required` | No file provided |
| `400` | `INVALID_DOCUMENT_TYPE` | `Document type not found` | `documentTypeId` does not exist |
| `400` | `FILE_TOO_LARGE` | `File size exceeds the maximum allowed size of {maxSize} bytes` | Size exceeds limit |
| `400` | `INVALID_MIME_TYPE` | `File type '{mimeType}' is not allowed` | Disallowed MIME type |
| `400` | `DOCUMENT_TYPE_MISMATCH` | `The uploaded file content does not match the declared document type` | Content inspection failed |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `409` | `MAX_DOCUMENTS_REACHED` | `Maximum number of documents reached` | Limit exceeded |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Storage or DB failure |

---

## 2. `GET /api/v1/profile/documents`

### Purpose
Retrieve all documents belonging to the authenticated user (metadata only — no file content).

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/documents` |
| **Auth** | Bearer JWT |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Documents retrieved successfully",
  "data": [
    {
      "id": "uuid-1",
      "userId": "uuid",
      "documentTypeId": "uuid-transcript",
      "documentType": {
        "id": "uuid-transcript",
        "nameEn": "Academic Transcript",
        "nameAr": "كشف الدرجات"
      },
      "displayName": "transcript.pdf",
      "storagePath": "users/uuid/documents/abc123.pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 204800,
      "createdAt": "2026-09-22T10:00:00.000Z",
      "updatedAt": null
    }
  ],
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- Empty list (`[]`) returned when no documents exist.
- Ordered by `createdAt DESC` (most recent first).
- File binary content is not returned — only metadata.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 3. `GET /api/v1/profile/documents/:id/download`

### Purpose
Generate a signed, time-limited download URL for a document.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/profile/documents/:id/download` |
| **Auth** | Bearer JWT + `DocumentOwnershipGuard` |
| **Params** | `id` — UUID of the document |
| **Body** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Signed download URL generated successfully",
  "data": {
    "signedUrl": "https://storage.example.com/users/uuid/documents/abc123.pdf?token=xyz&expires=1700000900",
    "expiresIn": 900
  },
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- The URL is valid for **15 minutes**.
- The URL is temporary — regenerated on every request.
- The URL is never stored in the database.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `id` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `DOCUMENT_NOT_FOUND` | `Document not found` | Record does not exist or belongs to another user |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Storage provider failure |

---

## 4. `DELETE /api/v1/profile/documents/:id`

### Purpose
Permanently delete a document using storage-first deletion.

### Request

| Property | Value |
|:---|:---|
| **Method** | `DELETE` |
| **Path** | `/api/v1/profile/documents/:id` |
| **Auth** | Bearer JWT + `DocumentOwnershipGuard` |
| **Params** | `id` — UUID of the document |
| **Body** | None |

### Response — `204 No Content`

No response body.

### Deletion Sequence

```
1. Find the DB record (404 if missing or wrong owner)
2. Call StorageService.delete(storagePath)
3. If storage fails → return 500 STORAGE_DELETE_FAILED, DB record unchanged
4. If storage succeeds → delete the DB record
5. Return 204 No Content
```

### Side Effects

1. The file is removed from storage.
2. The DB record is removed.
3. **No `recalculate()` call** — `completionPct` and `matchingVersion` are unaffected.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | `id` is not a valid UUID |
| `401` | `UNAUTHORIZED` | `Unauthorized` | Missing or invalid JWT |
| `404` | `DOCUMENT_NOT_FOUND` | `Document not found` | Record does not exist or belongs to another user |
| `500` | `STORAGE_DELETE_FAILED` | `Failed to delete file from storage` | Storage failure — DB record preserved |
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## 5. `GET /api/v1/reference/document-types` [PUBLIC]

### Purpose
Retrieve the list of all supported document types.

### Request

| Property | Value |
|:---|:---|
| **Method** | `GET` |
| **Path** | `/api/v1/reference/document-types` |
| **Auth** | 🌐 Public (`@Public()`) |
| **Query Params** | None |

### Response — `200 OK`

```json
{
  "statusCode": 200,
  "message": "Document types retrieved successfully",
  "data": [
    { "id": "uuid-1", "nameEn": "Academic Transcript",   "nameAr": "كشف الدرجات" },
    { "id": "uuid-2", "nameEn": "Passport Copy",         "nameAr": "نسخة من جواز السفر" },
    { "id": "uuid-3", "nameEn": "Recommendation Letter", "nameAr": "خطاب توصية" },
    { "id": "uuid-4", "nameEn": "CV",                    "nameAr": "السيرة الذاتية" }
  ],
  "timestamp": "2026-09-22T10:00:00.000Z"
}
```

### Notes
- Not paginated — the list is small (~10 types).
- Ordered by `sortOrder asc`, falling back to `nameEn asc`.
- Only records with `isActive = true` are returned.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `500` | `INTERNAL_ERROR` | `Internal server error` | Unexpected server failure |

---

## Endpoint Summary — Batch 6

| # | Method | Path | Auth | Params | Content-Type |
|:---:|:---:|:---|:---:|:---|:---:|
| 1 | `POST` | `/profile/documents` | 🔒 | — | `multipart/form-data` |
| 2 | `GET` | `/profile/documents` | 🔒 | — | — |
| 3 | `GET` | `/profile/documents/:id/download` | 🔒 | `id` | — |
| 4 | `DELETE` | `/profile/documents/:id` | 🔒 | `id` | — |
| 5 | `GET` | `/reference/document-types` | 🌐 | — | — |

**Total**: 5 endpoints (4 authenticated, 1 public)

---

## Cross-Endpoint Conventions

### Standard Response Envelope

**Success**:
```json
{
  "statusCode": 201,
  "message": "Human-readable message",
  "data": { },
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

### HTTP Status Codes Used in This Batch

| Code | Meaning | Common Triggers |
|:---:|:---|:---|
| `200` | OK | Successful read |
| `201` | Created | Successful document upload |
| `204` | No Content | Successful deletion |
| `400` | Bad Request | Validation failure, size/MIME/type mismatch |
| `401` | Unauthorized | Missing or invalid JWT |
| `404` | Not Found | Resource does not exist or belongs to another user |
| `409` | Conflict | `MAX_DOCUMENTS` exceeded |
| `500` | Internal Server Error | Storage failure or unexpected error |

### Validation

- Global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- Any field not declared in the DTO triggers `400 UNKNOWN_FIELD`.
- Frontend must be informed of the exact field whitelist per endpoint.

### No Recalculation Contract

Unlike Batches 1–5, this batch does **not** trigger `ProfileService.recalculate(userId)`. Documents are excluded from the completion and matching engine. The `matchingVersion` is **not** incremented by document mutations.

### Swagger Requirements

Every endpoint must document:
- `@ApiTags('Profile — Documents')` or `@ApiTags('Reference')`
- `@ApiOperation` with summary and description
- `@ApiResponse` for `200`/`201`/`204` and each error code
- `@ApiBearerAuth` (except public endpoints, which use `@Public()`)
- `@ApiConsumes('multipart/form-data')` for the upload endpoint
- `@ApiBody` for endpoints with a request body

---

## Error Codes Summary — Batch 6

| Code | Meaning | Common Triggers |
|:---:|:---|:---|
| `201` | Created | Successful `POST /documents` |
| `200` | OK | Successful `GET` |
| `204` | No Content | Successful `DELETE` |
| `400` | Bad Request | Size, MIME, document type, or content mismatch |
| `401` | Unauthorized | Missing or invalid JWT |
| `404` | Not Found | Resource does not exist or belongs to another user |
| `409` | Conflict | `MAX_DOCUMENTS` exceeded |
| `500` | Internal Server Error | Storage failure or unexpected error |

---

## Endpoint-to-User-Story Map

| Endpoint | User Story | FR Coverage |
|:---|:---|:---|
| `POST /profile/documents` | US4 | FR-033, FR-033b |
| `GET /profile/documents` | US4 | FR-033 |
| `GET /profile/documents/:id/download` | US4 | FR-036 |
| `DELETE /profile/documents/:id` | US4 | FR-034, FR-035 |
| `GET /reference/document-types` | US4 | FR-037, FR-038, FR-039 |

---

## Batch 6 Review Gate Criteria

- [ ] Upload works with `multipart/form-data`
- [ ] **Size validation** works (`400 FILE_TOO_LARGE`)
- [ ] **MIME validation** works (`400 INVALID_MIME_TYPE`)
- [ ] **Declared document type validation** works (`400 INVALID_DOCUMENT_TYPE`)
- [ ] **Content inspection** works (`400 DOCUMENT_TYPE_MISMATCH` when actual content differs from declared type)
- [ ] **Max documents limit** enforced (`409 MAX_DOCUMENTS_REACHED` at 10)
- [ ] **Storage-first deletion** works (success → DB deleted; failure → 500 + DB preserved)
- [ ] **Hard delete** — no soft-delete
- [ ] **Signed URL** generation works correctly (15-minute validity)
- [ ] `DocumentOwnershipGuard` applied on all `:id` endpoints
- [ ] **No `recalculate()` call** in `upload()` or `delete()`
- [ ] `completionPct` and `matchingVersion` unaffected by documents
- [ ] Reference endpoint works without authentication
- [ ] `pnpm build` + `pnpm lint` + `pnpm test` + `pnpm test:e2e` all PASS
