# Profile Tests (Batch 4) — Endpoints

**Feature**: Profile Tests (Batch 4)
**Base URL**: `/api/v1`
**Auth**: Bearer JWT required unless marked `[PUBLIC]`
**Cross-cutting decisions**: See `docx/shared-research.md`.

---

## Overview

| # | Method | Path | Auth | Purpose |
|:---:|:---:|:---|:---:|:---|
| 1 | `POST` | `/profile/test-results` | 🔒 | Create a test result |
| 2 | `GET` | `/profile/test-results` | 🔒 | List all test results |
| 3 | `PATCH` | `/profile/test-results/:id` | 🔒 | Update a test result |
| 4 | `DELETE` | `/profile/test-results/:id` | 🔒 | Delete a test result |
| 5 | `GET` | `/reference/standardized-tests` | 🌐 | List standardized tests |

---

See `specs/006-profile-education/endpoints.md` Cross-Endpoint Conventions for standard
response envelope, HTTP codes, validation rules, and Swagger requirements.

---

## 1. `POST /api/v1/profile/test-results`

**Auth**: Bearer JWT

**Body**:

| Field | Type | Required | Notes |
|:---|:---|:---:|:---|
| `testId` | UUID | Yes | FK to `StandardizedTests` |
| `score` | number | Yes | Validated against min/max/step |
| `testDate` | ISO date | No | Optional test date |

**Rules**:
- `score >= minScore && score <= maxScore` → 400 if out of range
- `(score - minScore) % scoreStep === 0` → 400 if off-step
- Unique: `(userId, testId)` → 409 if duplicate
- Max: `MAX_TEST_RESULTS` (default 10) → 409 if exceeded

**Response — 201 Created**: Test result record with embedded test info (`nameEn`, `nameAr`, `minScore`, `maxScore`, `scoreStep`).

**Error Responses**: 400 VALIDATION_ERROR, 400 SCORE_OUT_OF_RANGE, 400 SCORE_OFF_STEP, 401 UNAUTHORIZED, 409 TEST_DUPLICATE, 409 MAX_TEST_RESULTS_REACHED, 500 INTERNAL_ERROR.

---

## 2. `GET /api/v1/profile/test-results`

**Auth**: Bearer JWT

**Response — 200 OK**: Array of test results with embedded test info.

---

## 3. `PATCH /api/v1/profile/test-results/:id`

**Auth**: Bearer JWT

**Body** (all optional): `score`, `testDate`. Score re-validated if changed.

**Response — 200 OK**: Updated test result.

---

## 4. `DELETE /api/v1/profile/test-results/:id`

**Auth**: Bearer JWT

**Response — 204 No Content**.

---

## 5. `GET /api/v1/reference/standardized-tests` [PUBLIC]

**Response — 200 OK**:

```json
{
  "statusCode": 200,
  "message": "Standardized tests retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "nameEn": "IELTS",
      "nameAr": "آيلتس",
      "minScore": "0.00",
      "maxScore": "9.00",
      "scoreStep": "0.50"
    },
    {
      "id": "uuid",
      "nameEn": "TOEFL iBT",
      "nameAr": "توفل",
      "minScore": "0.00",
      "maxScore": "120.00",
      "scoreStep": "1.00"
    },
    {
      "id": "uuid",
      "nameEn": "GRE",
      "nameAr": "جي آر إي",
      "minScore": "260.00",
      "maxScore": "340.00",
      "scoreStep": "1.00"
    }
  ],
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```
