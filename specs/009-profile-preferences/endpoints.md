# Profile Preferences (Batch 5) — Endpoints

**Feature**: Profile Preferences (Batch 5)
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/profile/special-statuses` | 🔒 | Add a special status |
| 2 | `GET` | `/profile/special-statuses` | 🔒 | List special statuses |
| 3 | `DELETE` | `/profile/special-statuses/:specialStatusId` | 🔒 | Remove a special status |
| 4 | `GET` | `/profile/preferences` | 🔒 | Get all target preferences |
| 5 | `POST` | `/profile/preferences/degrees` | 🔒 | Add a target degree |
| 6 | `DELETE` | `/profile/preferences/degrees/:educationLevelId` | 🔒 | Remove a target degree |
| 7 | `POST` | `/profile/preferences/majors` | 🔒 | Add a target major |
| 8 | `DELETE` | `/profile/preferences/majors/:majorId` | 🔒 | Remove a target major |
| 9 | `POST` | `/profile/preferences/institutions` | 🔒 | Add a target institution |
| 10 | `DELETE` | `/profile/preferences/institutions/:institutionId` | 🔒 | Remove a target institution |
| 11 | `GET` | `/reference/special-statuses` | 🌐 | List special statuses reference |

---

See `specs/006-profile-education/endpoints.md` Cross-Endpoint Conventions for standard
response envelope, HTTP codes, validation rules, and Swagger requirements.

---

## 1–3. Special Statuses

### `POST /api/v1/profile/special-statuses`

**Body**: `{ "specialStatusId": "uuid" }`

Idempotent — adding an existing status produces no error and no duplicate.

**Response 201**: `{ "userId": "uuid", "specialStatusId": "uuid", "specialStatus": { "nameEn": "...", "nameAr": "..." } }`

### `GET /api/v1/profile/special-statuses`

**Response 200**: Array of status records.

### `DELETE /api/v1/profile/special-statuses/:specialStatusId`

**Response 204**: No Content.

---

## 4. `GET /api/v1/profile/preferences`

Returns all three preference groups in a single response:

```json
{
  "statusCode": 200,
  "message": "Preferences retrieved successfully",
  "data": {
    "targetDegrees": [
      { "educationLevelId": "uuid", "educationLevel": { "code": "master", "nameEn": "Master's Degree", "nameAr": "ماجستير" } }
    ],
    "targetMajors": [
      { "majorId": "uuid", "major": { "nameEn": "Computer Science", "nameAr": "علوم الحاسب" } }
    ],
    "targetInstitutions": [
      { "institutionId": "uuid", "institution": { "nameEn": "MIT", "nameAr": "معهد ماساتشوستس" } }
    ]
  },
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

---

## 5–10. Target Preferences

### `POST /api/v1/profile/preferences/degrees`

**Body**: `{ "educationLevelId": "uuid" }` — Max `MAX_TARGET_DEGREES` (default 5). Idempotent.

### `DELETE /api/v1/profile/preferences/degrees/:educationLevelId` → 204

### `POST /api/v1/profile/preferences/majors`

**Body**: `{ "majorId": "uuid" }` — Max `MAX_TARGET_MAJORS` (default 10). Idempotent.

### `DELETE /api/v1/profile/preferences/majors/:majorId` → 204

### `POST /api/v1/profile/preferences/institutions`

**Body**: `{ "institutionId": "uuid" }` — Max `MAX_TARGET_INSTITUTIONS` (default 10). Idempotent.

### `DELETE /api/v1/profile/preferences/institutions/:institutionId` → 204

---

## 11. `GET /api/v1/reference/special-statuses` [PUBLIC]

```json
{
  "statusCode": 200,
  "message": "Special statuses retrieved successfully",
  "data": [
    { "id": "uuid", "nameEn": "Orphan", "nameAr": "يتيم" },
    { "id": "uuid", "nameEn": "Person with Disability", "nameAr": "ذوي الاحتياجات الخاصة" }
  ],
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```
