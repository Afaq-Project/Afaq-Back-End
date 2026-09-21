# Profile Languages (Batch 3) — Endpoints

**Feature**: Profile Languages (Batch 3)
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/profile/languages` | 🔒 | Create a language record |
| 2 | `GET` | `/profile/languages` | 🔒 | List all language records |
| 3 | `GET` | `/profile/languages/:languageId` | 🔒 | Retrieve a single language record |
| 4 | `PATCH` | `/profile/languages/:languageId` | 🔒 | Update a language record |
| 5 | `DELETE` | `/profile/languages/:languageId` | 🔒 | Delete a language record |
| 6 | `GET` | `/reference/languages` | 🌐 | List supported languages |
| 7 | `GET` | `/reference/proficiency-levels` | 🌐 | List proficiency levels |

---

See `specs/006-profile-education/endpoints.md` Cross-Endpoint Conventions for standard
response envelope, HTTP codes, validation rules, and Swagger requirements.

---

## 1. `POST /api/v1/profile/languages`

**Auth**: Bearer JWT

**Body**:

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `languageId` | UUID | Yes | FK to `LanguagesMaster` |
| `proficiencyLevelId` | UUID | Yes | FK to `ProficiencyLevels` |
| `isNative` | boolean | No | Default `false` |

**Rules**:
- Unique: `(userId, languageId)` → 409 if duplicate
- Max: `MAX_LANGUAGES` (default 10) → 409 if exceeded

**Response — 201 Created**: Language record with embedded `language.nameEn`, `language.nameAr`, `proficiencyLevel.nameEn`, `proficiencyLevel.nameAr`.

**Error Responses**: 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 409 LANGUAGE_DUPLICATE, 409 MAX_LANGUAGES_REACHED, 500 INTERNAL_ERROR.

---

## 2. `GET /api/v1/profile/languages`

**Auth**: Bearer JWT

**Response — 200 OK**: Array of language records with embedded names. Empty array `[]` when none exist.

---

## 3. `GET /api/v1/profile/languages/:languageId`

**Auth**: Bearer JWT

**Params**: `languageId` — UUID of the language record.

**Response — 200 OK**: Single language record.

**Error Responses**: 401 UNAUTHORIZED, 404 LANGUAGE_NOT_FOUND, 500 INTERNAL_ERROR.

---

## 4. `PATCH /api/v1/profile/languages/:languageId`

**Auth**: Bearer JWT

**Body** (all optional): `proficiencyLevelId`, `isNative`.

**Response — 200 OK**: Updated language record.

**Error Responses**: 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 404 LANGUAGE_NOT_FOUND, 500 INTERNAL_ERROR.

---

## 5. `DELETE /api/v1/profile/languages/:languageId`

**Auth**: Bearer JWT

**Response — 204 No Content**.

**Error Responses**: 401 UNAUTHORIZED, 404 LANGUAGE_NOT_FOUND, 500 INTERNAL_ERROR.

---

## 6. `GET /api/v1/reference/languages` [PUBLIC]

**Response — 200 OK**:

```json
{
  "statusCode": 200,
  "message": "Languages retrieved successfully",
  "data": [
    { "id": "uuid", "nameEn": "Arabic", "nameAr": "العربية", "isoCode": "ar" }
  ],
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

---

## 7. `GET /api/v1/reference/proficiency-levels` [PUBLIC]

Ordered by `sortOrder` ascending.

**Response — 200 OK**:

```json
{
  "statusCode": 200,
  "message": "Proficiency levels retrieved successfully",
  "data": [
    { "id": "uuid", "nameEn": "Beginner", "nameAr": "مبتدئ", "sortOrder": 1 },
    { "id": "uuid", "nameEn": "Intermediate", "nameAr": "متوسط", "sortOrder": 2 },
    { "id": "uuid", "nameEn": "Advanced", "nameAr": "متقدم", "sortOrder": 3 },
    { "id": "uuid", "nameEn": "Fluent", "nameAr": "طليق", "sortOrder": 4 },
    { "id": "uuid", "nameEn": "Native", "nameAr": "اللغة الأم", "sortOrder": 5 }
  ],
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```
