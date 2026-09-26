# API Contract — Batch 4: Standardized Tests

**Base path**: `/api/v1`

---

## Test Results CRUD

### POST /profile/test-results

**Request body:**

```json
{
  "testId": "uuid",
  "score": 7.5,
  "testDate": "2024-01-15"
}
```

**Rules:**
- `testId` and `score` required
- `minScore ≤ score ≤ maxScore` — 400 if out of range
- `(score - minScore) % scoreStep == 0` — 400 if off-step
- Unique: `(userId, testId)` — 409 if duplicate
- Max: `MAX_TEST_RESULTS` (default 10) — 409 if exceeded

**Response:**

```json
{
  "id": "uuid",
  "userId": "uuid",
  "testId": "uuid",
  "test": {
    "id": "uuid",
    "nameEn": "IELTS",
    "nameAr": "آيلتس",
    "minScore": "0.00",
    "maxScore": "9.00",
    "scoreStep": "0.50"
  },
  "score": "7.50",
  "testDate": "2024-01-15"
}
```

---

### GET /profile/test-results

Returns all test results with embedded test info.

---

### GET /profile/test-results/:id

Returns a single test result. 404 if not found.

---

### PATCH /profile/test-results/:id

All fields optional. Score re-validated if changed.

---

### DELETE /profile/test-results/:id

**Response**: 204 No Content.

---

## Reference Endpoints [PUBLIC]

### GET /reference/standardized-tests

```json
[
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
]
```
