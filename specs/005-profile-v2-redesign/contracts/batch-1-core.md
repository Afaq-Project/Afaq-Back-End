# API Contract — Batch 1: Foundation, Auth, Personal Info & Location

**Base path**: `/api/v1`
**Auth**: All endpoints require `Authorization: Bearer <token>` unless marked `[PUBLIC]`.
**Response envelope**: All responses use `{ statusCode, message, data, timestamp }`.

---

## Auth Module Change (not a new endpoint — behavior change)

### POST /auth/login — Response updated

**Before**: Response included `data.userProfile`.
**After**: Response contains **only** `accessToken` and `refreshToken`.

```json
// Response — data field
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

Same applies to `POST /auth/register` and all OAuth callback endpoints.

---

## Profile Endpoints

### GET /profile/me

Returns the complete profile for the authenticated user. Never returns 404 — an
empty profile structure is always returned.

**Response body — `data` field:**

```json
{
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
  "createdAt": "2026-09-21T00:00:00.000Z",
  "updatedAt": null
}
```

---

### PATCH /profile/personal

Updates personal info and/or location fields. All fields optional.

**Request body:**

```json
{
  "firstName": "Ahmad",
  "lastName": "Al-Najjar",
  "email": "ahmad@example.com",
  "dateOfBirth": "2000-03-15",
  "gender": "MALE",
  "maritalStatusId": "uuid",
  "phone": "+966501234567",
  "bio": "Graduate student in Computer Science.",
  "profilePhotoUrl": "https://cdn.example.com/photos/abc.jpg",
  "experiences": ["Software Engineering Intern at Acme", "Volunteer Tutor"],
  "countryOfResidenceId": "uuid",
  "nationalityId": "uuid",
  "currentCityId": "uuid",
  "educationLevelId": "uuid"
}
```

**Constraints:**
- `gender` must be `"MALE"` or `"FEMALE"` (enum — any other value → 400)
- `dateOfBirth` must be a valid ISO date string
- `bio` max length from SystemSettings (default 1000 chars) — 400 if exceeded
- `*Id` fields validated against master tables — 400 if referenced record not found
- Unknown fields rejected (forbidNonWhitelisted)

**Response**: Updated full profile (same shape as GET /profile/me).

---

### GET /reference/countries

| Query Param | Type | Required | Description |
|:---|:---|:---:|:---|
| `search` | string | No | Filter by name (case-insensitive, partial match) |
| `region` | string | No | Filter by region (e.g., `Asia`, `Europe`) |
| `page` | number | No | Page number (default 1) |
| `limit` | number | No | Items per page (default 50, max 200) |

**Response:**

```json
[
  {
    "id": "uuid",
    "nameEn": "Saudi Arabia",
    "nameAr": "المملكة العربية السعودية",
    "nationalityNameEn": "Saudi",
    "nationalityNameAr": "سعودي",
    "isoCode": "SAU",
    "isoCode2": "SA",
    "flagEmoji": "🇸🇦"
  }
]
```

---

### GET /reference/cities

| Query Param | Type | Required | Description |
|:---|:---|:---:|:---|
| `countryId` | UUID | No | Filter by country |
| `search` | string | No | Filter by name |

**Response:**

```json
[
  { "id": "uuid", "nameEn": "Riyadh", "nameAr": "الرياض", "countryId": "uuid" }
]
```

---

### GET /reference/marital-statuses

No query params.

**Response:**

```json
[
  { "id": "uuid", "nameEn": "Single", "nameAr": "أعزب" }
]
```

---

### GET /reference/education-levels

No query params.

**Response:**

```json
[
  { "id": "uuid", "code": "bachelor", "nameEn": "Bachelor's Degree", "nameAr": "بكالوريوس" }
]
```

---

### GET /reference/app-languages

No query params. Returns the languages the application UI is available in.

**Response:**

```json
[
  { "code": "en", "nameEn": "English", "nameAr": "الإنجليزية" },
  { "code": "ar", "nameEn": "Arabic", "nameAr": "العربية" }
]
```

---

## Error Responses

All errors follow the global exception filter format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["gender must be one of the following values: MALE, FEMALE"],
  "timestamp": "2026-09-21T15:00:00.000Z"
}
```

| Status | Meaning |
|:---:|:---|
| 400 | Validation failure, invalid FK, unknown field |
| 401 | Missing or expired Bearer token |
| 403 | Authenticated but lacks permission |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate record) |
| 500 | Server error (e.g., storage failure) |
