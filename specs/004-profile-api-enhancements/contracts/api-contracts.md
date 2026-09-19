# API Contracts: Profile API Enhancements & Reference Data Expansion

**Feature**: 004-profile-api-enhancements | **Phase**: 1 — Design
**Date**: 2026-09-18 | **Base URL**: `/api/v1`

---

## Standard Envelopes

All responses use the platform's `TransformInterceptor` envelope.

**Paginated success:**
```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": [],
  "meta": {
    "pagination": {
      "page": 1, "limit": 20, "total": 10, "totalPages": 1,
      "hasNext": false, "hasPrev": false
    }
  },
  "errors": null,
  "timestamp": "2026-09-18T19:00:00+03:00"
}
```

**Non-paginated success:**
```json
{
  "success": true,
  "status": 200,
  "message": "OK",
  "data": [],
  "meta": null,
  "errors": null,
  "timestamp": "2026-09-18T19:00:00+03:00"
}
```

**Validation error (400):**
```json
{
  "success": false,
  "status": 400,
  "message": "Validation failed",
  "data": null,
  "meta": null,
  "errors": [
    { "field": "page", "code": "VALIDATION_TOO_SMALL", "message": "page must not be less than 1" }
  ],
  "timestamp": "..."
}
```

**Rate limit error (429):**
```json
{
  "success": false,
  "status": 429,
  "message": "Too Many Requests",
  "data": null,
  "meta": null,
  "errors": [{ "code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests, please try again later" }],
  "timestamp": "..."
}
```

---

## New Endpoints

### GET /api/v1/reference/languages

Returns master language list with optional search and pagination.

| Property | Value |
|---|---|
| Auth | None — `@Public()` |
| Guard | None |
| Rate limit | Global default |

**Query Parameters:**

| Param | Type | Required | Default | Validation |
|---|---|---|---|---|
| `search` | string | No | — | Max 100 chars, case-insensitive ILIKE on `name` |
| `page` | integer | No | 1 | Min 1 |
| `limit` | integer | No | 20 | Min 1, Max 100 |

**Success Response 200:**
```json
{
  "data": [
    { "id": "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e", "name": "English" },
    { "id": "9f76b065-3d90-4833-8caf-7d9a388ecac7", "name": "Arabic" }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "total": 10, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
}
```

**Error Responses:** 400 (invalid query params)

---

### GET /api/v1/reference/education-levels

Returns all active education levels. No parameters.

| Property | Value |
|---|---|
| Auth | None — `@Public()` |
| Guard | None |
| Rate limit | Global default |

**Success Response 200:**
```json
{
  "data": [
    { "id": "uuid", "name": "high_school",  "labelEn": "High School",  "labelAr": "ثانوية عامة",  "isActive": true },
    { "id": "uuid", "name": "diploma",      "labelEn": "Diploma",      "labelAr": "دبلوم",         "isActive": true },
    { "id": "uuid", "name": "bachelor",     "labelEn": "Bachelor",     "labelAr": "بكالوريوس",     "isActive": true },
    { "id": "uuid", "name": "master",       "labelEn": "Master",       "labelAr": "ماجستير",       "isActive": true },
    { "id": "uuid", "name": "phd",          "labelEn": "PhD",          "labelAr": "دكتوراه",       "isActive": true },
    { "id": "uuid", "name": "certificate",  "labelEn": "Certificate",  "labelAr": "شهادة",         "isActive": true },
    { "id": "uuid", "name": "other",        "labelEn": "Other",        "labelAr": "أخرى",          "isActive": true }
  ],
  "meta": null
}
```

**Error Responses:** None expected.

---

### GET /api/v1/reference/app-languages

Returns static list of supported UI locales. No DB query. No auth.

| Property | Value |
|---|---|
| Auth | None — `@Public()` |
| Guard | None |
| Cache hint | `Cache-Control: public, max-age=86400` |

**Success Response 200:**
```json
{
  "data": [
    { "code": "en", "name": "English",  "nativeName": "English",   "dir": "ltr" },
    { "code": "ar", "name": "Arabic",   "nativeName": "العربية",    "dir": "rtl" },
    { "code": "fr", "name": "French",   "nativeName": "Français",   "dir": "ltr" },
    { "code": "de", "name": "German",   "nativeName": "Deutsch",    "dir": "ltr" },
    { "code": "es", "name": "Spanish",  "nativeName": "Español",    "dir": "ltr" },
    { "code": "tr", "name": "Turkish",  "nativeName": "Türkçe",     "dir": "ltr" }
  ],
  "meta": null
}
```

**Error Responses:** None expected.

---

## Modified Endpoints

### GET /api/v1/reference/fields-of-study (updated)

Added pagination and search. Previous callers with no params continue to receive all results (page=1, limit=20 defaults).

**New Query Parameters:**

| Param | Type | Required | Default | Validation |
|---|---|---|---|---|
| `search` | string | No | — | Max 100 chars, ILIKE on `name` |
| `category` | string | No | — | Must be one of: STEM, Business, Arts, Science, Engineering, Healthcare |
| `page` | integer | No | 1 | Min 1 |
| `limit` | integer | No | 20 | Min 1, Max 100 |

**Response shape change:** `meta.pagination` block now present (previously `meta: null`).

---

### GET /api/v1/reference/skills-taxonomy (updated)

Dual-mode response based on presence of query params.

**New Query Parameters:**

| Param | Type | Required | Default | Validation |
|---|---|---|---|---|
| `search` | string | No | — | Max 100 chars, ILIKE on `name` |
| `category` | string | No | — | Any non-empty string |
| `page` | integer | No | 1 | Min 1 |
| `limit` | integer | No | 50 | Min 1, Max 100 |

**Mode A — No params (default, grouped, backward-compatible):**
```json
{
  "data": [
    { "category": "Tech", "skills": [{ "id": "uuid", "name": "JavaScript" }] }
  ],
  "meta": null
}
```

**Mode B — Any param present (flat paginated):**
```json
{
  "data": [
    { "id": "uuid", "name": "JavaScript", "category": "Tech" }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 50, "total": 27, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
}
```

---

### GET /api/v1/profile/skills (updated)

Added pagination. Auth required.

**New Query Parameters:** `page` (int, default 1), `limit` (int, default 20, max 100)

**Response:** `data: [{ skillId, name, proficiency }]` + `meta.pagination`

---

### GET /api/v1/profile/languages (updated)

Added pagination. Auth required.

**New Query Parameters:** `page` (int, default 1), `limit` (int, default 20, max 100)

**Response:** `data: [{ languageId, name, proficiency }]` + `meta.pagination`

---

### GET /api/v1/profile/documents (updated)

Added pagination. Auth required. `storagePath` remains excluded from all items.

**New Query Parameters:** `page` (int, default 1), `limit` (int, default 10, max 100)

**Response:** `data: [{ id, docType, displayName, mimeType, sizeBytes, isEncrypted, createdAt }]` + `meta.pagination`

---

### GET /api/v1/profile/educations (updated)

Added pagination. Auth required.

**New Query Parameters:** `page` (int, default 1), `limit` (int, default 10, max 100)

**Response:** `data: [education records]` + `meta.pagination`

---

### GET /api/v1/users (envelope fix)

Pagination fields moved from root to `meta.pagination`. Auth required (system_admin, ADMIN, content_admin).

**Before (current):**
```json
{ "data": [...], "total": 48, "page": 1, "limit": 20, "totalPages": 3, "hasNext": true, "hasPrev": false }
```

**After:**
```json
{
  "data": [...],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "total": 48, "totalPages": 3, "hasNext": true, "hasPrev": false }
  }
}
```

---

## Security Contract Changes

### UUID Validation on Route Params

The following params now reject non-UUID values with **400** before reaching the service:

| Endpoint | Param |
|---|---|
| `GET/PATCH/DELETE /profile/skills/:skillId` | `:skillId` |
| `GET/PATCH/DELETE /profile/languages/:languageId` | `:languageId` |
| `GET/DELETE /profile/documents/:id` | `:id` |
| `GET/PATCH/DELETE /profile/educations/:id` | `:id` |

### Rate Limiting on Auth Endpoints

| Endpoint | Limit |
|---|---|
| `POST /api/v1/auth/login` | 5 requests / 60 seconds / IP |
| `POST /api/v1/auth/register` | 5 requests / 60 seconds / IP |

Exceeds limit → **429 Too Many Requests**.

### Education Level Enum Validation

`PATCH /api/v1/profile` with invalid `educationLevel` → **400 Validation failed**.

Valid values: `high_school`, `diploma`, `bachelor`, `master`, `phd`, `certificate`, `other`.
