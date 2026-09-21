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
6. **No manual override** — `completionPct`, `isMatchable`, and `matchingVersion` are ignored if sent.

### Error Responses

| Code | Error Key | Message | Trigger |
|:---:|:---|:---|:---|
| `400` | `VALIDATION_ERROR` | `Validation failed` | DTO validation failure |
| `400` | `UNKNOWN_FIELD` | `Property '<field>' should not exist` | Extra field sent |
| `400` | `BIO_TOO_LONG` | `Bio exceeds maximum length of {max} characters` | `bio` length > `max_bio_length` |
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
## Endpoint-to-User-Story Map (Batch 1)

| Endpoint | User Story | FR Coverage |
|:---|:---|:---|
| `GET /profile/me` | US9 | FR-001 |
| `PATCH /profile/personal` | US1 | FR-002, FR-003, FR-004, FR-005, FR-008 |
| `GET /reference/countries` | US1 | FR-037, FR-038, FR-039 |
| `GET /reference/cities` | US1 | FR-037, FR-038, FR-039 |
| `GET /reference/marital-statuses` | US1 | FR-037, FR-038, FR-039 |
| `GET /reference/education-levels` | US1 | FR-037, FR-038, FR-039 |
| `GET /reference/app-languages` | US1 | FR-037, FR-038, FR-039 |
